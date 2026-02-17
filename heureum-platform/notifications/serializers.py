# Copyright (c) 2026 Heureum AI. All rights reserved.

from rest_framework import serializers

from .models import Notification, DeviceToken, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "title", "body", "data", "read_at", "created_at"]
        read_only_fields = ["id", "created_at"]


class DeviceTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceToken
        fields = ["id", "device_type", "token", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "is_active", "created_at", "updated_at"]


class RegisterDeviceSerializer(serializers.Serializer):
    token = serializers.CharField()
    device_type = serializers.ChoiceField(choices=DeviceToken.DEVICE_TYPES)


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ["enabled", "web_enabled", "electron_enabled", "mobile_enabled", "updated_at"]
        read_only_fields = ["updated_at"]
