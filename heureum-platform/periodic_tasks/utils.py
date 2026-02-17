# Copyright (c) 2026 Heureum AI. All rights reserved.

from datetime import datetime, timedelta

import pytz
from croniter import croniter


def compute_next_run(schedule: dict, tz_name: str, after: datetime = None) -> datetime:
    """Compute next run time from schedule JSON, returned as UTC datetime."""
    tz = pytz.timezone(tz_name)

    if after is None:
        after = datetime.now(tz)
    elif after.tzinfo is None:
        after = tz.localize(after)

    stype = schedule.get("type", "cron")

    if stype == "cron":
        c = schedule.get("cron", {})
        cron_expr = "{minute} {hour} {day_of_month} {month} {day_of_week}".format(
            minute=c.get("minute", 0),
            hour=c.get("hour", "*"),
            day_of_month=c.get("day_of_month", "*"),
            month=c.get("month", "*"),
            day_of_week=c.get("day_of_week", "*"),
        )
        ci = croniter(cron_expr, after)
        next_local = ci.get_next(datetime)
        return next_local.astimezone(pytz.utc)

    elif stype == "interval":
        i = schedule.get("interval", {})
        unit_seconds = {"minutes": 60, "hours": 3600, "days": 86400}
        seconds = i.get("every", 1) * unit_seconds.get(i.get("unit", "hours"), 3600)
        return (after + timedelta(seconds=seconds)).astimezone(pytz.utc)

    raise ValueError(f"Unknown schedule type: {stype}")
