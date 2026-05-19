from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import Optional
from pydantic import BaseModel

from app.database import get_session
from app.models import ShockSetting, User
from app.auth import get_current_user

router = APIRouter(prefix="/api/shock-setting", tags=["shock"])


class ShockSettingUpdate(BaseModel):
    rider_weight: Optional[float] = None
    passenger_weight: Optional[float] = None
    mode: Optional[str] = None


def _get_or_create(user: User, session: Session) -> ShockSetting:
    setting = session.exec(
        select(ShockSetting).where(ShockSetting.user_id == user.id)
    ).first()
    if not setting:
        setting = ShockSetting(user_id=user.id)
        session.add(setting)
        session.commit()
        session.refresh(setting)
    return setting


@router.get("", response_model=ShockSetting)
def get_shock_setting(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return _get_or_create(current_user, session)


@router.put("", response_model=ShockSetting)
def update_shock_setting(
    data: ShockSettingUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    setting = _get_or_create(current_user, session)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(setting, field, value)
    session.add(setting)
    session.commit()
    session.refresh(setting)
    return setting
