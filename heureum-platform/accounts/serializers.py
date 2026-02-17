# Copyright (c) 2026 Heureum AI. All rights reserved.

from rest_framework import serializers


class RequestCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    client = serializers.ChoiceField(
        choices=["web", "electron", "mobile"], default="web"
    )


class ConfirmCodeSerializer(serializers.Serializer):
    code = serializers.CharField()


class CompleteSignupSerializer(serializers.Serializer):
    first_name = serializers.CharField()
    last_name = serializers.CharField()


class UserSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    email = serializers.EmailField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
