"""
Unified OptiDoll parts catalog for CSV / ZIP / SQL templates.
Rows are alphabetized by part_name. Same data drives every template export.
"""

from __future__ import annotations

# Standard download names: DollPartsCatalog + file type
CATALOG_STEM = "DollPartsCatalog"
FILENAME_CSV = f"{CATALOG_STEM}.csv"
FILENAME_SQL = f"{CATALOG_STEM}.sql"
FILENAME_ZIP = f"{CATALOG_STEM}.zip"
FILENAME_README_MD = f"{CATALOG_STEM}.README.md"


def _collect_raw() -> list[tuple[str, str]]:
    """(part_name, part_type) — part_type matches Part.PART_TYPES keys."""
    raw: list[tuple[str, str]] = []

    for shape in ("Square",):
        raw.append((f"Head {shape}", "head"))

    for shape in ("Square",):
        for tone in ("Light", "Medium", "Deep"):
            raw.append((f"Head {shape} {tone}", "head"))

    for color in ("Amber", "Blue", "Green", "Brown", "Hazel", "Lavender"):
        raw.append((f"Eyes {color}", "eyes"))

    for tone in ("Light", "Medium", "Deep"):
        raw.append((f"Arm {tone}", "arm"))
        raw.append((f"Leg {tone}", "leg"))

    raw.append(("Box Tiffany Blue", "packaging"))
    raw.append(("Box Pastel Pink", "packaging"))
    raw.append(("Box Lavender", "packaging"))
    raw.append(("Box Ribbon White 1 Meter", "packaging"))

    colors = (
        "Black",
        "Brown",
        "Sable",
        "Copper",
        "Strawberry Blond",
        "Platinum Blond",
    )
    hair_bases = (
        "Hair Straight Bob",
        "Hair Long Straight",
        "Hair Long Wavy",
        "Hair Long Spiral",
        "Hair Long Dreadlocks",
        "Hair Long",
    )
    _skip_hair = frozenset({"Hair Long Sable", "Hair Long Spiral Sable"})
    for base in hair_bases:
        for color in colors:
            label = f"{base} {color}"
            if label in _skip_hair:
                continue
            raw.append((label, "hair"))

    raw.sort(key=lambda x: x[0].lower())
    return raw


def build_catalog_rows() -> list[dict]:
    """Canonical rows for templates and optional tooling. Alphabetical by part_name."""
    out: list[dict] = []
    for i, (part_name, part_type) in enumerate(_collect_raw(), start=1):
        avail = 180 + (i % 19) * 4
        reorder = max(45, avail // 2 - 15)
        out.append(
            {
                "part_number": f"SKU-OPT-{i:04d}",
                "part_name": part_name,
                "available_qty": avail,
                "reorder_point_qty": reorder,
                "part_type": part_type,
            }
        )
    return out


def rows_to_csv_string(rows: list[dict]) -> str:
    lines = ["part_number,part_name,available_qty,reorder_point_qty"]
    for r in rows:
        lines.append(
            f"{r['part_number']},{r['part_name']},{r['available_qty']},{r['reorder_point_qty']}"
        )
    return "\n".join(lines) + "\n"


def rows_to_sql_seed(rows: list[dict]) -> str:
    header = (
        "-- ============================================\n"
        "-- **OptiDoll Unified Seed — full doll catalog**\n"
        "-- Same rows as CSV / ZIP templates; alphabetized by part_name.\n"
        "-- ============================================\n"
        "INSERT INTO inventory_seed (part_number, part_name, available_qty, reorder_point_qty) VALUES\n"
    )
    parts_sql = []
    for r in rows:
        name = str(r["part_name"]).replace("'", "''")
        parts_sql.append(
            f"('{r['part_number']}', '{name}', {r['available_qty']}, {r['reorder_point_qty']})"
        )
    return header + ",\n".join(parts_sql) + ";\n"


def template_readme_markdown() -> str:
    n = len(build_catalog_rows())
    return (
        "# **OptiDoll Data Intake — Full Catalog**\n\n"
        f"This package includes **{n}** part rows (heads, eyes, limbs, packaging, hair), "
        "**alphabetized by `part_name`**, identical across CSV and SQL.\n\n"
        "## Required columns\n"
        "- `part_number`\n"
        "- `part_name`\n"
        "- `available_qty`\n"
        "- `reorder_point_qty`\n\n"
        "## Catalog highlights\n"
        "- Heads: Square base + Light / Medium / Deep tones\n"
        "- Eyes: Amber, Blue, Green, Brown, Hazel, Lavender\n"
        "- Arms & legs: Light, Medium, Deep\n"
        "- Boxes: Tiffany Blue, Pastel Pink, Lavender; one shared white 1 m ribbon SKU\n"
        "- Hair: Straight Bob and Long styles × six colors (alphabetical); excludes removed SKUs\n"
    )
