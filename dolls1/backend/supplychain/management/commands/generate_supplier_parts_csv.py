"""
Generate data/dolls1_seed_csv/supplier_parts.csv: unit base_cost per supplier-part pair.

Parts included: **only** the current unified SKU-OPT catalog (`catalog_parts.build_catalog_rows()`),
plus **TORSO_COMPLETED** for torso suppliers — not legacy part_master SKUs.

Pricing bands (deterministic pseudo-random per supplier_code + part_number):
  arm 2–4 USD, leg 1.75–3, head 10–22, hair 5–15, eyes 2–7.25, torso 47.75, packaging 20–32.

Tariff column ``tariff_rate`` is a **seeded proxy** from country baselines + noise — not a live feed
and not from ML inference on real-time customs data. For production, replace via integration with
your trade-data provider and re-run this generator or ETL.
"""

from __future__ import annotations

import csv
import hashlib
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from django.core.management.base import BaseCommand

from supplychain import catalog_parts

REPO_DATA = Path(__file__).resolve().parents[5] / "data" / "dolls1_seed_csv"

# Approx. road-ish / great-circle miles from Logan, UT 84321 to supplier country (planning proxy).
LOGAN_MILES_BY_COUNTRY: dict[str, int] = {
    "usa": 420,
    "us": 420,
    "united states": 420,
    "canada": 1100,
    "mexico": 1580,
    "china": 6350,
    "japan": 5480,
    "india": 7920,
    "pakistan": 7280,
    "uk": 4680,
    "united kingdom": 4680,
    "indonesia": 8760,
    "vietnam": 7820,
    "bangladesh": 7880,
    "thailand": 8080,
    "germany": 5120,
}

MINIMAL_LOT_CHOICES = (
    12,
    24,
    36,
    48,
    60,
    72,
    96,
    100,
    120,
    144,
    168,
    200,
    250,
    300,
    400,
    500,
)


def _norm_country_key(country: str) -> str:
    return (country or "").strip().lower()


def _miles_from_logan(country: str, supplier_code: str) -> int:
    k = _norm_country_key(country)
    base = LOGAN_MILES_BY_COUNTRY.get(k, 5200)
    h = int(hashlib.md5(f"{supplier_code}|dist|{k}".encode("utf-8"), usedforsecurity=False).hexdigest(), 16)
    jitter = (h % 501) - 250
    if k in ("usa", "us", "united states"):
        base = 200 + (h % 1800)
    return max(25, base + jitter)


def _shipping_from_distance(distance_mi: float, row_key: str) -> float:
    """Pseudo-random shipping $/unit, weakly scaled by distance."""
    h = int(hashlib.md5(row_key.encode("utf-8"), usedforsecurity=False).hexdigest(), 16)
    noise = (h % 10001) / 10001.0
    base = 0.08 + (min(distance_mi, 9000) / 9000.0) * 1.85
    span = 0.12 + noise * 1.15
    return float(Decimal(str(base + span * 0.6)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _minimal_lot(supplier_code: str, part_number: str) -> int:
    h = int(hashlib.md5(f"{supplier_code}|{part_number}|lot".encode("utf-8"), usedforsecurity=False).hexdigest(), 16)
    return MINIMAL_LOT_CHOICES[h % len(MINIMAL_LOT_CHOICES)]


def _tariff_proxy(country: str, supplier_code: str, part_number: str, seed_csv_tariff: float) -> float:
    """Blended proxy (0–1 scale) — not real-time customs."""
    k = _norm_country_key(country)
    h = int(hashlib.md5(f"{supplier_code}|{part_number}|tariff|{k}".encode("utf-8"), usedforsecurity=False).hexdigest(), 16)
    noise = 0.82 + (h % 361) / 1000.0
    blended = max(0.0, min(0.55, float(seed_csv_tariff) * noise))
    return float(Decimal(str(blended)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))


def _brand_strength(supplier_code: str) -> int:
    h = int(hashlib.md5(f"{supplier_code}|brand".encode("utf-8"), usedforsecurity=False).hexdigest(), 16)
    return 18 + (h % 82)


def _quality_consistency_pct(supplier_code: str, part_number: str) -> float:
    return _stable_price(73.0, 99.1, f"{supplier_code}|{part_number}|qoh")


def _stable_price(lo: float, hi: float, key: str) -> float:
    h = int(hashlib.md5(key.encode("utf-8"), usedforsecurity=False).hexdigest(), 16)
    t = (h % 10001) / 10001.0
    v = lo + (hi - lo) * t
    return float(Decimal(str(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _unit_price(part_type: str, sup_code: str, part_num: str) -> float:
    key = f"{sup_code}|{part_num}"
    if part_type == "arm":
        return _stable_price(2.0, 4.0, key)
    if part_type == "leg":
        return _stable_price(1.75, 3.0, key)
    if part_type == "head":
        return _stable_price(10.0, 22.0, key)
    if part_type == "hair":
        return _stable_price(5.0, 15.0, key)
    if part_type == "eyes":
        return _stable_price(2.0, 7.25, key)
    if part_type == "torso":
        return 47.75
    if part_type == "packaging":
        return _stable_price(20.0, 32.0, key)
    return _stable_price(2.0, 4.0, key)


def _supplier_matches_family(sfamily: str, ptype: str) -> bool:
    s = (sfamily or "").strip().lower()
    if s == "limb":
        return ptype in ("arm", "leg")
    return s == ptype


# Torso SKU lives in part_master for BOM imports; priced here for torso-family suppliers only.
TORSO_CATALOG_PART: tuple[str, str] = ("TORSO_COMPLETED", "torso")


class Command(BaseCommand):
    help = "Write supplier_parts.csv with base_cost (unit price) for each supplier–part pairing."

    def handle(self, *args, **options):
        parts: list[tuple[str, str]] = []
        seen: set[str] = set()
        for r in catalog_parts.build_catalog_rows():
            pn = r["part_number"]
            pt = r["part_type"]
            if pn not in seen:
                seen.add(pn)
                parts.append((pn, pt))
        pn, pt = TORSO_CATALOG_PART
        if pn not in seen:
            seen.add(pn)
            parts.append((pn, pt))

        suppliers: list[tuple[str, str, str, str]] = []
        with open(REPO_DATA / "supplier_master.csv", newline="", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                code = (row.get("supplier_id") or row.get("supplier_code") or "").strip()
                fam = (row.get("part_family") or "").strip()
                tr = row.get("base_tariff_rate") or "0"
                ctry = (row.get("country") or "").strip()
                if code:
                    suppliers.append((code, fam, tr, ctry))

        out_rows: list[dict] = []
        for sup_code, sfam, strf, country in suppliers:
            try:
                trf_seed = float(strf)
            except ValueError:
                trf_seed = 0.0
            dist_mi = _miles_from_logan(country, sup_code)
            brand = _brand_strength(sup_code)
            for pn, ptype in parts:
                if not _supplier_matches_family(sfam, ptype):
                    continue
                price = _unit_price(ptype, sup_code, pn)
                row_key = f"{sup_code}|{pn}|ship"
                ship = _shipping_from_distance(float(dist_mi), row_key)
                lot = _minimal_lot(sup_code, pn)
                tariff_eff = _tariff_proxy(country, sup_code, pn, trf_seed)
                q_pct = _quality_consistency_pct(sup_code, pn)
                moq = max(lot, int(lot * (1.2 + (int(hashlib.md5(row_key.encode(), usedforsecurity=False).hexdigest(), 16) % 5) * 0.1)))
                out_rows.append(
                    {
                        "supplier_code": sup_code,
                        "part_number": pn,
                        "base_cost": f"{price:.2f}",
                        "distance_miles_from_logan_ut_84321": str(dist_mi),
                        "shipping_cost_per_unit": f"{ship:.2f}",
                        "tariff_rate": str(tariff_eff),
                        "tariff_proxy_note": "seeded_country_baseline_not_live_ml",
                        "minimal_lot_restriction_units": str(lot),
                        "brand_strength_0_100": str(brand),
                        "quality_consistency_prior_tx_pct": f"{q_pct:.2f}",
                        "is_primary": "False",
                        "supplier_part_number": f"{pn}-{sup_code}",
                        "minimum_order_quantity": str(moq),
                        "order_multiple": "10",
                        "capacity_per_month": "8000",
                        "lead_time_days_mean": "14",
                        "lead_time_days_std": "3",
                    }
                )

        by_part: dict[str, list[dict]] = {}
        for r in out_rows:
            by_part.setdefault(r["part_number"], []).append(r)
        for lst in by_part.values():
            lst.sort(key=lambda x: x["supplier_code"])
            lst[0]["is_primary"] = "True"

        out_path = REPO_DATA / "supplier_parts.csv"
        fieldnames = [
            "supplier_code",
            "part_number",
            "base_cost",
            "distance_miles_from_logan_ut_84321",
            "shipping_cost_per_unit",
            "tariff_rate",
            "tariff_proxy_note",
            "minimal_lot_restriction_units",
            "brand_strength_0_100",
            "quality_consistency_prior_tx_pct",
            "is_primary",
            "supplier_part_number",
            "minimum_order_quantity",
            "order_multiple",
            "capacity_per_month",
            "lead_time_days_mean",
            "lead_time_days_std",
        ]
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            for r in sorted(out_rows, key=lambda x: (x["part_number"], x["supplier_code"])):
                w.writerow({k: r[k] for k in fieldnames})

        self.stdout.write(self.style.SUCCESS(f"Wrote {len(out_rows)} rows to {out_path}"))
