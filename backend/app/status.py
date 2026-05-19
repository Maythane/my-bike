from datetime import date, datetime
from typing import Optional
from app.models import MaintenanceTask, MaintenanceLog, Motorcycle


def compute_status(
    task: MaintenanceTask,
    bike: Motorcycle,
    last_log: Optional[MaintenanceLog],
) -> dict:
    today = date.today()

    if last_log:
        base_km = last_log.mileage_at_service
        base_date = last_log.date_performed
    else:
        base_km = 0
        base_date = bike.created_at.date()

    current_km = bike.current_mileage
    if current_km < base_km:
        current_km = base_km

    km_progress: Optional[float] = None
    km_until_due: Optional[int] = None
    if task.interval_km:
        km_done = current_km - base_km
        km_progress = km_done / task.interval_km
        km_until_due = task.interval_km - km_done

    time_progress: Optional[float] = None
    days_until_due: Optional[int] = None
    if task.interval_months:
        months_elapsed = (
            (today.year - base_date.year) * 12 + (today.month - base_date.month)
            + (today.day - base_date.day) / 30
        )
        time_progress = months_elapsed / task.interval_months
        days_remaining = int((task.interval_months * 30) - (months_elapsed * 30))
        days_until_due = days_remaining

    scores = [s for s in [km_progress, time_progress] if s is not None]
    status_score = max(scores) if scores else 0.0

    if status_score >= 1.0:
        status_label = "overdue"
    elif status_score >= 0.75:
        status_label = "due_soon"
    else:
        status_label = "good"

    return {
        "status_score": round(status_score, 3),
        "status_label": status_label,
        "last_service_date": last_log.date_performed if last_log else None,
        "last_service_km": last_log.mileage_at_service if last_log else None,
        "km_until_due": km_until_due,
        "days_until_due": days_until_due,
    }
