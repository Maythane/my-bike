from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.database import get_session
from app.models import Profile, Motorcycle, MaintenanceTask, MaintenanceLog, UnitEnum

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


class ProfileCreate(BaseModel):
    name: str
    icon: str = "🏍️"
    color_accent: str = "#39FF14"
    unit: Optional[UnitEnum] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color_accent: Optional[str] = None
    unit: Optional[UnitEnum] = None


class ProfileRead(BaseModel):
    id: int
    name: str
    icon: str
    color_accent: str
    unit: Optional[UnitEnum]
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=List[ProfileRead])
def list_profiles(session: Session = Depends(get_session)):
    return session.exec(select(Profile).order_by(Profile.created_at)).all()


@router.post("", response_model=ProfileRead, status_code=201)
def create_profile(data: ProfileCreate, session: Session = Depends(get_session)):
    profile = Profile(**data.model_dump())
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


@router.put("/{profile_id}", response_model=ProfileRead)
def update_profile(profile_id: int, data: ProfileUpdate, session: Session = Depends(get_session)):
    profile = session.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


@router.delete("/{profile_id}", status_code=204)
def delete_profile(profile_id: int, session: Session = Depends(get_session)):
    profile = session.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    session.delete(profile)
    session.commit()


@router.get("/{profile_id}/export")
def export_profile(profile_id: int, session: Session = Depends(get_session)):
    profile = session.get(Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    bikes = session.exec(
        select(Motorcycle).where(Motorcycle.profile_id == profile_id)
    ).all()

    result = profile.model_dump()
    result["motorcycles"] = []

    for bike in bikes:
        bike_data = bike.model_dump()
        bike_data["tasks"] = []
        tasks = session.exec(
            select(MaintenanceTask).where(MaintenanceTask.motorcycle_id == bike.id)
        ).all()
        for task in tasks:
            task_data = task.model_dump()
            logs = session.exec(
                select(MaintenanceLog).where(MaintenanceLog.task_id == task.id)
            ).all()
            task_data["logs"] = [log.model_dump() for log in logs]
            bike_data["tasks"].append(task_data)
        result["motorcycles"].append(bike_data)

    return result
