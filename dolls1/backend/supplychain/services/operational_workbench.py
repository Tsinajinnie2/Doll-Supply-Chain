"""
Unified operational + quality snapshot for Orders, Quality / Six Sigma, and Settings pages.
"""
from __future__ import annotations

import csv
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

from django.conf import settings

from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth

from supplychain.models import (
    CapaCase,
    CustomerOrder,
    DailyTarget,
    DefectEvent,
    DefectType,
    ForecastParameter,
    QualityCost,
    ReturnEvent,
    WeeklyTarget,
)
from supplychain.services.six_sigma import configuration_accuracy, dpmo, yield_rate


def _seed_csv_dir() -> Path:
    base = Path(settings.BASE_DIR)
    repo_data = base.parent.parent / "data" / "dolls1_seed_csv"
    if repo_data.is_dir():
        return repo_data
    return base / "seed_data" / "extracted"


def _quality_pareto_from_csv() -> list[dict]:
    path = _seed_csv_dir() / "quality_events.csv"
    if not path.exists():
        return []
    buckets: dict[str, int] = defaultdict(int)
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            label = (row.get("defect_type") or "unknown").replace("_", " ").title()
            try:
                buckets[label] += int(float(row.get("defect_count") or 0))
            except (TypeError, ValueError):
                continue
    items = sorted(buckets.items(), key=lambda x: -x[1])
    return [{"label": k, "count": v} for k, v in items[:16]]


def _defect_pareto_db() -> list[dict]:
    rows = (
        DefectEvent.objects.values("defect_type__defect_name")
        .annotate(count=Sum("quantity"))
        .order_by("-count")[:16]
    )
    out = [{"label": r["defect_type__defect_name"] or "—", "count": r["count"] or 0} for r in rows]
    return [x for x in out if x["count"] > 0]


def _root_causes_db() -> list[dict]:
    rows = (
        DefectEvent.objects.filter(root_cause__isnull=False)
        .values("root_cause__cause_name")
        .annotate(count=Sum("quantity"))
        .order_by("-count")[:14]
    )
    return [{"label": r["root_cause__cause_name"] or "—", "count": r["count"] or 0} for r in rows if r["count"]]


def _forecast_parameter_map() -> tuple[list[dict], dict]:
    params = list(ForecastParameter.objects.filter(is_active=True).values())
    pmap: dict = {}
    for p in params:
        name = p["parameter_name"]
        raw = p["parameter_value"]
        ptype = (p.get("parameter_type") or "string").lower()
        try:
            if ptype in ("float", "decimal"):
                pmap[name] = float(raw)
            elif ptype == "integer":
                pmap[name] = int(float(raw))
            else:
                pmap[name] = raw
        except (TypeError, ValueError):
            pmap[name] = raw
    return params, pmap


def _serialize_daily(d: DailyTarget) -> dict:
    return {
        "target_date": d.target_date.isoformat(),
        "target_orders": d.target_orders,
        "actual_orders": d.actual_orders,
        "target_assembled": d.target_assembled,
        "actual_assembled": d.actual_assembled,
        "target_shipped": d.target_shipped,
        "actual_shipped": d.actual_shipped,
        "backlog_qty": d.backlog_qty,
        "on_time_ship_rate": float(d.on_time_ship_rate) if d.on_time_ship_rate is not None else None,
        "season_window": d.season_window or None,
    }


def _serialize_weekly(w: WeeklyTarget) -> dict:
    return {
        "week_start": w.week_start.isoformat(),
        "week_end": w.week_end.isoformat(),
        "target_orders": w.target_orders,
        "actual_orders": w.actual_orders,
        "target_assembled": w.target_assembled,
        "actual_assembled": w.actual_assembled,
        "target_shipped": w.target_shipped,
        "actual_shipped": w.actual_shipped,
        "ending_backlog": w.ending_backlog,
        "on_time_ship_rate": float(w.on_time_ship_rate) if w.on_time_ship_rate is not None else None,
    }


def compute_dpmo_snapshot(
    total_defect_units: int,
    total_orders: int,
    shipped_n: int,
    daily_slice: list[DailyTarget],
    opportunities_per_unit: int,
) -> tuple[float, dict]:
    """
    DPMO = defects / (doll-unit throughput × opportunities per unit) × 1e6.

    Throughput uses max(lifetime orders, lifetime shipped, sum of recent daily assembly/order
    volume, defect units, 1) so a thin CustomerOrder table does not explode DPMO when
    DailyTarget rows reflect real doll output.
    """
    opp = max(int(opportunities_per_unit or 12), 1)
    defect_u = int(total_defect_units)
    u_o = max(int(total_orders), 0)
    u_s = max(int(shipped_n), 0)
    recent_throughput = 0
    for d in daily_slice or []:
        aa = int(d.actual_assembled or 0)
        ao = int(d.actual_orders or 0)
        recent_throughput += max(aa, ao)
    units = max(u_o, u_s, 1, recent_throughput)
    if defect_u > 0:
        units = max(units, defect_u)
    est = float(dpmo(defect_u, units, opp))
    basis = {
        "order_count": u_o,
        "shipped_count": u_s,
        "recent_throughput_units": int(recent_throughput),
        "units_for_dpmo": int(units),
        "defect_units": defect_u,
        "opportunities_per_unit": opp,
    }
    return est, basis


def build_operational_payload() -> dict:
    params, pmap = _forecast_parameter_map()

    daily_qs = list(DailyTarget.objects.order_by("-target_date")[:14])
    daily_ops = [_serialize_daily(d) for d in reversed(daily_qs)]

    weekly_qs = list(WeeklyTarget.objects.order_by("-week_start")[:8])
    weekly_ops = [_serialize_weekly(w) for w in reversed(weekly_qs)]

    total_orders = CustomerOrder.objects.count()
    shipped_qs = CustomerOrder.objects.exclude(shipped_at=None)
    shipped_n = shipped_qs.count()
    on_time_n = sum(1 for o in shipped_qs.iterator(chunk_size=500) if o.shipped_within_48h)
    on_time_48h_rate = yield_rate(on_time_n, shipped_n) if shipped_n else 0.0

    latest_backlog = daily_qs[0].backlog_qty if daily_qs else 0

    total_defect_units = sum(d.quantity for d in DefectEvent.objects.all())
    wrong_orders_n = (
        DefectEvent.objects.filter(defect_type__defect_code__icontains="wrong", order__isnull=False)
        .values("order")
        .distinct()
        .count()
    )
    correct_builds = max(total_orders - wrong_orders_n, 0)
    conf_acc = configuration_accuracy(correct_builds, total_orders) if total_orders else 0.0
    opp = int(pmap.get("dpmo_opportunities_per_unit") or 12)
    est_dpmo, dpmo_basis = compute_dpmo_snapshot(
        int(total_defect_units), total_orders, shipped_n, daily_qs, opp
    )
    process_yield = yield_rate(max(total_orders - total_defect_units, 0), max(total_orders, 1))

    pareto = _defect_pareto_db()
    if not pareto:
        pareto = _quality_pareto_from_csv()

    root_causes = _root_causes_db()
    if not root_causes and pareto:
        root_causes = _root_causes_from_csv()

    cut = date.today() - timedelta(days=90)
    copq_breakdown = _copq_breakdown(cut)
    copq_total = copq_breakdown["combined_90d"]

    capa_summary = _capa_summary()
    defect_monthly = _defect_monthly_trend()
    defect_types_catalog = _defect_types_catalog()

    capa_rows = CapaCase.objects.order_by("-opened_date")[:25]
    capa_list = [
        {
            "capa_number": c.capa_number,
            "title": c.title,
            "status": c.status,
            "opened_date": c.opened_date.isoformat(),
            "due_date": c.due_date.isoformat() if c.due_date else None,
            "effectiveness_verified": c.effectiveness_verified,
        }
        for c in capa_rows
    ]

    dpmo_target = float(pmap.get("dpmo_target") or 3400)
    ship_target = float(pmap.get("on_time_ship_target") or 0.98)
    rty_target = float(pmap.get("target_rty") or 0.95)
    cpk_target = float(pmap.get("min_cpk") or 1.33)
    cpk_current = float(pmap.get("quality_cpk_current") or 1.21)
    conf_target = float(pmap.get("configuration_accuracy_target") or 0.99)

    return {
        "forecast_parameters": params,
        "forecast_parameter_map": pmap,
        "daily_operations": daily_ops,
        "weekly_operations": weekly_ops,
        "orders_summary": {
            "on_time_48h_rate": on_time_48h_rate,
            "on_time_ship_target": ship_target,
            "ship_within_hours": int(pmap.get("ship_within_hours") or 48),
            "total_orders": total_orders,
            "shipped_orders": shipped_n,
            "latest_backlog": latest_backlog,
        },
        "quality": {
            "pareto": pareto,
            "root_causes": root_causes,
            "dpmo": est_dpmo,
            "dpmo_target": dpmo_target,
            "process_yield": process_yield,
            "rty_target": rty_target,
            "configuration_accuracy": conf_acc,
            "configuration_accuracy_target": conf_target,
            "cpk": cpk_current,
            "cpk_target": cpk_target,
            "total_defect_units": total_defect_units,
            "copq_total_90d": copq_total,
            "copq_breakdown": copq_breakdown,
            "capa_summary": capa_summary,
            "defect_monthly_trend": defect_monthly,
            "dpmo_basis": dpmo_basis,
            "defect_types": defect_types_catalog,
        },
        "capa": capa_list,
        "purpose": {
            "orders": "Track daily and weekly performance: orders received, assembled, shipped, 48-hour ship goal, backlog, and whether operations are keeping up.",
            "quality": "Monitor and improve product quality. Tracks defects (wrong assembly, damage, and other codes), calculates metrics like DPMO and yield, shows root causes, manages CAPA (corrective actions), and tracks cost of poor quality. Helps reduce mistakes and improve consistency.",
            "settings": "Fine-tune forecasting parameters, safety stock, ship and quality targets, and other thresholds — values here drive the Orders and Quality views.",
        },
    }


def _defect_monthly_trend() -> list[dict]:
    start = date.today() - timedelta(days=370)
    rows = (
        DefectEvent.objects.filter(defect_date__gte=start)
        .annotate(month=TruncMonth("defect_date"))
        .values("month")
        .annotate(units=Sum("quantity"))
        .order_by("month")
    )
    out = []
    for r in rows:
        m = r.get("month")
        out.append(
            {
                "year_month": m.strftime("%Y-%m") if m else "",
                "defect_units": int(r["units"] or 0),
            }
        )
    return out[-24:] if len(out) > 24 else out


def _capa_summary() -> dict:
    rows = CapaCase.objects.values("status").annotate(n=Count("id"))
    counts = {r["status"]: r["n"] for r in rows}
    total = sum(counts.values())
    return {
        "by_status": counts,
        "open": int(counts.get("open", 0)),
        "in_progress": int(counts.get("in_progress", 0)),
        "closed": int(counts.get("closed", 0)),
        "total": int(total),
    }


def _copq_breakdown(cut: date) -> dict:
    q = QualityCost.objects.filter(cost_date__gte=cut)
    agg = q.aggregate(
        scrap=Sum("scrap_cost"),
        rework=Sum("rework_cost"),
        return_cost=Sum("return_cost"),
        warranty=Sum("warranty_cost"),
        expedite=Sum("expedite_cost"),
    )

    def dec(v) -> float:
        return float(v or 0)

    qc_parts = {k: dec(agg[k]) for k in ("scrap", "rework", "return_cost", "warranty", "expedite")}
    qc_total = sum(qc_parts.values())
    ret_total = sum(
        float(r.refund_cost + r.replacement_shipping_cost + r.rework_cost)
        for r in ReturnEvent.objects.filter(return_date__gte=cut)
    )
    return {
        "quality_cost_lines": qc_parts,
        "quality_costs_recorded": qc_total,
        "returns_and_rework_charges": ret_total,
        "combined_90d": qc_total + ret_total,
    }


def _defect_types_catalog() -> list[dict]:
    return list(
        DefectType.objects.filter(is_active=True)
        .order_by("defect_name")
        .values("id", "defect_code", "defect_name")
    )


def _root_causes_from_csv() -> list[dict]:
    path = _seed_csv_dir() / "quality_events.csv"
    if not path.exists():
        return []
    buckets: dict[str, int] = defaultdict(int)
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            rc = row.get("root_cause_code") or "unknown"
            label = rc.replace("_", " ").title()
            try:
                buckets[label] += int(float(row.get("defect_count") or 0))
            except (TypeError, ValueError):
                continue
    items = sorted(buckets.items(), key=lambda x: -x[1])
    return [{"label": k, "count": v} for k, v in items[:14]]
