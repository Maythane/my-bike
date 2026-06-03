from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session, select
from typing import Optional, List
from pydantic import BaseModel
import uuid

from app.database import get_session, DEFAULT_REMINDER_ITEMS
from app.models import ServiceReminder, User, Motorcycle
from app.auth import get_current_user
from app.utils import get_motorcycle_for_user

router = APIRouter(tags=["reminders"])

WARN_KM = 500
_DEFAULT_KEYS = {k for k, _, _ in DEFAULT_REMINDER_ITEMS}


class ReminderRead(BaseModel):
    id: int
    item_key: str
    item_name: str
    interval_km: int
    last_done_mileage: Optional[int]
    enabled: bool
    status: str
    km_remaining: Optional[int]
    is_custom: bool


class ReminderUpdate(BaseModel):
    item_key: str
    item_name: Optional[str] = None
    interval_km: int
    enabled: bool


class CreateReminderBody(BaseModel):
    item_name: str
    interval_km: int = 3000


class MarkDoneBody(BaseModel):
    mileage: Optional[int] = None
    interval_km: Optional[int] = None


def _compute_status(last_done: Optional[int], interval: int, current: int) -> tuple[str, Optional[int]]:
    if last_done is None:
        return "never", None
    remaining = (last_done + interval) - current
    if remaining <= 0:
        return "overdue", remaining
    if remaining <= WARN_KM:
        return "due_soon", remaining
    return "ok", remaining


def _ensure_reminders(bike_id: int, session: Session) -> None:
    existing_keys = set(
        session.exec(
            select(ServiceReminder.item_key).where(ServiceReminder.motorcycle_id == bike_id)
        ).all()
    )
    for key, name, interval in DEFAULT_REMINDER_ITEMS:
        if key not in existing_keys:
            session.add(ServiceReminder(
                motorcycle_id=bike_id,
                item_key=key,
                item_name=name,
                interval_km=interval,
            ))
    session.commit()


def _to_read(r: ServiceReminder, bike_current_mileage: int) -> ReminderRead:
    status, km_remaining = _compute_status(r.last_done_mileage, r.interval_km, bike_current_mileage)
    return ReminderRead(
        id=r.id,
        item_key=r.item_key,
        item_name=r.item_name,
        interval_km=r.interval_km,
        last_done_mileage=r.last_done_mileage,
        enabled=r.enabled,
        status=status,
        km_remaining=km_remaining,
        is_custom=r.item_key not in _DEFAULT_KEYS,
    )


@router.get("/api/motorcycles/{bike_id}/service-reminders", response_model=List[ReminderRead])
def get_reminders(
    bike_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    bike = get_motorcycle_for_user(bike_id, current_user, session)
    _ensure_reminders(bike_id, session)
    reminders = session.exec(
        select(ServiceReminder).where(ServiceReminder.motorcycle_id == bike_id)
    ).all()
    order = [k for k, _, _ in DEFAULT_REMINDER_ITEMS]
    reminders_sorted = sorted(reminders, key=lambda r: order.index(r.item_key) if r.item_key in order else 99)
    return [_to_read(r, bike.current_mileage) for r in reminders_sorted]


@router.post("/api/motorcycles/{bike_id}/service-reminders", response_model=ReminderRead, status_code=201)
def create_reminder(
    bike_id: int,
    body: CreateReminderBody,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    bike = get_motorcycle_for_user(bike_id, current_user, session)
    item_key = f"custom_{uuid.uuid4().hex[:8]}"
    reminder = ServiceReminder(
        motorcycle_id=bike_id,
        item_key=item_key,
        item_name=body.item_name.strip(),
        interval_km=body.interval_km,
    )
    session.add(reminder)
    session.commit()
    session.refresh(reminder)
    return _to_read(reminder, bike.current_mileage)


@router.put("/api/motorcycles/{bike_id}/service-reminders", response_model=List[ReminderRead])
def update_reminders(
    bike_id: int,
    updates: List[ReminderUpdate],
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    bike = get_motorcycle_for_user(bike_id, current_user, session)
    _ensure_reminders(bike_id, session)
    reminders_map = {
        r.item_key: r
        for r in session.exec(
            select(ServiceReminder).where(ServiceReminder.motorcycle_id == bike_id)
        ).all()
    }
    for upd in updates:
        reminder = reminders_map.get(upd.item_key)
        if not reminder:
            raise HTTPException(status_code=404, detail=f"Reminder {upd.item_key} not found")
        reminder.interval_km = upd.interval_km
        reminder.enabled = upd.enabled
        if upd.item_name and upd.item_name.strip():
            reminder.item_name = upd.item_name.strip()
        session.add(reminder)
    session.commit()
    return get_reminders(bike_id, session, current_user)


@router.delete("/api/motorcycles/{bike_id}/service-reminders/{item_key}", status_code=204)
def delete_reminder(
    bike_id: int,
    item_key: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    get_motorcycle_for_user(bike_id, current_user, session)
    if item_key in _DEFAULT_KEYS:
        raise HTTPException(status_code=400, detail="Cannot delete default reminders")
    reminder = session.exec(
        select(ServiceReminder)
        .where(ServiceReminder.motorcycle_id == bike_id)
        .where(ServiceReminder.item_key == item_key)
    ).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    session.delete(reminder)
    session.commit()


@router.post("/api/motorcycles/{bike_id}/service-reminders/{item_key}/done", response_model=ReminderRead)
def mark_done(
    bike_id: int,
    item_key: str,
    body: Optional[MarkDoneBody] = Body(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    bike = get_motorcycle_for_user(bike_id, current_user, session)
    reminder = session.exec(
        select(ServiceReminder)
        .where(ServiceReminder.motorcycle_id == bike_id)
        .where(ServiceReminder.item_key == item_key)
    ).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    reminder.last_done_mileage = (body.mileage if body and body.mileage is not None else None) or bike.current_mileage
    if body and body.interval_km is not None and body.interval_km > 0:
        reminder.interval_km = body.interval_km
    session.add(reminder)
    session.commit()
    session.refresh(reminder)
    return _to_read(reminder, bike.current_mileage)
