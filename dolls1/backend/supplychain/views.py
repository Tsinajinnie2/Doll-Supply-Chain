import csv
import io
import re
import zipfile
from datetime import date, timedelta

from django.core.files.storage import default_storage
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from . import catalog_parts
from .models import *
from .serializers import *
from .services.six_sigma import yield_rate, configuration_accuracy
from .services.demand_forecast_workbench import build_workbench_payload
from .services.operational_workbench import build_operational_payload, compute_dpmo_snapshot

_CATALOG_TEMPLATE_ROWS = catalog_parts.build_catalog_rows()


class ProductOptionViewSet(viewsets.ModelViewSet):
    queryset = ProductOption.objects.all()
    serializer_class = ProductOptionSerializer
    filterset_fields = ["option_type", "is_active"]
    search_fields = ["option_code", "option_name"]


class PartViewSet(viewsets.ModelViewSet):
    queryset = Part.objects.all()
    serializer_class = PartSerializer
    filterset_fields = ["part_type", "skin_tone", "is_active"]
    search_fields = ["part_number", "part_name"]


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    filterset_fields = ["country", "is_active"]
    search_fields = ["supplier_code", "supplier_name"]


class SupplierPartViewSet(viewsets.ModelViewSet):
    queryset = SupplierPart.objects.select_related("part", "supplier").all()
    serializer_class = SupplierPartSerializer
    filterset_fields = ["part", "supplier", "is_primary", "is_active"]


class InventorySnapshotViewSet(viewsets.ModelViewSet):
    queryset = InventorySnapshot.objects.select_related("part").all()
    serializer_class = InventorySnapshotSerializer
    filterset_fields = ["part", "snapshot_date"]


class CustomerOrderViewSet(viewsets.ModelViewSet):
    queryset = CustomerOrder.objects.all()
    serializer_class = CustomerOrderSerializer
    filterset_fields = ["status", "skin_tone", "order_date"]
    search_fields = ["order_number"]


class DailyTargetViewSet(viewsets.ModelViewSet):
    queryset = DailyTarget.objects.all()
    serializer_class = DailyTargetSerializer
    filterset_fields = ["target_date"]


class WeeklyTargetViewSet(viewsets.ModelViewSet):
    queryset = WeeklyTarget.objects.all()
    serializer_class = WeeklyTargetSerializer
    filterset_fields = ["week_start", "week_end"]


class ForecastParameterViewSet(viewsets.ModelViewSet):
    queryset = ForecastParameter.objects.all()
    serializer_class = ForecastParameterSerializer
    filterset_fields = ["parameter_name", "is_active"]


class OrderRecommendationViewSet(viewsets.ModelViewSet):
    queryset = OrderRecommendation.objects.select_related("part", "supplier_part").all()
    serializer_class = OrderRecommendationSerializer
    filterset_fields = ["recommendation_date", "risk_level", "approved"]


class DataUploadViewSet(viewsets.ModelViewSet):
    queryset = DataUpload.objects.all()
    serializer_class = DataUploadSerializer
    filterset_fields = ["original_file_type", "conversion_status", "import_status"]
    ordering_fields = ["created_at", "id", "original_filename"]
    TEMPLATE_CSV = catalog_parts.rows_to_csv_string(_CATALOG_TEMPLATE_ROWS)
    TEMPLATE_SQL = catalog_parts.rows_to_sql_seed(_CATALOG_TEMPLATE_ROWS)
    TEMPLATE_README = catalog_parts.template_readme_markdown()

    @staticmethod
    def _guess_part_type(part_name, part_number):
        text = f"{part_name} {part_number}".lower()
        if "torso" in text:
            return "torso"
        if "box" in text or "ribbon" in text:
            return "packaging"
        if "arm" in text:
            return "arm"
        if "leg" in text:
            return "leg"
        if "hair" in text:
            return "hair"
        if "eye" in text:
            return "eyes"
        if "outfit" in text:
            return "outfit"
        if "glass" in text:
            return "glasses"
        if "pack" in text:
            return "packaging"
        return "head"

    @staticmethod
    def _normalize_rows_from_reader(reader):
        required = {"part_number", "part_name", "available_qty", "reorder_point_qty"}
        headers = set(reader.fieldnames or [])
        if not required.issubset(headers):
            return None, "Missing CSV headers. Required: part_number, part_name, available_qty, reorder_point_qty."

        normalized = []
        skipped = 0
        for row in reader:
            part_number = (row.get("part_number") or "").strip()
            part_name = (row.get("part_name") or "").strip()
            if not part_number or not part_name:
                skipped += 1
                continue

            try:
                available_qty = int(float((row.get("available_qty") or "0").strip()))
                reorder_point_qty = int(float((row.get("reorder_point_qty") or "0").strip()))
            except ValueError:
                skipped += 1
                continue

            normalized.append(
                {
                    "part_number": part_number,
                    "part_name": part_name,
                    "available_qty": available_qty,
                    "reorder_point_qty": reorder_point_qty,
                }
            )

        return {"rows": normalized, "skipped": skipped}, ""

    def _rows_from_csv_text(self, raw_text):
        reader = csv.DictReader(raw_text.splitlines())
        normalized, error = self._normalize_rows_from_reader(reader)
        if error:
            return None, 0, error
        return normalized["rows"], normalized["skipped"], ""

    def _rows_from_zip(self, relative_path):
        all_rows = []
        skipped = 0
        with default_storage.open(relative_path, "rb") as uploaded_file:
            zip_bytes = io.BytesIO(uploaded_file.read())
        with zipfile.ZipFile(zip_bytes) as archive:
            csv_members = [n for n in archive.namelist() if n.lower().endswith(".csv")]
            if not csv_members:
                return None, 0, "ZIP must contain at least one .csv file."
            for member in csv_members:
                raw_text = archive.read(member).decode("utf-8-sig", errors="replace")
                rows, member_skipped, error = self._rows_from_csv_text(raw_text)
                if error:
                    return None, 0, f"{member}: {error}"
                all_rows.extend(rows)
                skipped += member_skipped
        return all_rows, skipped, ""

    def _rows_from_sql(self, relative_path):
        with default_storage.open(relative_path, "rb") as uploaded_file:
            sql_text = uploaded_file.read().decode("utf-8-sig", errors="replace")

        # Supported seed line format:
        # INSERT INTO inventory_seed (part_number, part_name, available_qty, reorder_point_qty) VALUES (...), (...);
        pattern = re.compile(
            r"insert\s+into\s+\w+\s*\((?P<columns>[^)]+)\)\s*values\s*(?P<values>.+?);",
            re.IGNORECASE | re.DOTALL,
        )
        tuple_pattern = re.compile(r"\(([^()]*)\)")
        rows = []
        for statement in pattern.finditer(sql_text):
            columns = [c.strip().strip('"').strip("`") for c in statement.group("columns").split(",")]
            lower_cols = [c.lower() for c in columns]
            if not {"part_number", "part_name", "available_qty", "reorder_point_qty"}.issubset(set(lower_cols)):
                continue
            values_block = statement.group("values")
            for tuple_match in tuple_pattern.finditer(values_block):
                raw_values = next(csv.reader([tuple_match.group(1)], skipinitialspace=True))
                if len(raw_values) != len(columns):
                    continue
                row = {lower_cols[idx]: raw_values[idx].strip().strip("'").strip('"') for idx in range(len(columns))}
                rows.append(
                    {
                        "part_number": row.get("part_number", "").strip(),
                        "part_name": row.get("part_name", "").strip(),
                        "available_qty": row.get("available_qty", "0").strip(),
                        "reorder_point_qty": row.get("reorder_point_qty", "0").strip(),
                    }
                )

        if not rows:
            return None, 0, (
                "SQL seed must include INSERT statements with columns: "
                "part_number, part_name, available_qty, reorder_point_qty."
            )
        reader = csv.DictReader(
            ["part_number,part_name,available_qty,reorder_point_qty"]
            + [
                f"{r['part_number']},{r['part_name']},{r['available_qty']},{r['reorder_point_qty']}"
                for r in rows
            ]
        )
        normalized, error = self._normalize_rows_from_reader(reader)
        if error:
            return None, 0, error
        return normalized["rows"], normalized["skipped"], ""

    def _apply_normalized_inventory_rows(self, rows):
        imported = 0
        today = date.today()
        touched_parts = []
        for item in rows:
            part_number = item["part_number"]
            part_name = item["part_name"]
            available_qty = item["available_qty"]
            reorder_point_qty = item["reorder_point_qty"]

            part, _ = Part.objects.get_or_create(
                part_number=part_number,
                defaults={
                    "part_name": part_name,
                    "part_type": self._guess_part_type(part_name, part_number),
                },
            )
            if part.part_name != part_name and part_name:
                part.part_name = part_name
                part.save(update_fields=["part_name", "updated_at"])

            InventorySnapshot.objects.update_or_create(
                part=part,
                snapshot_date=today,
                defaults={
                    "on_hand_qty": available_qty,
                    "allocated_qty": 0,
                    "incoming_qty": 0,
                    "safety_stock_qty": 0,
                    "reorder_point_qty": reorder_point_qty,
                },
            )
            touched_parts.append(part)
            imported += 1

        return imported, touched_parts

    def _ensure_downstream_seed_data(self, parts):
        if not parts:
            return
        today = date.today()
        now = timezone.now()

        # Suppliers page
        supplier, _ = Supplier.objects.get_or_create(
            supplier_code="SUP-AUTO-001",
            defaults={
                "supplier_name": "Auto Seed Supplier",
                "country": "US",
                "iso_9001_current": True,
                "cpsia_current": True,
                "supplier_score": 92,
            },
        )
        for part in parts[:5]:
            SupplierPart.objects.get_or_create(
                part=part,
                supplier=supplier,
                defaults={
                    "supplier_part_number": f"{part.part_number}-AUTO",
                    "base_cost": 3.50,
                    "shipping_cost_per_unit": 0.70,
                    "minimum_order_quantity": 100,
                    "order_multiple": 10,
                    "capacity_per_month": 5000,
                    "is_primary": True,
                },
            )

        # Orders page + dashboard shipped/total
        for idx, part in enumerate(parts[:3], start=1):
            order_number = f"AUTO-{today.strftime('%Y%m%d')}-{idx:03d}"
            CustomerOrder.objects.get_or_create(
                order_number=order_number,
                defaults={
                    "order_date": now - timedelta(hours=12 * idx),
                    "promised_ship_by": now + timedelta(days=3),
                    "shipped_at": now - timedelta(hours=3 * idx),
                    "skin_tone": part.skin_tone or "medium",
                    "face_shape": part.face_shape or "oval",
                    "haircut": part.haircut or "bob",
                    "hair_color": part.hair_color or "brown",
                    "eye_color": part.eye_color or "brown",
                    "outfit": part.outfit or "casual",
                    "glasses": part.glasses or "none",
                    "status": "shipped",
                    "is_custom_build": True,
                },
            )

        # Quality page + dashboard defects
        defect_type, _ = DefectType.objects.get_or_create(
            defect_code="WRONG-BUILD",
            defaults={"defect_name": "Wrong Build", "description": "Auto-seeded for demo metrics."},
        )
        root_cause, _ = RootCauseCode.objects.get_or_create(
            cause_code="CAUSE-SETUP",
            defaults={"cause_name": "Setup variance"},
        )
        process_step, _ = ProcessStep.objects.get_or_create(
            step_code="ASSEMBLY",
            defaults={"step_name": "Assembly", "sequence": 1},
        )
        if not DefectEvent.objects.filter(defect_date=today, defect_type=defect_type).exists():
            DefectEvent.objects.create(
                defect_date=today,
                part=parts[0] if parts else None,
                defect_type=defect_type,
                root_cause=root_cause,
                process_step=process_step,
                quantity=1,
                severity="minor",
                notes="Auto-seeded from upload pipeline.",
            )

    @action(detail=False, methods=["get"], url_path="template-csv")
    def template_csv(self, request):
        response = HttpResponse(self.TEMPLATE_CSV, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{catalog_parts.FILENAME_CSV}"'
        return response

    @action(detail=False, methods=["get"], url_path="template-sql")
    def template_sql(self, request):
        response = HttpResponse(self.TEMPLATE_SQL, content_type="application/sql; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{catalog_parts.FILENAME_SQL}"'
        return response

    @action(detail=False, methods=["get"], url_path="template-zip")
    def template_zip(self, request):
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(catalog_parts.FILENAME_README_MD, self.TEMPLATE_README)
            archive.writestr(catalog_parts.FILENAME_CSV, self.TEMPLATE_CSV)
            archive.writestr(catalog_parts.FILENAME_SQL, self.TEMPLATE_SQL)
        response = HttpResponse(zip_buffer.getvalue(), content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="{catalog_parts.FILENAME_ZIP}"'
        return response

    def _process_upload_record(self, record, file_type, relative_path):
        if file_type in {"csv", "zip", "sql"}:
            if file_type == "csv":
                with default_storage.open(relative_path, "rb") as uploaded_file:
                    raw_text = uploaded_file.read().decode("utf-8-sig", errors="replace")
                rows, skipped, error = self._rows_from_csv_text(raw_text)
            elif file_type == "zip":
                rows, skipped, error = self._rows_from_zip(relative_path)
            else:
                rows, skipped, error = self._rows_from_sql(relative_path)

            if error:
                record.validation_status = "failed"
                record.import_status = "failed"
                record.user_message = error
            else:
                imported, touched_parts = self._apply_normalized_inventory_rows(rows)
                self._ensure_downstream_seed_data(touched_parts)
                record.validation_status = "passed"
                record.import_status = "completed"
                record.user_message = (
                    f"Imported {imported} normalized rows from {file_type.upper()} source "
                    f"(skipped {skipped})."
                )
            record.save(update_fields=["validation_status", "import_status", "user_message", "updated_at"])
        else:
            record.user_message = (
                "Stored file upload. Auto-import currently supports CSV, ZIP-of-CSV, and SQL seed files."
            )
            record.save(update_fields=["user_message", "updated_at"])

    @action(detail=True, methods=["post"], url_path="reimport")
    def reimport_file(self, request, pk=None):
        record = self.get_object()
        relative_path = record.original_file_path
        if not relative_path or not default_storage.exists(relative_path):
            return Response({"detail": "Stored file could not be found for this upload."}, status=404)
        record.validation_status = "pending"
        record.import_status = "pending"
        record.user_message = "Reimport queued from recent uploads list."
        record.save(update_fields=["validation_status", "import_status", "user_message", "updated_at"])
        self._process_upload_record(record, record.original_file_type, relative_path)
        return Response(self.get_serializer(record).data)

    @action(
        detail=False,
        methods=["post"],
        url_path="file",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_file(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response(
                {"detail": "Send a multipart field named `file`."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        name = upload.name
        ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
        type_map = {"csv": "csv", "xlsx": "xlsx", "xls": "xlsx", "zip": "zip", "sql": "sql"}
        file_type = type_map.get(ext, "csv")
        relative_path = default_storage.save(f"uploads/{name}", upload)
        record = DataUpload.objects.create(
            original_filename=name,
            original_file_type=file_type,
            original_file_path=relative_path,
            validation_status="pending",
            import_status="pending",
            user_message="Received upload via API",
        )
        self._process_upload_record(record, file_type, relative_path)
        return Response(
            self.get_serializer(record).data,
            status=status.HTTP_201_CREATED,
        )


class DefectEventViewSet(viewsets.ModelViewSet):
    queryset = DefectEvent.objects.all()
    serializer_class = DefectEventSerializer
    filterset_fields = ["defect_date", "defect_type", "root_cause", "process_step"]


class ReturnEventViewSet(viewsets.ModelViewSet):
    queryset = ReturnEvent.objects.all()
    serializer_class = ReturnEventSerializer


class CapaCaseViewSet(viewsets.ModelViewSet):
    queryset = CapaCase.objects.all()
    serializer_class = CapaCaseSerializer
    filterset_fields = ["status", "owner"]


class SupplierLotQualityViewSet(viewsets.ModelViewSet):
    queryset = SupplierLotQuality.objects.all()
    serializer_class = SupplierLotQualitySerializer


@api_view(["GET"])
def demand_forecast_workbench(request):
    """Monthly doll demand forecast with seasonality, mega promos, BOM, and recommended orders."""
    payload = build_workbench_payload()
    return Response(payload)


@api_view(["GET"])
def operational_workbench(request):
    """Shared snapshot for Orders & Targets, Quality / Six Sigma, and Settings (forecast + ops KPIs)."""
    return Response(build_operational_payload())


@api_view(["GET"])
def dashboard_summary(request):
    total_orders = CustomerOrder.objects.count()
    shipped_orders = CustomerOrder.objects.exclude(shipped_at=None).count()
    on_time_orders = 0
    for order in CustomerOrder.objects.exclude(shipped_at=None):
        if order.shipped_within_48h:
            on_time_orders += 1

    total_defects = sum(d.quantity for d in DefectEvent.objects.all())
    wrong_orders_n = (
        DefectEvent.objects.filter(defect_type__defect_code__icontains="wrong", order__isnull=False)
        .values("order")
        .distinct()
        .count()
    )

    correct_builds = max(total_orders - wrong_orders_n, 0)
    inventory_count = InventorySnapshot.objects.count()
    supplier_count = Supplier.objects.count()
    recommendation_count = OrderRecommendation.objects.count()

    daily_slice = list(DailyTarget.objects.order_by("-target_date")[:14])
    opp = 12
    p_opp = ForecastParameter.objects.filter(parameter_name="dpmo_opportunities_per_unit", is_active=True).first()
    if p_opp:
        try:
            opp = int(float(p_opp.parameter_value))
        except (TypeError, ValueError):
            opp = 12
    estimated_dpmo, _ = compute_dpmo_snapshot(total_defects, total_orders, shipped_orders, daily_slice, opp)

    return Response({
        "total_orders": total_orders,
        "shipped_orders": shipped_orders,
        "on_time_48h_rate": yield_rate(on_time_orders, shipped_orders),
        "total_defects": total_defects,
        "configuration_accuracy": configuration_accuracy(correct_builds, total_orders),
        "estimated_dpmo": estimated_dpmo,
        "inventory_records": inventory_count,
        "supplier_count": supplier_count,
        "recommendation_count": recommendation_count,
        "risk_level": "yellow",
    })
