from rest_framework import serializers

from .models import (
    CapaCase,
    CustomerOrder,
    DailyTarget,
    DataUpload,
    DefectEvent,
    DefectType,
    ForecastParameter,
    InventorySnapshot,
    OrderRecommendation,
    Part,
    ProductOption,
    ReturnEvent,
    Supplier,
    SupplierLotQuality,
    SupplierPart,
    WeeklyTarget,
)


class ProductOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductOption
        fields = "__all__"


class PartSerializer(serializers.ModelSerializer):
    class Meta:
        model = Part
        fields = "__all__"


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = "__all__"


class SupplierMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ("id", "supplier_code", "supplier_name", "country")


class DefectTypeMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = DefectType
        fields = ("id", "defect_code", "defect_name")


class SupplierPartSerializer(serializers.ModelSerializer):
    part_detail = PartSerializer(source="part", read_only=True)
    supplier_detail = SupplierMiniSerializer(source="supplier", read_only=True)

    class Meta:
        model = SupplierPart
        fields = "__all__"


class InventorySnapshotSerializer(serializers.ModelSerializer):
    part_detail = PartSerializer(source="part", read_only=True)
    available_qty = serializers.IntegerField(read_only=True)

    class Meta:
        model = InventorySnapshot
        fields = "__all__"


class CustomerOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerOrder
        fields = "__all__"


class DailyTargetSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyTarget
        fields = "__all__"


class WeeklyTargetSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyTarget
        fields = "__all__"


class ForecastParameterSerializer(serializers.ModelSerializer):
    class Meta:
        model = ForecastParameter
        fields = "__all__"


class OrderRecommendationSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderRecommendation
        fields = "__all__"


class DataUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataUpload
        fields = "__all__"


class DefectEventSerializer(serializers.ModelSerializer):
    part_detail = PartSerializer(source="part", read_only=True)
    defect_type_detail = DefectTypeMiniSerializer(source="defect_type", read_only=True)

    class Meta:
        model = DefectEvent
        fields = "__all__"


class ReturnEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReturnEvent
        fields = "__all__"


class CapaCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = CapaCase
        fields = "__all__"


class SupplierLotQualitySerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierLotQuality
        fields = "__all__"

