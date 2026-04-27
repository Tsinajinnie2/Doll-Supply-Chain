from django.contrib.auth.models import User
from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True


class ProductOption(TimeStampedModel):
    OPTION_TYPES = [
        ("skin_tone", "Skin Tone"),
        ("face_shape", "Face Shape"),
        ("haircut", "Haircut"),
        ("hair_color", "Hair Color"),
        ("eye_color", "Eye Color"),
        ("outfit", "Outfit"),
        ("glasses", "Glasses"),
    ]

    option_type = models.CharField(max_length=50, choices=OPTION_TYPES)
    option_code = models.CharField(max_length=50)
    option_name = models.CharField(max_length=120)

    class Meta:
        unique_together = ("option_type", "option_code")

    def __str__(self):
        return f"{self.option_type}: {self.option_name}"


class Part(TimeStampedModel):
    PART_TYPES = [
        ("head", "Head"),
        ("arm", "Arm"),
        ("leg", "Leg"),
        ("hair", "Hair"),
        ("eyes", "Eyes"),
        ("outfit", "Outfit"),
        ("glasses", "Glasses"),
        ("torso", "Completed Soft Torso"),
        ("packaging", "Packaging"),
    ]

    part_number = models.CharField(max_length=80, unique=True)
    part_name = models.CharField(max_length=150)
    part_type = models.CharField(max_length=50, choices=PART_TYPES)

    skin_tone = models.CharField(max_length=50, blank=True, null=True)
    face_shape = models.CharField(max_length=50, blank=True, null=True)
    haircut = models.CharField(max_length=50, blank=True, null=True)
    hair_color = models.CharField(max_length=50, blank=True, null=True)
    eye_color = models.CharField(max_length=50, blank=True, null=True)
    outfit = models.CharField(max_length=50, blank=True, null=True)
    glasses = models.CharField(max_length=50, blank=True, null=True)

    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit_weight_grams = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    defect_opportunities = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.part_number} - {self.part_name}"


class Supplier(TimeStampedModel):
    supplier_code = models.CharField(max_length=80, unique=True)
    supplier_name = models.CharField(max_length=150)
    country = models.CharField(max_length=80)

    iso_9001_current = models.BooleanField(default=False)
    cpsia_current = models.BooleanField(default=False)
    astm_f963_current = models.BooleanField(default=False)
    oeko_tex_current = models.BooleanField(default=False)
    foam_cert_current = models.BooleanField(default=False)

    certification_expiry = models.DateField(null=True, blank=True)
    supplier_score = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    def __str__(self):
        return self.supplier_name


class SupplierPart(TimeStampedModel):
    part = models.ForeignKey(Part, on_delete=models.CASCADE)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE)

    supplier_part_number = models.CharField(max_length=100, blank=True, null=True)
    base_cost = models.DecimalField(max_digits=12, decimal_places=2)
    shipping_cost_per_unit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tariff_rate = models.DecimalField(max_digits=6, decimal_places=4, default=0)

    lead_time_days_mean = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    lead_time_days_std = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    minimum_order_quantity = models.PositiveIntegerField(default=1)
    order_multiple = models.PositiveIntegerField(default=1)
    capacity_per_month = models.PositiveIntegerField(default=0)

    on_time_delivery_rate = models.DecimalField(max_digits=6, decimal_places=4, default=1)
    supplier_dpmo = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    is_primary = models.BooleanField(default=False)

    class Meta:
        unique_together = ("part", "supplier")

    @property
    def landed_cost(self):
        return self.base_cost + self.shipping_cost_per_unit + (self.base_cost * self.tariff_rate)

    def __str__(self):
        return f"{self.part} from {self.supplier}"


class TariffRate(TimeStampedModel):
    country = models.CharField(max_length=80)
    hts_code = models.CharField(max_length=50, blank=True, null=True)
    tariff_rate = models.DecimalField(max_digits=6, decimal_places=4)
    effective_start = models.DateField()
    effective_end = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.country} {self.tariff_rate}"


class InventorySnapshot(TimeStampedModel):
    part = models.ForeignKey(Part, on_delete=models.CASCADE)
    snapshot_date = models.DateField()

    on_hand_qty = models.IntegerField(default=0)
    allocated_qty = models.IntegerField(default=0)
    incoming_qty = models.IntegerField(default=0)
    safety_stock_qty = models.IntegerField(default=0)
    reorder_point_qty = models.IntegerField(default=0)

    @property
    def available_qty(self):
        return self.on_hand_qty - self.allocated_qty + self.incoming_qty

    def __str__(self):
        return f"{self.part} inventory on {self.snapshot_date}"


class CustomerOrder(TimeStampedModel):
    order_number = models.CharField(max_length=100, unique=True)
    order_date = models.DateTimeField()
    promised_ship_by = models.DateTimeField(null=True, blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True)

    skin_tone = models.CharField(max_length=50)
    face_shape = models.CharField(max_length=50)
    haircut = models.CharField(max_length=50)
    hair_color = models.CharField(max_length=50)
    eye_color = models.CharField(max_length=50)
    outfit = models.CharField(max_length=50)
    glasses = models.CharField(max_length=50)

    status = models.CharField(max_length=50, default="received")
    is_custom_build = models.BooleanField(default=True)

    @property
    def shipped_within_48h(self):
        if not self.shipped_at:
            return False
        delta = self.shipped_at - self.order_date
        return delta.total_seconds() <= 48 * 3600

    def __str__(self):
        return self.order_number


class DailyTarget(TimeStampedModel):
    target_date = models.DateField(unique=True)
    target_orders = models.IntegerField(default=0)
    target_assembled = models.IntegerField(default=0)
    target_shipped = models.IntegerField(default=0)

    actual_orders = models.IntegerField(default=0)
    actual_assembled = models.IntegerField(default=0)
    actual_shipped = models.IntegerField(default=0)
    backlog_qty = models.IntegerField(default=0)

    on_time_ship_rate = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)
    season_window = models.CharField(max_length=40, blank=True, default="")

    @property
    def ship_achievement_rate(self):
        if self.target_shipped == 0:
            return 0
        return self.actual_shipped / self.target_shipped

    def __str__(self):
        return f"Daily target {self.target_date}"


class WeeklyTarget(TimeStampedModel):
    week_start = models.DateField(unique=True)
    week_end = models.DateField()

    target_orders = models.IntegerField(default=0)
    target_assembled = models.IntegerField(default=0)
    target_shipped = models.IntegerField(default=0)

    actual_orders = models.IntegerField(default=0)
    actual_assembled = models.IntegerField(default=0)
    actual_shipped = models.IntegerField(default=0)

    on_time_ship_rate = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)
    ending_backlog = models.IntegerField(default=0)

    @property
    def achievement_rate(self):
        if self.target_shipped == 0:
            return 0
        return self.actual_shipped / self.target_shipped

    def __str__(self):
        return f"Weekly target {self.week_start}"


class ForecastParameter(TimeStampedModel):
    parameter_name = models.CharField(max_length=120, unique=True)
    parameter_value = models.CharField(max_length=255)
    parameter_type = models.CharField(max_length=50, default="string")
    effective_start = models.DateField(null=True, blank=True)
    effective_end = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.parameter_name


class MonthlyDollUnitSale(TimeStampedModel):
    """Completed doll units sold (or shipped) per calendar month — drives demand forecast workbench."""

    year_month = models.CharField(max_length=7, unique=True, db_index=True)
    units_sold = models.PositiveIntegerField(default=0)
    notes = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        ordering = ["year_month"]
        verbose_name = "Monthly doll unit sale"
        verbose_name_plural = "Monthly doll unit sales"

    def __str__(self):
        return f"{self.year_month}: {self.units_sold} dolls"


class OrderRecommendation(TimeStampedModel):
    recommendation_date = models.DateField()
    part = models.ForeignKey(Part, on_delete=models.CASCADE)
    supplier_part = models.ForeignKey(SupplierPart, on_delete=models.SET_NULL, null=True, blank=True)

    forecast_qty = models.IntegerField(default=0)
    available_qty = models.IntegerField(default=0)
    safety_stock_qty = models.IntegerField(default=0)
    recommended_order_qty = models.IntegerField(default=0)
    recommended_order_date = models.DateField(null=True, blank=True)

    risk_level = models.CharField(max_length=30, default="green")
    approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    approved_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.part} recommendation {self.recommendation_date}"


class DataUpload(TimeStampedModel):
    FILE_TYPES = [
        ("csv", "CSV"),
        ("xlsx", "XLSX"),
        ("zip", "ZIP"),
        ("sql", "SQL"),
    ]

    original_filename = models.CharField(max_length=255)
    original_file_type = models.CharField(max_length=20, choices=FILE_TYPES)
    original_file_path = models.TextField(blank=True, null=True)

    converted_to_csv = models.BooleanField(default=False)
    conversion_status = models.CharField(max_length=30, default="not_required")
    converted_file_count = models.IntegerField(default=0)
    converted_csv_folder = models.TextField(blank=True, null=True)

    validation_status = models.CharField(max_length=30, default="pending")
    import_status = models.CharField(max_length=30, default="pending")
    user_message = models.TextField(blank=True, null=True)

    uploaded_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return self.original_filename


class DefectType(TimeStampedModel):
    defect_code = models.CharField(max_length=80, unique=True)
    defect_name = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.defect_name


class RootCauseCode(TimeStampedModel):
    cause_code = models.CharField(max_length=80, unique=True)
    cause_name = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.cause_name


class ProcessStep(TimeStampedModel):
    step_code = models.CharField(max_length=80, unique=True)
    step_name = models.CharField(max_length=150)
    sequence = models.PositiveIntegerField(default=1)

    def __str__(self):
        return self.step_name


class DefectEvent(TimeStampedModel):
    defect_date = models.DateField()
    order = models.ForeignKey(CustomerOrder, null=True, blank=True, on_delete=models.SET_NULL)
    part = models.ForeignKey(Part, null=True, blank=True, on_delete=models.SET_NULL)

    defect_type = models.ForeignKey(DefectType, on_delete=models.PROTECT)
    root_cause = models.ForeignKey(RootCauseCode, null=True, blank=True, on_delete=models.SET_NULL)
    process_step = models.ForeignKey(ProcessStep, null=True, blank=True, on_delete=models.SET_NULL)

    quantity = models.PositiveIntegerField(default=1)
    severity = models.CharField(max_length=30, default="minor")
    notes = models.TextField(blank=True, null=True)

    rework_required = models.BooleanField(default=False)
    scrap_required = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.defect_type} on {self.defect_date}"


class ReturnEvent(TimeStampedModel):
    order = models.ForeignKey(CustomerOrder, on_delete=models.CASCADE)
    return_date = models.DateField()
    return_reason = models.CharField(max_length=150)

    damaged_return = models.BooleanField(default=False)
    wrong_assembly = models.BooleanField(default=False)
    customer_dissatisfaction = models.BooleanField(default=False)

    refund_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    replacement_shipping_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    rework_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self):
        return f"Return {self.order}"


class QualityMeasurement(TimeStampedModel):
    measurement_date = models.DateField()
    process_step = models.ForeignKey(ProcessStep, on_delete=models.CASCADE)
    part = models.ForeignKey(Part, null=True, blank=True, on_delete=models.SET_NULL)

    metric_name = models.CharField(max_length=120)
    measured_value = models.DecimalField(max_digits=12, decimal_places=4)
    target_value = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    lower_spec_limit = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    upper_spec_limit = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)

    def __str__(self):
        return f"{self.metric_name} {self.measurement_date}"


class ControlChartSignal(TimeStampedModel):
    signal_date = models.DateField()
    metric_name = models.CharField(max_length=120)
    process_step = models.ForeignKey(ProcessStep, null=True, blank=True, on_delete=models.SET_NULL)

    signal_type = models.CharField(max_length=120)
    observed_value = models.DecimalField(max_digits=12, decimal_places=4)
    center_line = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    upper_control_limit = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    lower_control_limit = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)

    status = models.CharField(max_length=30, default="open")

    def __str__(self):
        return f"{self.signal_type} {self.signal_date}"


class CapaCase(TimeStampedModel):
    capa_number = models.CharField(max_length=100, unique=True)
    opened_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    closed_date = models.DateField(null=True, blank=True)

    defect_event = models.ForeignKey(DefectEvent, null=True, blank=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=200)
    problem_statement = models.TextField()
    corrective_action = models.TextField(blank=True, null=True)
    preventive_action = models.TextField(blank=True, null=True)

    owner = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=40, default="open")
    effectiveness_verified = models.BooleanField(default=False)

    def __str__(self):
        return self.capa_number


class QualityCost(TimeStampedModel):
    cost_date = models.DateField()
    order = models.ForeignKey(CustomerOrder, null=True, blank=True, on_delete=models.SET_NULL)
    defect_event = models.ForeignKey(DefectEvent, null=True, blank=True, on_delete=models.SET_NULL)

    scrap_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    rework_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    return_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    warranty_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    expedite_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    @property
    def total_copq(self):
        return self.scrap_cost + self.rework_cost + self.return_cost + self.warranty_cost + self.expedite_cost

    def __str__(self):
        return f"COPQ {self.cost_date}"


class SupplierLotQuality(TimeStampedModel):
    supplier_part = models.ForeignKey(SupplierPart, on_delete=models.CASCADE)
    lot_number = models.CharField(max_length=120)
    received_date = models.DateField()

    units_received = models.IntegerField(default=0)
    units_inspected = models.IntegerField(default=0)
    defects_found = models.IntegerField(default=0)
    accepted = models.BooleanField(default=True)

    @property
    def dpmo(self):
        if self.units_inspected == 0:
            return 0
        opportunities = self.units_inspected
        return (self.defects_found / opportunities) * 1_000_000

    def __str__(self):
        return f"{self.lot_number} - {self.supplier_part}"


class DigitalChecklistResult(TimeStampedModel):
    order = models.ForeignKey(CustomerOrder, null=True, blank=True, on_delete=models.SET_NULL)
    process_step = models.ForeignKey(ProcessStep, on_delete=models.CASCADE)
    checklist_name = models.CharField(max_length=150)
    completed = models.BooleanField(default=False)
    completed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.checklist_name
