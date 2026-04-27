"""Load supplier_parts.csv from repo data/dolls1_seed_csv (after parts & suppliers exist)."""

from pathlib import Path

from django.core.management.base import BaseCommand

from supplychain.management.commands.import_seed_data import Command as SeedImportCommand


class Command(BaseCommand):
    help = "Import supplier_parts.csv from data/dolls1_seed_csv into the database."

    def handle(self, *args, **options):
        folder = Path(__file__).resolve().parents[5] / "data" / "dolls1_seed_csv"
        inner = SeedImportCommand()
        inner.stdout = self.stdout
        inner.stderr = self.stderr
        inner.style = self.style
        inner.import_supplier_parts(folder)
