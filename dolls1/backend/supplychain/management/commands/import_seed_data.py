import csv
import zipfile
from pathlib import Path
from datetime import datetime, timedelta
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
    MonthlyDollUnitSale,
    DefectType,
    RootCauseCode,
    ProcessStep,
    CapaCase,
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
        self.import_supplier_parts(extract_dir)
        self.import_inventory(extract_dir)
        self.import_orders(extract_dir)
        self.import_daily_targets(extract_dir)
        self.import_weekly_targets(extract_dir)
        self.import_forecast_parameters(extract_dir)
        self.import_doll_unit_sales_monthly(extract_dir)
        self.import_six_sigma_basics()
        self.import_capa_cases(extract_dir)

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

    def to_decimal_optional(self, value):
        try:
            if value in [None, ""]:
                return None
            return Decimal(str(value))
        except Exception:
            return None

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

    def _part_type_from_master_row(self, row):
        raw = (row.get("part_type") or row.get("part_family") or "head").strip().lower()
        sku = (row.get("part_number") or row.get("part_sku") or "").upper()
        if raw == "limb":
            if "LEG_" in sku or sku.startswith("LEG"):
                return "leg"
            return "arm"
        return raw

    def import_parts(self, folder):
        rows = self.read_csv(folder, "part_master.csv")

        for row in rows:
            part_number = row.get("part_number") or row.get("part_sku")
            if not part_number:
                continue
            part_name = row.get("part_name") or row.get("description") or ""
            part_type = self._part_type_from_master_row(row)
            weight_g = row.get("unit_weight_grams")
            if weight_g in (None, ""):
                kg = row.get("unit_weight_kg")
                weight_g = float(kg) * 1000 if kg not in (None, "") else 0
            unit_cost = row.get("unit_cost") or row.get("unit_cost_usd") or 0
            Part.objects.update_or_create(
                part_number=part_number,
                defaults={
                    "part_name": part_name,
                    "part_type": part_type,
                    "skin_tone": row.get("skin_tone") or None,
                    "face_shape": row.get("face_shape") or None,
                    "haircut": row.get("haircut") or None,
                    "hair_color": row.get("hair_color") or None,
                    "eye_color": row.get("eye_color") or None,
                    "outfit": row.get("outfit") or None,
                    "glasses": row.get("glasses") or None,
                    "unit_cost": self.to_decimal(unit_cost),
                    "unit_weight_grams": self.to_decimal(weight_g),
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

    def import_supplier_parts(self, folder):
        rows = self.read_csv(folder, "supplier_parts.csv")
        if not rows:
            self.stdout.write(self.style.WARNING("Missing or empty supplier_parts.csv — skipped."))
            return

        def truthy(val):
            return str(val or "").strip().lower() in ("1", "true", "yes")

        imported = 0
        for row in rows:
            code = (row.get("supplier_code") or "").strip()
            pn = (row.get("part_number") or "").strip()
            if not code or not pn:
                continue
            part = Part.objects.filter(part_number=pn).first()
            supplier = Supplier.objects.filter(supplier_code=code).first()
            if not part or not supplier:
                continue
            SupplierPart.objects.update_or_create(
                part=part,
                supplier=supplier,
                defaults={
                    "supplier_part_number": (row.get("supplier_part_number") or f"{pn}-{code}")[:100],
                    "base_cost": self.to_decimal(row.get("base_cost")),
                    "shipping_cost_per_unit": self.to_decimal(row.get("shipping_cost_per_unit") or 0),
                    "tariff_rate": self.to_decimal(row.get("tariff_rate") or 0),
                    "lead_time_days_mean": self.to_decimal(row.get("lead_time_days_mean") or 14),
                    "lead_time_days_std": self.to_decimal(row.get("lead_time_days_std") or 3),
                    "minimum_order_quantity": self.to_int(row.get("minimum_order_quantity"), 1),
                    "order_multiple": self.to_int(row.get("order_multiple"), 1),
                    "capacity_per_month": self.to_int(row.get("capacity_per_month"), 5000),
                    "is_primary": truthy(row.get("is_primary", "False")),
                },
            )
            imported += 1

        self.stdout.write(self.style.SUCCESS(f"Imported supplier_parts: {imported}"))

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

            tgt_o = row.get("target_orders")
            tgt_a = row.get("target_assembled")
            tgt_s = row.get("target_shipped")
            act_s = row.get("actual_shipped")
            backlog = row.get("backlog_qty")

            DailyTarget.objects.update_or_create(
                target_date=target_date,
                defaults={
                    "target_orders": self.to_int(tgt_o if tgt_o not in (None, "") else row.get("daily_order_target")),
                    "target_assembled": self.to_int(tgt_a if tgt_a not in (None, "") else row.get("daily_assembly_target")),
                    "target_shipped": self.to_int(tgt_s if tgt_s not in (None, "") else row.get("daily_ship_target")),
                    "actual_orders": self.to_int(row.get("actual_orders")),
                    "actual_assembled": self.to_int(row.get("actual_assembled")),
                    "actual_shipped": self.to_int(act_s if act_s not in (None, "") else row.get("actual_shipped_48h")),
                    "backlog_qty": self.to_int(backlog if backlog not in (None, "") else row.get("backlog_eod")),
                    "on_time_ship_rate": self.to_decimal_optional(row.get("on_time_ship_rate")),
                    "season_window": (row.get("season_window") or "")[:40],
                },
            )
            imported += 1

        self.stdout.write(self.style.SUCCESS(f"Imported daily_targets: {imported}"))

    def import_weekly_targets(self, folder):
        rows = self.read_csv(folder, "weekly_targets.csv")
        imported = 0

        for row in rows:
            week_start = self.to_date(row.get("week_start") or row.get("week_start_date"))
            if not week_start:
                continue

            week_end = self.to_date(row.get("week_end"))
            if not week_end:
                week_end = week_start + timedelta(days=6)

            wt_o = row.get("target_orders")
            act_s = row.get("actual_shipped")

            WeeklyTarget.objects.update_or_create(
                week_start=week_start,
                defaults={
                    "week_end": week_end,
                    "target_orders": self.to_int(wt_o if wt_o not in (None, "") else row.get("weekly_order_target")),
                    "target_assembled": self.to_int(
                        row.get("target_assembled") if row.get("target_assembled") not in (None, "") else row.get("weekly_assembly_target")
                    ),
                    "target_shipped": self.to_int(
                        row.get("target_shipped") if row.get("target_shipped") not in (None, "") else row.get("weekly_ship_target")
                    ),
                    "actual_orders": self.to_int(row.get("actual_orders")),
                    "actual_assembled": self.to_int(
                        row.get("actual_assembled") if row.get("actual_assembled") not in (None, "") else row.get("actual_assembled")
                    ),
                    "actual_shipped": self.to_int(act_s if act_s not in (None, "") else row.get("actual_shipped_48h")),
                    "on_time_ship_rate": self.to_decimal_optional(row.get("on_time_ship_rate")),
                    "ending_backlog": self.to_int(row.get("ending_backlog")),
                },
            )
            imported += 1

        self.stdout.write(self.style.SUCCESS(f"Imported weekly_targets: {imported}"))

    def import_capa_cases(self, folder):
        rows = self.read_csv(folder, "capa_cases.csv")
        if not rows:
            self.stdout.write(self.style.WARNING("Missing capa_cases.csv — skipped."))
            return
        imported = 0
        status_map = {
            "verified": "closed",
            "closed": "closed",
            "open": "open",
            "in_progress": "in_progress",
        }
        for row in rows:
            capa_id = (row.get("capa_id") or row.get("capa_number") or "").strip()
            opened = self.to_date(row.get("opened_date"))
            if not capa_id or not opened:
                continue
            raw_status = (row.get("status") or "open").strip().lower()
            status = status_map.get(raw_status, "open")
            eff_raw = row.get("effectiveness_verified_flag", "False")
            effectiveness = str(eff_raw).strip().lower() in ("1", "true", "yes")
            defect = (row.get("defect_type") or "issue").replace("_", " ").title()
            rc = (row.get("root_cause_code") or "—").replace("_", " ")
            owner = row.get("owner_role") or "—"
            CapaCase.objects.update_or_create(
                capa_number=capa_id,
                defaults={
                    "opened_date": opened,
                    "due_date": self.to_date(row.get("due_date")),
                    "title": f"{defect} — {rc}",
                    "problem_statement": f"Defect pattern: {defect}. Suspected root cause: {rc}. Owner role: {owner}.",
                    "corrective_action": (row.get("corrective_action") or "")[:2000],
                    "status": status,
                    "effectiveness_verified": effectiveness,
                },
            )
            imported += 1
        self.stdout.write(self.style.SUCCESS(f"Imported capa_cases: {imported}"))

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

    def import_doll_unit_sales_monthly(self, folder):
        rows = self.read_csv(folder, "doll_unit_sales_monthly.csv")
        if not rows:
            self.stdout.write(self.style.WARNING("Missing doll_unit_sales_monthly.csv — skipped."))
            return
        imported = 0
        for row in rows:
            ym = (row.get("year_month") or "").strip()
            if not ym:
                continue
            MonthlyDollUnitSale.objects.update_or_create(
                year_month=ym,
                defaults={
                    "units_sold": self.to_int(row.get("units_sold"), 0),
                    "notes": (row.get("notes") or "")[:200],
                    "is_active": True,
                },
            )
            imported += 1
        self.stdout.write(self.style.SUCCESS(f"Imported doll_unit_sales_monthly: {imported}"))

    def import_six_sigma_basics(self):
        defect_types = [
            ("wrong_assembly", "Wrong Assembly"),
            ("wrongly_assembled", "Wrong Assembly"),
            ("missing_component", "Missing Component"),
            ("damaged_return", "Damaged Return"),
            ("cosmetic_defect", "Cosmetic Defect"),
            ("late_shipment", "Late Shipment"),
            ("packaging_error", "Packaging Error"),
            ("hair_detachment", "Hair Detachment"),
            ("torso_seam_defect", "Torso Seam Defect"),
        ]

        root_causes = [
            ("wrong_bin", "Wrong Part in Bin"),
            ("training_gap", "Training Gap"),
            ("supplier_defect", "Supplier Defect"),
            ("supplier_variation", "Supplier Variation"),
            ("rush_overload", "Rush / Capacity Overload"),
            ("system_error", "System or Data Error"),
            ("tool_misalignment", "Tool or Jig Misalignment"),
            ("tool_jig_issue", "Tool or Jig Issue"),
            ("unclear_work_instruction", "Unclear Work Instruction"),
            ("shipping_damage", "Shipping Damage"),
        ]

        process_steps = [
            ("pick", "Picking / Kitting", 1),
            ("kitting", "Picking / Kitting", 1),
            ("assemble", "Assembly", 2),
            ("assembly", "Assembly", 2),
            ("inspect", "Inspection", 3),
            ("inspection", "Inspection", 3),
            ("pack", "Packaging", 4),
            ("packaging", "Packaging", 4),
            ("ship", "Shipping", 5),
            ("shipping", "Shipping", 5),
            ("customer_return", "Customer Return", 6),
            ("torso", "Torso", 7),
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
