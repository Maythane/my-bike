from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import Optional
from pydantic import BaseModel

from app.database import get_session
from app.models import AppSettings, UnitEnum, User
from app.auth import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    default_unit: Optional[UnitEnum] = None
    timezone: Optional[str] = None


@router.get("", response_model=AppSettings)
def get_settings(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    settings = session.exec(
        select(AppSettings).where(AppSettings.user_id == current_user.id)
    ).first()
    if not settings:
        settings = AppSettings(user_id=current_user.id)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


@router.put("", response_model=AppSettings)
def update_settings(
    data: SettingsUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    settings = session.exec(
        select(AppSettings).where(AppSettings.user_id == current_user.id)
    ).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings
