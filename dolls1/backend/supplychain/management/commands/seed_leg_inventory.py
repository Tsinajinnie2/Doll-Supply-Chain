"""Ensure Leg Deep / Leg Light / Leg Medium exist as Parts with InventorySnapshots (catalog quantities)."""

from datetime import date

from django.core.management.base import BaseCommand

from supplychain import catalog_parts
from supplychain.models import InventorySnapshot, Part


class Command(BaseCommand):
    help = "Upsert leg catalog parts (SKU-OPT-0066–0068) and one inventory snapshot per part for today."

    def handle(self, *args, **options):
        today = date.today()
        rows = [
            r
            for r in catalog_parts.build_catalog_rows()
            if r["part_name"] in ("Leg Deep", "Leg Light", "Leg Medium")
        ]
        if len(rows) != 3:
            self.stderr.write(
                self.style.ERROR(f"Expected 3 leg rows in catalog, found {len(rows)}.")
            )
            return

        for r in rows:
            part, created = Part.objects.update_or_create(
                part_number=r["part_number"],
                defaults={
                    "part_name": r["part_name"],
                    "part_type": r["part_type"],
                },
            )
            on_hand = int(r["available_qty"])
            reorder = int(r["reorder_point_qty"])
            InventorySnapshot.objects.update_or_create(
                part=part,
                snapshot_date=today,
                defaults={
                    "on_hand_qty": on_hand,
                    "allocated_qty": 0,
                    "incoming_qty": 0,
                    "safety_stock_qty": reorder,
                    "reorder_point_qty": reorder,
                },
            )
            self.stdout.write(
                f"{'Created' if created else 'Updated'} {part.part_number} — {part.part_name} "
                f"(on_hand={on_hand}, reorder_point={reorder})"
            )

        self.stdout.write(self.style.SUCCESS(f"Inventory snapshots dated {today.isoformat()}."))
