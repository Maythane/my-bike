from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy import text
from typing import Optional
import json
from pydantic import BaseModel

from app.database import get_session
from app.models import ShockSetting, User
from app.auth import get_current_user
from app.utils import get_motorcycle_for_user

router = APIRouter(tags=["shock"])


class ShockSettingUpdate(BaseModel):
    rider_weight: Optional[float] = None
    passenger_weight: Optional[float] = None
    mode: Optional[str] = None
    shock_brand: Optional[str] = None
    shock_model: Optional[str] = None


def _get_or_create(bike_id: int, user: User, session: Session) -> ShockSetting:
    get_motorcycle_for_user(bike_id, user, session)  # ownership check — raises 404 if not owner
    setting = session.exec(
        select(ShockSetting).where(ShockSetting.motorcycle_id == bike_id)
    ).first()
    if not setting:
        setting = ShockSetting(motorcycle_id=bike_id, user_id=user.id)
        session.add(setting)
        session.commit()
        session.refresh(setting)
    return setting


@router.get("/api/motorcycles/{bike_id}/shock-setting", response_model=ShockSetting)
def get_shock_setting(
    bike_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return _get_or_create(bike_id, current_user, session)


@router.get("/api/motorcycles/{bike_id}/shock-chart")
def get_shock_chart(
    bike_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    setting = _get_or_create(bike_id, current_user, session)
    if not setting.shock_brand:
        return {"bands": None}
    # Try brand+model first, then brand-only (shock_model IS NULL)
    row = session.exec(
        select(text("chart_data")).select_from(text("shock_charts"))
        .where(text("shock_brand = :b AND shock_model = :m"))
        .params(b=setting.shock_brand, m=setting.shock_model)
    ).first()
    if not row and setting.shock_model:
        row = session.exec(
            select(text("chart_data")).select_from(text("shock_charts"))
            .where(text("shock_brand = :b AND shock_model IS NULL"))
            .params(b=setting.shock_brand)
        ).first()
    if not row:
        return {"bands": None}
    return {"bands": json.loads(row[0])}


@router.put("/api/motorcycles/{bike_id}/shock-setting", response_model=ShockSetting)
def update_shock_setting(
    bike_id: int,
    data: ShockSettingUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    setting = _get_or_create(bike_id, current_user, session)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(setting, field, value)
    session.add(setting)
    session.commit()
    session.refresh(setting)
    return setting
