# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Management command to fetch and store model pricing from models.dev."""
import httpx
from decimal import Decimal

from django.core.management.base import BaseCommand

from chat_messages.models import ModelPricing


class Command(BaseCommand):
    help = "Fetch LLM model pricing data from models.dev/api.json and store in DB"

    def handle(self, *args, **options):
        self.stdout.write("Fetching pricing data from models.dev...")

        resp = httpx.get("https://models.dev/api.json", timeout=30.0)
        resp.raise_for_status()
        data = resp.json()

        created = 0
        updated = 0

        for provider_key, provider_data in data.items():
            if not isinstance(provider_data, dict):
                continue

            models = provider_data.get("models", {})
            if not isinstance(models, dict):
                continue

            for model_key, model_data in models.items():
                if not isinstance(model_data, dict):
                    continue

                cost = model_data.get("cost")
                if not cost or not isinstance(cost, dict):
                    continue

                model_id = f"{provider_key}/{model_key}"
                defaults = {
                    "provider": provider_key,
                    "model_name": model_key,
                    "display_name": model_data.get("name", model_key),
                    "input_cost_per_mtok": Decimal(str(cost.get("input", 0))),
                    "output_cost_per_mtok": Decimal(str(cost.get("output", 0))),
                    "cache_read_cost_per_mtok": Decimal(str(cost.get("cache_read", 0))),
                    "cache_write_cost_per_mtok": Decimal(str(cost.get("cache_write", 0))),
                    "raw_data": model_data,
                }

                _, is_created = ModelPricing.objects.update_or_create(
                    model_id=model_id,
                    defaults=defaults,
                )

                if is_created:
                    created += 1
                else:
                    updated += 1

        self.stdout.write(self.style.SUCCESS(
            f"Done. Created {created}, updated {updated} model pricing entries."
        ))
