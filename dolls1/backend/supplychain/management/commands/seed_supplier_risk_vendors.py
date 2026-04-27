"""Upsert the named Supplier Risk catalog vendors (unique supplier_code per row)."""

from datetime import date

from django.core.management.base import BaseCommand

from supplychain.models import Supplier

# (supplier_code, supplier_name, country) — aligns with supplier_master.csv SUP_RISK_* rows
SUPPLIER_RISK_VENDORS = [
    ("SUP_RISK_HISU", "HiSu", "China"),
    ("SUP_RISK_INDIASIL", "IndiaSilicone", "India"),
    ("SUP_RISK_EYESAN", "EyeSan", "Japan"),
    ("SUP_RISK_ETOYS", "E-Toys", "Pakistan"),
    ("SUP_RISK_BEAUTYEYES", "BeautyEyes", "Canada"),
    ("SUP_RISK_SILICA", "SilicaForms", "UK"),
    ("SUP_RISK_POLYSYTH", "PolySyth", "Indonesia"),
    ("SUP_RISK_HAIRYSAN", "HairySan", "Japan"),
    ("SUP_RISK_BOXINGDAY", "BoxingDay", "UK"),
    ("SUP_RISK_CANADACONT", "CanadaContainers", "Canada"),
    ("SUP_RISK_BOXY", "BoXy", "USA"),
    ("SUP_RISK_IRIS", "IrisStyles", "USA"),
    ("SUP_RISK_BOXME", "BoxMe", "USA"),
    ("SUP_RISK_SOFTBODY", "SoftBody", "USA"),
]


class Command(BaseCommand):
    help = "Create or update Supplier Risk named vendors (14 rows)."

    def handle(self, *args, **options):
        expiry = date(2026, 12, 31)
        for code, name, country in SUPPLIER_RISK_VENDORS:
            foam = code == "SUP_RISK_SOFTBODY"
            Supplier.objects.update_or_create(
                supplier_code=code,
                defaults={
                    "supplier_name": name,
                    "country": country,
                    "iso_9001_current": True,
                    "cpsia_current": True,
                    "astm_f963_current": True,
                    "oeko_tex_current": False,
                    "foam_cert_current": foam,
                    "certification_expiry": expiry,
                    "supplier_score": 0,
                    "is_active": True,
                },
            )
            self.stdout.write(f"OK {code} — {name} ({country})")
        self.stdout.write(self.style.SUCCESS(f"Upserted {len(SUPPLIER_RISK_VENDORS)} suppliers."))
