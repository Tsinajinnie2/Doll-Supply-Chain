import csv
import zipfile
from pathlib import Path
from datetime import datetime
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils.dateparse import parse_date, parse_datetime

from supplychain.models import (
    ProductOption,
    Part,
    Supplier,
    SupplierPart,
    InventorySnapshot,
    CustomerOrder,
    DailyTarget,
    WeeklyTarget,
    ForecastParameter,
    DefectType,
    RootCauseCode,
    ProcessStep,
)


class Command(BaseCommand):
    help = "Import dolls1 seed data from CSV ZIP."

    def add_arguments(self, parser):
        parser.add_argument(
            "--zip",
            type=str,
            default="seed_data/dolls1_seed_csv.zip",
            help="Path to dolls1 CSV ZIP file",
        )

    def handle(self, *args, **options):
        zip_path = Path(options["zip"])

        if not zip_path.exists():
            self.stderr.write(self.style.ERROR(f"File not found: {zip_path}"))
            return

        extract_dir = Path("seed_data/extracted")
        extract_dir.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(extract_dir)

        self.stdout.write(self.style.SUCCESS(f"Extracted CSV files to {extract_dir}"))

        self.import_product_options(extract_dir)
        self.import_parts(extract_dir)
        self.import_suppliers(extract_dir)
        self.import_inventory(extract_dir)
        self.import_orders(extract_dir)
        self.import_daily_targets(extract_dir)
        self.import_weekly_targets(extract_dir)
        self.import_forecast_parameters(extract_dir)
        self.import_six_sigma_basics()

        self.stdout.write(self.style.SUCCESS("Seed import completed."))

    def read_csv(self, folder, filename):
        path = folder / filename
        if not path.exists():
            self.stdout.write(self.style.WARNING(f"Missing file, skipped: {filename}"))
            return []

        with open(path, newline="", encoding="utf-8-sig") as f:
            return list(csv.DictReader(f))

    def to_int(self, value, default=0):
        try:
            if value in [None, ""]:
                return default
            return int(float(value))
        except ValueError:
            return default

    def to_decimal(self, value, default="0"):
        try:
            if value in [None, ""]:
                return Decimal(default)
            return Decimal(str(value))
        except Exception:
            return Decimal(default)

    def to_date(self, value):
        if not value:
            return None
        return parse_date(value[:10])

    def to_datetime(self, value):
        if not value:
            return None
        return parse_datetime(value)

    def import_product_options(self, folder):
        rows = self.read_csv(folder, "product_options.csv")

        for row in rows:
            ProductOption.objects.update_or_create(
                option_type=row.get("option_type"),
                option_code=row.get("option_code"),
                defaults={
                    "option_name": row.get("option_name", ""),
                    "is_active": True,
                },
            )

        self.stdout.write(self.style.SUCCESS(f"Imported product_options: {len(rows)}"))

    def import_parts(self, folder):
        rows = self.read_csv(folder, "part_master.csv")

        for row in rows:
            Part.objects.update_or_create(
                part_number=row.get("part_number"),
                defaults={
                    "part_name": row.get("part_name", ""),
                    "part_type": row.get("part_type", "head"),
                    "skin_tone": row.get("skin_tone") or None,
                    "face_shape": row.get("face_shape") or None,
                    "haircut": row.get("haircut") or None,
                    "hair_color": row.get("hair_color") or None,
                    "eye_color": row.get("eye_color") or None,
                    "outfit": row.get("outfit") or None,
                    "glasses": row.get("glasses") or None,
                    "unit_cost": self.to_decimal(row.get("unit_cost")),
                    "unit_weight_grams": self.to_decimal(row.get("unit_weight_grams")),
                    "defect_opportunities": self.to_int(row.get("defect_opportunities"), 1),
                    "is_active": True,
                },
            )

        self.stdout.write(self.style.SUCCESS(f"Imported part_master: {len(rows)}"))

    def import_suppliers(self, folder):
        rows = self.read_csv(folder, "supplier_master.csv")

        def truthy(val):
            return str(val or "").strip().lower() in ("1", "true", "yes")

        for row in rows:
            code = row.get("supplier_code") or row.get("supplier_id")
            if not code:
                continue
            Supplier.objects.update_or_create(
                supplier_code=code,
                defaults={
                    "supplier_name": row.get("supplier_name", ""),
                    "country": row.get("country", ""),
                    "iso_9001_current": truthy(
                        row.get("iso_9001_current") or row.get("cert_iso9001")
                    ),
                    "cpsia_current": truthy(row.get("cpsia_current") or row.get("cert_cpsc")),
                    "astm_f963_current": truthy(
                        row.get("astm_f963_current") or row.get("cert_astm_f963")
                    ),
                    "oeko_tex_current": truthy(
                        row.get("oeko_tex_current") or row.get("cert_oeko_tex")
                    ),
                    "foam_cert_current": truthy(
                        row.get("foam_cert_current") or row.get("cert_low_emission_foam")
                    ),
                    "certification_expiry": self.to_date(
                        row.get("certification_expiry") or row.get("cert_expiry_date")
                    ),
                    "supplier_score": self.to_decimal(row.get("supplier_score")),
                    "is_active": truthy(row.get("is_active", "True")),
                },
            )

        self.stdout.write(self.style.SUCCESS(f"Imported supplier_master: {len(rows)}"))

    def import_inventory(self, folder):
        rows = self.read_csv(folder, "inventory_snapshot.csv")
        imported = 0

        for row in rows:
            part_number = row.get("part_number")
            part = Part.objects.filter(part_number=part_number).first()
            if not part:
                continue

            InventorySnapshot.objects.update_or_create(
                part=part,
                snapshot_date=self.to_date(row.get("snapshot_date")),
                defaults={
                    "on_hand_qty": self.to_int(row.get("on_hand_qty")),
                    "allocated_qty": self.to_int(row.get("allocated_qty")),
                    "incoming_qty": self.to_int(row.get("incoming_qty")),
                    "safety_stock_qty": self.to_int(row.get("safety_stock_qty")),
                    "reorder_point_qty": self.to_int(row.get("reorder_point_qty")),
                },
            )
            imported += 1

        self.stdout.write(self.style.SUCCESS(f"Imported inventory_snapshot: {imported}"))

    def import_orders(self, folder):
        rows = self.read_csv(folder, "orders_history.csv")
        imported = 0

        for row in rows:
            order_number = row.get("order_number")
            if not order_number:
                continue

            CustomerOrder.objects.update_or_create(
                order_number=order_number,
                defaults={
                    "order_date": self.to_datetime(row.get("order_date")) or datetime.now(),
                    "promised_ship_by": self.to_datetime(row.get("promised_ship_by")),
                    "shipped_at": self.to_datetime(row.get("shipped_at")),
                    "skin_tone": row.get("skin_tone", ""),
                    "face_shape": row.get("face_shape", ""),
                    "haircut": row.get("haircut", ""),
                    "hair_color": row.get("hair_color", ""),
                    "eye_color": row.get("eye_color", ""),
                    "outfit": row.get("outfit", ""),
                    "glasses": row.get("glasses", ""),
                    "status": row.get("status", "received"),
                    "is_custom_build": True,
                },
            )
            imported += 1

        self.stdout.write(self.style.SUCCESS(f"Imported orders_history: {imported}"))

    def import_daily_targets(self, folder):
        rows = self.read_csv(folder, "daily_targets.csv")
        imported = 0

        for row in rows:
            target_date = self.to_date(row.get("target_date"))
            if not target_date:
                continue

            DailyTarget.objects.update_or_create(
                target_date=target_date,
                defaults={
                    "target_orders": self.to_int(row.get("target_orders")),
                    "target_assembled": self.to_int(row.get("target_assembled")),
                    "target_shipped": self.to_int(row.get("target_shipped")),
                    "actual_orders": self.to_int(row.get("actual_orders")),
                    "actual_assembled": self.to_int(row.get("actual_assembled")),
                    "actual_shipped": self.to_int(row.get("actual_shipped")),
                    "backlog_qty": self.to_int(row.get("backlog_qty")),
                },
            )
            imported += 1

        self.stdout.write(self.style.SUCCESS(f"Imported daily_targets: {imported}"))

    def import_weekly_targets(self, folder):
        rows = self.read_csv(folder, "weekly_targets.csv")
        imported = 0

        for row in rows:
            week_start = self.to_date(row.get("week_start"))
            if not week_start:
                continue

            WeeklyTarget.objects.update_or_create(
                week_start=week_start,
                defaults={
                    "week_end": self.to_date(row.get("week_end")),
                    "target_orders": self.to_int(row.get("target_orders")),
                    "target_assembled": self.to_int(row.get("target_assembled")),
                    "target_shipped": self.to_int(row.get("target_shipped")),
                    "actual_orders": self.to_int(row.get("actual_orders")),
                    "actual_assembled": self.to_int(row.get("actual_assembled")),
                    "actual_shipped": self.to_int(row.get("actual_shipped")),
                },
            )
            imported += 1

        self.stdout.write(self.style.SUCCESS(f"Imported weekly_targets: {imported}"))

    def import_forecast_parameters(self, folder):
        rows = self.read_csv(folder, "forecast_parameters.csv")

        for row in rows:
            active_raw = row.get("is_active", "True")
            is_active = str(active_raw).strip().lower() in ("1", "true", "yes")
            ForecastParameter.objects.update_or_create(
                parameter_name=row.get("parameter_name"),
                defaults={
                    "parameter_value": str(row.get("parameter_value", "")),
                    "parameter_type": row.get("parameter_type", "string"),
                    "effective_start": self.to_date(row.get("effective_start_date")),
                    "effective_end": self.to_date(row.get("effective_end_date")),
                    "notes": row.get("notes", ""),
                    "is_active": is_active,
                },
            )

        self.stdout.write(self.style.SUCCESS(f"Imported forecast_parameters: {len(rows)}"))

    def import_six_sigma_basics(self):
        defect_types = [
            ("wrong_assembly", "Wrong Assembly"),
            ("missing_component", "Missing Component"),
            ("damaged_return", "Damaged Return"),
            ("cosmetic_defect", "Cosmetic Defect"),
            ("late_shipment", "Late Shipment"),
            ("packaging_error", "Packaging Error"),
        ]

        root_causes = [
            ("wrong_bin", "Wrong Part in Bin"),
            ("training_gap", "Training Gap"),
            ("supplier_defect", "Supplier Defect"),
            ("rush_overload", "Rush / Capacity Overload"),
            ("system_error", "System or Data Error"),
            ("tool_misalignment", "Tool or Jig Misalignment"),
        ]

        process_steps = [
            ("pick", "Picking / Kitting", 1),
            ("assemble", "Assembly", 2),
            ("inspect", "Inspection", 3),
            ("pack", "Packaging", 4),
            ("ship", "Shipping", 5),
        ]

        for code, name in defect_types:
            DefectType.objects.update_or_create(
                defect_code=code,
                defaults={"defect_name": name},
            )

        for code, name in root_causes:
            RootCauseCode.objects.update_or_create(
                cause_code=code,
                defaults={"cause_name": name},
            )

        for code, name, seq in process_steps:
            ProcessStep.objects.update_or_create(
                step_code=code,
                defaults={"step_name": name, "sequence": seq},
            )

        self.stdout.write(self.style.SUCCESS("Imported Six Sigma baseline tables"))
