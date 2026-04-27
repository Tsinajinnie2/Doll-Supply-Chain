"""
Write CSV analytics for Supplier Risk → Frequent Supplier:

1) part_frequent_supplier_last_fy.csv — simulated “most used” supplier per part for last closed FY.
2) part_price_shipping_history_4y.csv — four calendar years of unit base, shipping, and total
   (base + shipping) for that frequent supplier, anchored to existing supplier_parts.csv prices
   for the latest year.

Outputs:
  - data/dolls1_seed_csv/<files>
  - dolls1/frontend/public/dolls1_seed/<files> (for Vite static fetch)

Re-run after regenerating supplier_parts.csv.
"""

from __future__ import annotations

import csv
import hashlib
from collections import defaultdict
from pathlib import Path

from django.core.management.base import BaseCommand

from supplychain import catalog_parts

REPO_ROOT = Path(__file__).resolve().parents[5]
DATA_CSV = REPO_ROOT / "data" / "dolls1_seed_csv"
PUBLIC_OUT = REPO_ROOT / "dolls1" / "frontend" / "public" / "dolls1_seed"

# “Last fiscal year” label (simulated). April 2026 → treat last closed FY as FY2025 (Oct 2024–Sep 2025).
FY_LABEL = "FY2025_closed_simulated"
CALENDAR_YEARS = (2023, 2024, 2025, 2026)
ANCHOR_YEAR = 2026


def _h(part: str, *parts: str) -> int:
    return int(hashlib.md5("|".join((part,) + parts).encode("utf-8"), usedforsecurity=False).hexdigest(), 16)


def _load_part_names() -> dict[str, str]:
    names: dict[str, str] = {}
    for r in catalog_parts.build_catalog_rows():
        names[r["part_number"]] = r["part_name"]
    # Torso BOM SKU from seed
    names["TORSO_COMPLETED"] = "Completed soft torso"
    return names


def _load_supplier_names() -> dict[str, str]:
    out: dict[str, str] = {}
    path = DATA_CSV / "supplier_master.csv"
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            code = (row.get("supplier_id") or row.get("supplier_code") or "").strip()
            if code:
                out[code] = (row.get("supplier_name") or "").strip()
    return out


def _year_price_factor(part: str, sup: str, year: int, kind: str) -> float:
    if year == ANCHOR_YEAR:
        return 1.0
    idx = year - CALENDAR_YEARS[0]
    ramp = (0.78, 0.86, 0.93)[idx]
    jitter = (_h(part, sup, str(year), kind) % 900) / 10000.0
    return min(ramp + jitter, 0.995)


class Command(BaseCommand):
    help = "Emit frequent-supplier + 4y price/shipping CSVs from supplier_parts.csv (simulated FY usage)."

    def handle(self, *args, **options):
        part_names = _load_part_names()
        supplier_names = _load_supplier_names()

        sp_path = DATA_CSV / "supplier_parts.csv"
        by_part: dict[str, list[dict]] = defaultdict(list)
        with open(sp_path, newline="", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                pn = (row.get("part_number") or "").strip()
                if pn:
                    by_part[pn].append(row)

        frequent_rows: list[dict] = []
        history_rows: list[dict] = []

        for part_number in sorted(by_part.keys(), key=lambda x: (x != "TORSO_COMPLETED", x)):
            rows = by_part[part_number]
            part_name = part_names.get(part_number, part_number)
            best_row = None
            best_w = -1
            weights: list[tuple[dict, int]] = []
            for r in rows:
                code = (r.get("supplier_code") or "").strip()
                w = 400 + (_h(part_number, code, FY_LABEL, "vol") % 9600)
                weights.append((r, w))
                if w > best_w:
                    best_w = w
                    best_row = r
            total_w = sum(w for _, w in weights)
            assert best_row is not None
            winner_code = (best_row.get("supplier_code") or "").strip()
            winner_name = supplier_names.get(winner_code, winner_code)
            pct = round(100.0 * best_w / total_w, 2) if total_w else 0.0

            frequent_rows.append(
                {
                    "part_number": part_number,
                    "part_name": part_name,
                    "fiscal_year_label": FY_LABEL,
                    "frequent_supplier_code": winner_code,
                    "frequent_supplier_name": winner_name,
                    "simulated_order_lines_last_fy": best_w,
                    "simulated_share_of_part_volume_pct": f"{pct:.2f}",
                }
            )

            base_anchor = float(best_row.get("base_cost") or 0)
            ship_anchor = float(best_row.get("shipping_cost_per_unit") or 0)

            for year in CALENDAR_YEARS:
                fb = _year_price_factor(part_number, winner_code, year, "base")
                fs = _year_price_factor(part_number, winner_code, year, "ship")
                base_y = round(base_anchor * fb, 4)
                ship_y = round(ship_anchor * fs, 4)
                if year == ANCHOR_YEAR:
                    base_y = round(base_anchor, 4)
                    ship_y = round(ship_anchor, 4)
                total_y = round(base_y + ship_y, 4)
                history_rows.append(
                    {
                        "part_number": part_number,
                        "part_name": part_name,
                        "frequent_supplier_code": winner_code,
                        "calendar_year": str(year),
                        "unit_base_cost_usd": f"{base_y:.4f}",
                        "shipping_per_unit_usd": f"{ship_y:.4f}",
                        "total_unit_usd": f"{total_y:.4f}",
                    }
                )

        freq_fields = [
            "part_number",
            "part_name",
            "fiscal_year_label",
            "frequent_supplier_code",
            "frequent_supplier_name",
            "simulated_order_lines_last_fy",
            "simulated_share_of_part_volume_pct",
        ]
        hist_fields = [
            "part_number",
            "part_name",
            "frequent_supplier_code",
            "calendar_year",
            "unit_base_cost_usd",
            "shipping_per_unit_usd",
            "total_unit_usd",
        ]

        freq_name = "part_frequent_supplier_last_fy.csv"
        hist_name = "part_price_shipping_history_4y.csv"

        for folder in (DATA_CSV, PUBLIC_OUT):
            folder.mkdir(parents=True, exist_ok=True)
            with open(folder / freq_name, "w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=freq_fields)
                w.writeheader()
                w.writerows(frequent_rows)
            with open(folder / hist_name, "w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=hist_fields)
                w.writeheader()
                w.writerows(history_rows)

        self.stdout.write(
            self.style.SUCCESS(
                f"Wrote {len(frequent_rows)} + {len(history_rows)} rows to {DATA_CSV} and {PUBLIC_OUT}"
            )
        )
