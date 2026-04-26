from django.contrib import admin

from .models import (
    Part,
    ProductOption,
    Supplier,
    SupplierPart,
    TariffRate,
    InventorySnapshot,
    CustomerOrder,
    DailyTarget,
    WeeklyTarget,
    ForecastParameter,
    OrderRecommendation,
    DataUpload,
    DefectType,
    RootCauseCode,
    ProcessStep,
    DefectEvent,
    ReturnEvent,
    QualityMeasurement,
    ControlChartSignal,
    CapaCase,
    QualityCost,
    SupplierLotQuality,
    DigitalChecklistResult,
)


models_to_register = [
    ProductOption,
    Part,
    Supplier,
    SupplierPart,
    TariffRate,
    InventorySnapshot,
    CustomerOrder,
    DailyTarget,
    WeeklyTarget,
    ForecastParameter,
    OrderRecommendation,
    DataUpload,
    DefectType,
    RootCauseCode,
    ProcessStep,
    DefectEvent,
    ReturnEvent,
    QualityMeasurement,
    ControlChartSignal,
    CapaCase,
    QualityCost,
    SupplierLotQuality,
    DigitalChecklistResult,
]

for model in models_to_register:
    admin.site.register(model)
