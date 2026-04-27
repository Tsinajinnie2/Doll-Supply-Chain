"""
Demand forecast workbench: history → seasonally adjusted doll forecast → BOM → recommended orders.
"""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import date
from typing import Any

from supplychain.models import ForecastParameter, InventorySnapshot, MonthlyDollUnitSale, Part

# Quantities per fully assembled custom doll (configurable BOM for OptiDoll workbench).
QTY_PER_DOLL_BY_PART_TYPE: dict[str, int] = {
    "head": 1,
    "hair": 1,
    "eyes": 2,
    "arm": 2,
    "leg": 2,
    "torso": 1,
    "packaging": 1,
    "outfit": 0,
    "glasses": 0,
}


def _param_map() -> dict[str, str]:
    out = {}
    for p in ForecastParameter.objects.filter(is_active=True):
        out[p.parameter_name] = str(p.parameter_value or "")
    return out


def _float_param(params: dict[str, str], key: str, default: float) -> float:
    raw = params.get(key, "")
    try:
        return float(raw)
    except (TypeError, ValueError):
        return default


def _int_months(params: dict[str, str], key: str) -> set[int]:
    raw = params.get(key, "")
    out: set[int] = set()
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            m = int(part)
            if 1 <= m <= 12:
                out.add(m)
        except ValueError:
            continue
    return out


def _add_months(y: int, m: int, delta: int) -> tuple[int, int]:
    m0 = (y * 12 + (m - 1)) + delta
    return m0 // 12, (m0 % 12) + 1


def _parse_year_month(ym: str) -> tuple[int, int]:
    y, mo = ym.split("-", 1)
    return int(y), int(mo)


def _ym(y: int, m: int) -> str:
    return f"{y}-{m:02d}"


def _latest_inventory_by_part() -> dict[int, dict[str, Any]]:
    """Latest snapshot per part_id."""
    latest: dict[int, InventorySnapshot] = {}
    for snap in InventorySnapshot.objects.select_related("part").order_by("part_id", "-snapshot_date"):
        pid = snap.part_id
        if pid not in latest:
            latest[pid] = snap
    out = {}
    for pid, snap in latest.items():
        out[pid] = {
            "available_qty": snap.available_qty,
            "safety_stock_qty": snap.safety_stock_qty,
            "reorder_point_qty": snap.reorder_point_qty,
        }
    return out


def build_workbench_payload(*, forecast_horizon_months: int = 12) -> dict[str, Any]:
    params = _param_map()
    christmas_m = _int_months(params, "christmas_season_months") or {11, 12}
    easter_m = _int_months(params, "easter_season_months") or {3, 4}
    promo_m = _int_months(params, "mega_promo_months") or {1, 6}
    christmas_mult = _float_param(params, "christmas_season_lift_mult", 1.28)
    easter_mult = _float_param(params, "easter_season_lift_mult", 1.18)
    promo_mult = _float_param(params, "mega_promo_multiplier", 3.0)
    service = _float_param(params, "service_level_target", 0.95)
    lead_buf = int(_float_param(params, "lead_time_buffer_days", 15))

    history_rows = list(
        MonthlyDollUnitSale.objects.filter(is_active=True).order_by("year_month").values("year_month", "units_sold")
    )
    history = [{"year_month": r["year_month"], "units_sold": r["units_sold"]} for r in history_rows]

    if not history:
        return {
            "error": "no_history",
            "message": "Import doll_unit_sales_monthly.csv (MonthlyDollUnitSale) to enable forecasting.",
            "history": [],
            "forecast": [],
            "parts_plan": [],
            "parameters_used": {
                "christmas_season_months": sorted(christmas_m),
                "easter_season_months": sorted(easter_m),
                "mega_promo_months": sorted(promo_m),
                "christmas_season_lift_mult": christmas_mult,
                "easter_season_lift_mult": easter_mult,
                "mega_promo_multiplier": promo_mult,
            },
        }

    last_ym = history[-1]["year_month"]
    y0, m0 = _parse_year_month(last_ym)
    last_n = [h["units_sold"] for h in history[-3:]]
    baseline = sum(last_n) / max(len(last_n), 1)

    forecast: list[dict[str, Any]] = []
    for k in range(1, forecast_horizon_months + 1):
        y, m = _add_months(y0, m0, k)
        ym = _ym(y, m)
        mult = 1.0
        flags: dict[str, bool] = {
            "christmas_lift": False,
            "easter_lift": False,
            "mega_promo_jan_or_jun": False,
        }
        if m in christmas_m:
            mult *= christmas_mult
            flags["christmas_lift"] = True
        if m in easter_m:
            mult *= easter_mult
            flags["easter_lift"] = True
        if m in promo_m:
            mult *= promo_mult
            flags["mega_promo_jan_or_jun"] = True
        doll_units = max(0, int(round(baseline * mult)))
        forecast.append(
            {
                "year_month": ym,
                "doll_units_forecast": doll_units,
                "baseline_doll_units": round(baseline, 1),
                "combined_multiplier": round(mult, 4),
                "factors": flags,
            }
        )

    # Next month part demand (first month in horizon)
    next_doll = forecast[0]["doll_units_forecast"] if forecast else 0
    inv_by_part = _latest_inventory_by_part()

    parts = list(
        Part.objects.filter(is_active=True).values("id", "part_number", "part_name", "part_type")
    )
    by_type: dict[str, list[dict]] = defaultdict(list)
    for p in parts:
        by_type[p["part_type"]].append(p)

    parts_plan: list[dict[str, Any]] = []
    for part_type, qty_per_doll in QTY_PER_DOLL_BY_PART_TYPE.items():
        if qty_per_doll <= 0:
            continue
        skus = by_type.get(part_type, [])
        if not skus:
            continue
        type_month_need = next_doll * qty_per_doll
        n_skus = len(skus)
        per_sku_ceil = math.ceil(type_month_need / n_skus) if n_skus else 0
        for sku in sorted(skus, key=lambda x: x["part_number"]):
            pid = sku["id"]
            inv = inv_by_part.get(pid, {})
            avail = int(inv.get("available_qty", 0))
            safety = int(inv.get("safety_stock_qty", 0)) or max(5, int(per_sku_ceil * 0.15))
            rec = max(0, per_sku_ceil + safety - avail)
            parts_plan.append(
                {
                    "part_id": pid,
                    "part_number": sku["part_number"],
                    "part_name": sku["part_name"],
                    "part_type": part_type,
                    "qty_per_doll": qty_per_doll,
                    "next_month_part_demand": per_sku_ceil,
                    "available_qty": avail,
                    "safety_stock_qty": safety,
                    "recommended_order_qty": rec,
                }
            )

    horizon_doll_total = sum(f["doll_units_forecast"] for f in forecast)

    return {
        "as_of": date.today().isoformat(),
        "history_months": len(history),
        "last_actual_month": last_ym,
        "baseline_avg_last_3_months": round(baseline, 2),
        "forecast_horizon_months": forecast_horizon_months,
        "horizon_doll_units_total": horizon_doll_total,
        "history": history,
        "forecast": forecast,
        "parts_plan": sorted(parts_plan, key=lambda x: (x["part_type"], x["part_number"])),
        "methodology": (
            "Baseline = average of last 3 complete months of doll unit sales. "
            "Each future month: baseline × Christmas lift (Nov–Dec) × Easter lift (Mar–Apr) × mega promo (Jan & Jun, triple). "
            "Parts: BOM quantities per doll, demand split evenly across SKUs of each part type. "
            f"Recommended order ≈ next-month SKU need + safety stock − available (service level hint {service:.0%}, lead buffer {lead_buf}d in parameters)."
        ),
        "parameters_used": {
            "christmas_season_months": sorted(christmas_m),
            "easter_season_months": sorted(easter_m),
            "mega_promo_months": sorted(promo_m),
            "christmas_season_lift_mult": christmas_mult,
            "easter_season_lift_mult": easter_mult,
            "mega_promo_multiplier": promo_mult,
            "service_level_target": service,
            "lead_time_buffer_days": lead_buf,
        },
    }
