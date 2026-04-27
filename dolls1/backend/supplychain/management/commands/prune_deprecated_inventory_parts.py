"""
Delete Part rows whose part_name matches deprecated catalog labels (exact match).

Removes dependent InventorySnapshot and SupplierPart rows via CASCADE.

Usage:
  python manage.py prune_deprecated_inventory_parts              # dry-run
  python manage.py prune_deprecated_inventory_parts --execute    # delete
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from supplychain.models import Part


DEPRECATED_PART_NAMES = frozenset(
    {
        "Bob Hair Brown",
        "Hair Straight Bob Brown",
        "Head A",
        "Head Alpha",
        "Head Heart",
        "Head Heart Deep",
        "Head Heart Light",
        "Head Heart Medium",
        "Head Oval",
        "Head Oval Deep",
        "Head Oval Light",
        "Head Oval Medium",
        "Head Round",
        "Head Round Deep",
        "Head Round Light",
        "Head Round Medium",
        "Head Square",
        "Head Square Deep",
        "Head Square Light",
        "Head Square Medium",
        "Skin Tone 3 Head",
        "Outfit Sigma",
        "Soft Torso Complete",
        "Completed Torso",
        "Completed 10 inch memory-foam stuffed muslin torso",
    }
)


class Command(BaseCommand):
    help = "Delete parts whose part_name is in the deprecated list (dry-run unless --execute)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--execute",
            action="store_true",
            help="Actually delete matching parts and dependents.",
        )

    def handle(self, *args, **options):
        execute = options["execute"]
        qs = Part.objects.filter(part_name__in=DEPRECATED_PART_NAMES).order_by("part_number")
        count = qs.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS("No parts matched the deprecated name list."))
            return

        self.stdout.write(f"Matched {count} part(s):")
        for p in qs[:80]:
            self.stdout.write(f"  - {p.part_number} | {p.part_name}")
        if count > 80:
            self.stdout.write(f"  ... and {count - 80} more.")

        if not execute:
            self.stdout.write(
                self.style.WARNING("Dry-run only. Pass --execute to delete these parts.")
            )
            return

        with transaction.atomic():
            deleted, detail = qs.delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} object(s): {detail}"))
