# Copyright (c) 2026 Heureum AI. All rights reserved.

"""
Management command that polls for due periodic tasks every 60 seconds.

Intended for local development / debug use. In production use cron or
a scheduler to invoke ``run_periodic_tasks`` instead.
"""

import time

from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Run periodic task checker in a loop (every 60s). For development use."

    def add_arguments(self, parser):
        parser.add_argument(
            "--interval",
            type=int,
            default=60,
            help="Seconds between checks (default: 60)",
        )

    def handle(self, *args, **options):
        interval = options["interval"]
        self.stdout.write(f"Periodic task runner started (interval={interval}s)")

        while True:
            try:
                call_command("run_periodic_tasks")
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Error: {e}"))
            time.sleep(interval)
