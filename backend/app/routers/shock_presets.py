from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import Optional, List
from pydantic import BaseModel

from app.database import get_session
from app.models import ShockPreset

router = APIRouter(prefix="/api/shock-presets", tags=["shock"])


class ShockPresetCreate(BaseModel):
    name: str
    rider_weight: float
    passenger_weight: float
    mode: str
    preload: float
    comp: int
    reb: int
    note: Optional[str] = None


class ShockPresetUpdate(BaseModel):
    name: Optional[str] = None
    rider_weight: Optional[float] = None
    passenger_weight: Optional[float] = None
    mode: Optional[str] = None
    preload: Optional[float] = None
    comp: Optional[int] = None
    reb: Optional[int] = None
    note: Optional[str] = None


@router.get("", response_model=List[ShockPreset])
def list_presets(session: Session = Depends(get_session)):
    return session.exec(select(ShockPreset).order_by(ShockPreset.created_at.desc())).all()


@router.post("", response_model=ShockPreset)
def create_preset(data: ShockPresetCreate, session: Session = Depends(get_session)):
    preset = ShockPreset(**data.model_dump())
    session.add(preset)
    session.commit()
    session.refresh(preset)
    return preset


@router.patch("/{preset_id}", response_model=ShockPreset)
def update_preset(preset_id: int, data: ShockPresetUpdate, session: Session = Depends(get_session)):
    preset = session.get(ShockPreset, preset_id)
    if not preset:
        raise HTTPException(status_code=404)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(preset, field, value)
    session.add(preset)
    session.commit()
    session.refresh(preset)
    return preset


@router.delete("/{preset_id}", status_code=204)
def delete_preset(preset_id: int, session: Session = Depends(get_session)):
    preset = session.get(ShockPreset, preset_id)
    if not preset:
        raise HTTPException(status_code=404)
    session.delete(preset)
    session.commit()
