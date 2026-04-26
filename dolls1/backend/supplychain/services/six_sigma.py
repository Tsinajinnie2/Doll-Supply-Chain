import math
from statistics import mean, stdev


def dpu(defects: int, units: int) -> float:
    if units <= 0:
        return 0.0
    return defects / units


def dpo(defects: int, units: int, opportunities_per_unit: int) -> float:
    if units <= 0 or opportunities_per_unit <= 0:
        return 0.0
    return defects / (units * opportunities_per_unit)


def dpmo(defects: int, units: int, opportunities_per_unit: int) -> float:
    return dpo(defects, units, opportunities_per_unit) * 1_000_000


def yield_rate(good_units: int, total_units: int) -> float:
    if total_units <= 0:
        return 0.0
    return good_units / total_units


def rolled_throughput_yield(step_yields: list[float]) -> float:
    result = 1.0
    for y in step_yields:
        result *= y
    return result


def configuration_accuracy(correct_builds: int, total_builds: int) -> float:
    if total_builds <= 0:
        return 0.0
    return correct_builds / total_builds


def cp(usl: float, lsl: float, sigma: float) -> float:
    if sigma <= 0:
        return 0.0
    return (usl - lsl) / (6 * sigma)


def cpk(usl: float, lsl: float, mu: float, sigma: float) -> float:
    if sigma <= 0:
        return 0.0
    return min((usl - mu) / (3 * sigma), (mu - lsl) / (3 * sigma))


def simple_control_limits(values: list[float]) -> dict:
    """
    Basic mean +- 3 sigma control limits.
    """
    if len(values) < 2:
        center = values[0] if values else 0
        return {
            "center_line": center,
            "ucl": center,
            "lcl": center,
        }

    center = mean(values)
    sigma = stdev(values)

    return {
        "center_line": center,
        "ucl": center + 3 * sigma,
        "lcl": max(0, center - 3 * sigma),
    }


def detect_out_of_control(value: float, ucl: float, lcl: float) -> bool:
    return value > ucl or value < lcl

