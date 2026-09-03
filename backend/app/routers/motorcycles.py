from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import os, uuid

from app.database import get_session
from app.models import Motorcycle, Profile, UnitEnum, User
from app.auth import get_current_user
from app.utils import get_motorcycle_for_user, save_compressed_image, MAX_UPLOAD_BYTES

router = APIRouter(tags=["motorcycles"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "bikes")


class MotorcycleCreate(BaseModel):
    make: str
    model: str
    year: int
    nickname: Optional[str] = None
    color: Optional[str] = None
    license_plate: Optional[str] = None
    registration_year: Optional[int] = None
    engine_cc: Optional[int] = None
    tank_capacity: Optional[float] = None
    current_mileage: int = 0
    mileage_unit: Optional[UnitEnum] = None


class MotorcycleUpdate(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    nickname: Optional[str] = None
    color: Optional[str] = None
    license_plate: Optional[str] = None
    registration_year: Optional[int] = None
    engine_cc: Optional[int] = None
    tank_capacity: Optional[float] = None
    current_mileage: Optional[int] = None
    mileage_unit: Optional[UnitEnum] = None


class MotorcycleRead(BaseModel):
    id: int
    profile_id: int
    make: str
    model: str
    year: int
    nickname: Optional[str]
    color: Optional[str]
    license_plate: Optional[str]
    registration_year: Optional[int]
    engine_cc: Optional[int]
    tank_capacity: Optional[float]
    current_mileage: int
    mileage_unit: Optional[UnitEnum]
    image_path: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/api/profiles/{profile_id}/motorcycles", response_model=List[MotorcycleRead])
def list_motorcycles(
    profile_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    profile = session.get(Profile, profile_id)
    if not profile or profile.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    return session.exec(
        select(Motorcycle)
        .where(Motorcycle.profile_id == profile_id)
        .order_by(Motorcycle.created_at)
    ).all()


@router.post("/api/profiles/{profile_id}/motorcycles", response_model=MotorcycleRead, status_code=201)
def create_motorcycle(
    profile_id: int,
    data: MotorcycleCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    profile = session.get(Profile, profile_id)
    if not profile or profile.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    bike = Motorcycle(profile_id=profile_id, **data.model_dump())
    session.add(bike)
    session.commit()
    session.refresh(bike)
    return bike


@router.get("/api/motorcycles", response_model=List[MotorcycleRead])
def list_all_motorcycles(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    user_profile_ids = [
        p.id for p in session.exec(
            select(Profile).where(Profile.user_id == current_user.id)
        ).all()
    ]
    return session.exec(
        select(Motorcycle)
        .where(Motorcycle.profile_id.in_(user_profile_ids))
        .order_by(Motorcycle.created_at)
    ).all()


@router.post("/api/motorcycles", response_model=MotorcycleRead, status_code=201)
def create_motorcycle_simple(
    data: MotorcycleCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    profile = session.exec(
        select(Profile)
        .where(Profile.user_id == current_user.id)
        .order_by(Profile.created_at)
    ).first()
    if not profile:
        profile = Profile(name="default", icon="🏍️", color_accent="#6e5dd4", user_id=current_user.id)
        session.add(profile)
        session.commit()
        session.refresh(profile)
    bike = Motorcycle(profile_id=profile.id, **data.model_dump())
    session.add(bike)
    session.commit()
    session.refresh(bike)
    return bike


@router.get("/api/motorcycles/{bike_id}", response_model=MotorcycleRead)
def get_motorcycle(
    bike_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return get_motorcycle_for_user(bike_id, current_user, session)


@router.put("/api/motorcycles/{bike_id}", response_model=MotorcycleRead)
def update_motorcycle(
    bike_id: int,
    data: MotorcycleUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    bike = get_motorcycle_for_user(bike_id, current_user, session)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(bike, field, value)
    session.add(bike)
    session.commit()
    session.refresh(bike)
    return bike


@router.post("/api/motorcycles/{bike_id}/image", response_model=MotorcycleRead)
async def upload_bike_image(
    bike_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    bike = get_motorcycle_for_user(bike_id, current_user, session)
    filename = f"{bike_id}_{uuid.uuid4().hex[:8]}.jpg"
    dest = os.path.join(UPLOAD_DIR, filename)
    if bike.image_path:
        old = os.path.join(UPLOAD_DIR, os.path.basename(bike.image_path))
        if os.path.exists(old):
            os.remove(old)
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="ไฟล์ใหญ่เกินไป (สูงสุด 10 MB)")
    save_compressed_image(data, dest)
    bike.image_path = f"/uploads/bikes/{filename}"
    session.add(bike)
    session.commit()
    session.refresh(bike)
    return bike


@router.delete("/api/motorcycles/{bike_id}/image", response_model=MotorcycleRead)
def delete_bike_image(
    bike_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    bike = get_motorcycle_for_user(bike_id, current_user, session)
    if bike.image_path:
        path = os.path.join(UPLOAD_DIR, os.path.basename(bike.image_path))
        if os.path.exists(path):
            os.remove(path)
        bike.image_path = None
        session.add(bike)
        session.commit()
        session.refresh(bike)
    return bike


@router.delete("/api/motorcycles/{bike_id}", status_code=204)
def delete_motorcycle(
    bike_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    bike = get_motorcycle_for_user(bike_id, current_user, session)
    if bike.image_path:
        path = os.path.join(UPLOAD_DIR, os.path.basename(bike.image_path))
        if os.path.exists(path):
            os.remove(path)
    session.delete(bike)
    session.commit()
