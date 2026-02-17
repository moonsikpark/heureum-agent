# Copyright (c) 2026 Heureum AI. All rights reserved.

import json

from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.utils import user_field


class HereumAccountAdapter(DefaultAccountAdapter):
    def save_user(self, request, user, form, commit=True):
        user = super().save_user(request, user, form, commit=False)
        # The headless SignupInput doesn't declare first_name/last_name as
        # form fields, so they won't be in cleaned_data. Read them from the
        # request body instead.
        if not user.first_name or not user.last_name:
            try:
                body = json.loads(request.body)
            except (json.JSONDecodeError, AttributeError):
                body = {}
            if not user.first_name and body.get("first_name"):
                user_field(user, "first_name", body["first_name"])
            if not user.last_name and body.get("last_name"):
                user_field(user, "last_name", body["last_name"])
        if commit:
            user.save()
        return user
