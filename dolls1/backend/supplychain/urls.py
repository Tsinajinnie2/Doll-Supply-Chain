from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProductOptionViewSet,
    PartViewSet,
    SupplierViewSet,
    SupplierPartViewSet,
    InventorySnapshotViewSet,
    CustomerOrderViewSet,
    DailyTargetViewSet,
    WeeklyTargetViewSet,
    ForecastParameterViewSet,
    OrderRecommendationViewSet,
    DataUploadViewSet,
    DefectEventViewSet,
    ReturnEventViewSet,
    CapaCaseViewSet,
    SupplierLotQualityViewSet,
    dashboard_summary,
)

router = DefaultRouter()
router.register("product-options", ProductOptionViewSet)
router.register("parts", PartViewSet)
router.register("suppliers", SupplierViewSet)
router.register("supplier-parts", SupplierPartViewSet)
router.register("inventory", InventorySnapshotViewSet)
router.register("orders", CustomerOrderViewSet)
router.register("daily-targets", DailyTargetViewSet)
router.register("weekly-targets", WeeklyTargetViewSet)
router.register("forecast-parameters", ForecastParameterViewSet)
router.register("order-recommendations", OrderRecommendationViewSet)
router.register("uploads", DataUploadViewSet)
router.register("defects", DefectEventViewSet)
router.register("returns", ReturnEventViewSet)
router.register("capa", CapaCaseViewSet)
router.register("supplier-lot-quality", SupplierLotQualityViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("dashboard-summary/", dashboard_summary),
]
