from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from typing import List, Optional
from datetime import date as Date, datetime
from pydantic import BaseModel
import os, uuid

from app.database import get_session
from app.models import FuelLog, FuelLogImage, Motorcycle, User
from app.auth import get_current_user
from app.utils import recalc_odometer, save_compressed_image, get_motorcycle_for_user

router = APIRouter(tags=["fuel"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "fuel")
MAX_IMAGES = 5

FUEL_TYPES = ["E20", "E85", "91", "95", "ดีเซล", "อื่นๆ"]


class FuelLogCreate(BaseModel):
    date: Date
    mileage_at_fillup: int
    fuel_amount: float
    fuel_type: str = "E20"
    is_full_tank: bool = True
    cost: Optional[float] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class FuelLogUpdate(BaseModel):
    date: Optional[Date] = None
    mileage_at_fillup: Optional[int] = None
    fuel_amount: Optional[float] = None
    fuel_type: Optional[str] = None
    is_full_tank: Optional[bool] = None
    cost: Optional[float] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class FuelImageRead(BaseModel):
    id: int
    image_path: str


class FuelLogRead(BaseModel):
    id: int
    motorcycle_id: int
    date: Date
    mileage_at_fillup: int
    fuel_amount: float
    fuel_type: str
    is_full_tank: bool
    cost: Optional[float]
    location: Optional[str]
    notes: Optional[str]
    images: List[FuelImageRead]
    km_per_liter: Optional[float]
    distance_km: Optional[int]
    created_at: datetime


class FuelEconomy(BaseModel):
    avg_km_per_liter: Optional[float]
    last_km_per_liter: Optional[float]
    best_km_per_liter: Optional[float]
    total_fuel: float
    total_cost: Optional[float]
    total_logs: int


def _calc_kpl(logs: list[FuelLog]) -> tuple[list[Optional[float]], list[Optional[int]]]:
    sorted_logs = sorted(logs, key=lambda x: (x.date, x.id))
    kpls: list[Optional[float]] = [None] * len(logs)
    distances: list[Optional[int]] = [None] * len(logs)
    id_to_idx = {log.id: i for i, log in enumerate(logs)}
    last_full_idx: Optional[int] = None
    for i, log in enumerate(sorted_logs):
        if log.is_full_tank:
            if last_full_idx is not None:
                prev_full = sorted_logs[last_full_idx]
                dist = log.mileage_at_fillup - prev_full.mileage_at_fillup
                fuel_sum = sum(sorted_logs[j].fuel_amount for j in range(last_full_idx + 1, i + 1))
                if dist > 0 and fuel_sum > 0:
                    orig_idx = id_to_idx[log.id]
                    kpls[orig_idx] = round(dist / fuel_sum, 2)
                    distances[orig_idx] = dist
            last_full_idx = i
    return kpls, distances


def _to_read(log: FuelLog, kpl: Optional[float], distance_km: Optional[int], session: Session) -> FuelLogRead:
    imgs = session.exec(
        select(FuelLogImage)
        .where(FuelLogImage.log_id == log.id)
        .order_by(FuelLogImage.created_at)
    ).all()
    return FuelLogRead(
        id=log.id,
        motorcycle_id=log.motorcycle_id,
        date=log.date,
        mileage_at_fillup=log.mileage_at_fillup,
        fuel_amount=log.fuel_amount,
        fuel_type=log.fuel_type,
        is_full_tank=log.is_full_tank,
        cost=log.cost,
        location=log.location,
        notes=log.notes,
        images=[FuelImageRead(id=img.id, image_path=img.image_path) for img in imgs],
        km_per_liter=kpl,
        distance_km=distance_km,
        created_at=log.created_at,
    )


def _get_fuel_for_user(fuel_id: int, user: User, session: Session) -> FuelLog:
    log = session.get(FuelLog, fuel_id)
    if not log:
        raise HTTPException(status_code=404, detail="Not found")
    get_motorcycle_for_user(log.motorcycle_id, user, session)  # raises 404 if not owner
    return log


@router.get("/api/motorcycles/{bike_id}/fuel-logs", response_model=List[FuelLogRead])
def list_fuel_logs(
    bike_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    get_motorcycle_for_user(bike_id, current_user, session)
    logs = session.exec(
        select(FuelLog)
        .where(FuelLog.motorcycle_id == bike_id)
        .order_by(FuelLog.date.desc(), FuelLog.id.desc())
    ).all()
    kpls, distances = _calc_kpl(list(logs))
    return [_to_read(log, kpls[i], distances[i], session) for i, log in enumerate(logs)]


@router.get("/api/motorcycles/{bike_id}/fuel-economy", response_model=FuelEconomy)
def get_fuel_economy(
    bike_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    get_motorcycle_for_user(bike_id, current_user, session)
    logs = session.exec(
        select(FuelLog).where(FuelLog.motorcycle_id == bike_id).order_by(FuelLog.date.asc(), FuelLog.id.asc())
    ).all()
    kpls_raw = [kpl for kpl in _calc_kpl(list(logs))[0] if kpl is not None]
    total_fuel = sum(log.fuel_amount for log in logs)
    total_cost = sum(log.cost for log in logs if log.cost is not None) or None
    return FuelEconomy(
        avg_km_per_liter=round(sum(kpls_raw) / len(kpls_raw), 2) if kpls_raw else None,
        last_km_per_liter=kpls_raw[-1] if kpls_raw else None,
        best_km_per_liter=max(kpls_raw) if kpls_raw else None,
        total_fuel=round(total_fuel, 2),
        total_cost=round(total_cost, 2) if total_cost else None,
        total_logs=len(logs),
    )


@router.post("/api/motorcycles/{bike_id}/fuel-logs", response_model=FuelLogRead, status_code=201)
def create_fuel_log(
    bike_id: int,
    data: FuelLogCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    get_motorcycle_for_user(bike_id, current_user, session)
    log = FuelLog(motorcycle_id=bike_id, **data.model_dump())
    session.add(log)
    session.flush()
    recalc_odometer(bike_id, session)
    session.commit()
    session.refresh(log)
    all_logs = session.exec(
        select(FuelLog).where(FuelLog.motorcycle_id == bike_id).order_by(FuelLog.date.asc(), FuelLog.id.asc())
    ).all()
    kpls, distances = _calc_kpl(list(all_logs))
    id_kpl = {l.id: kpls[i] for i, l in enumerate(all_logs)}
    id_dist = {l.id: distances[i] for i, l in enumerate(all_logs)}
    return _to_read(log, id_kpl.get(log.id), id_dist.get(log.id), session)


@router.put("/api/fuel-logs/{log_id}", response_model=FuelLogRead)
def update_fuel_log(
    log_id: int,
    data: FuelLogUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    log = _get_fuel_for_user(log_id, current_user, session)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(log, field, value)
    session.add(log)
    session.flush()
    recalc_odometer(log.motorcycle_id, session)
    session.commit()
    session.refresh(log)
    all_logs = session.exec(
        select(FuelLog).where(FuelLog.motorcycle_id == log.motorcycle_id).order_by(FuelLog.date.asc(), FuelLog.id.asc())
    ).all()
    kpls, distances = _calc_kpl(list(all_logs))
    id_kpl = {l.id: kpls[i] for i, l in enumerate(all_logs)}
    id_dist = {l.id: distances[i] for i, l in enumerate(all_logs)}
    return _to_read(log, id_kpl.get(log.id), id_dist.get(log.id), session)


@router.post("/api/fuel-logs/{log_id}/images", response_model=FuelLogRead)
async def upload_fuel_log_image(
    log_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    log = _get_fuel_for_user(log_id, current_user, session)
    count = len(session.exec(
        select(FuelLogImage).where(FuelLogImage.log_id == log_id)
    ).all())
    if count >= MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_IMAGES} images per log")
    filename = f"{log_id}_{uuid.uuid4().hex[:8]}.jpg"
    dest = os.path.join(UPLOAD_DIR, filename)
    save_compressed_image(await file.read(), dest)
    img = FuelLogImage(log_id=log_id, image_path=f"/uploads/fuel/{filename}")
    session.add(img)
    session.commit()
    all_logs = session.exec(
        select(FuelLog).where(FuelLog.motorcycle_id == log.motorcycle_id).order_by(FuelLog.date.asc(), FuelLog.id.asc())
    ).all()
    kpls, distances = _calc_kpl(list(all_logs))
    id_kpl = {l.id: kpls[i] for i, l in enumerate(all_logs)}
    id_dist = {l.id: distances[i] for i, l in enumerate(all_logs)}
    return _to_read(log, id_kpl.get(log.id), id_dist.get(log.id), session)


@router.delete("/api/fuel-log-images/{img_id}", status_code=204)
def delete_fuel_log_image_by_id(
    img_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    img = session.get(FuelLogImage, img_id)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    _get_fuel_for_user(img.log_id, current_user, session)  # ownership check
    path = os.path.join(UPLOAD_DIR, os.path.basename(img.image_path))
    if os.path.exists(path):
        os.remove(path)
    session.delete(img)
    session.commit()


@router.delete("/api/fuel-logs/{log_id}", status_code=204)
def delete_fuel_log(
    log_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    log = _get_fuel_for_user(log_id, current_user, session)
    bike_id = log.motorcycle_id
    imgs = session.exec(select(FuelLogImage).where(FuelLogImage.log_id == log_id)).all()
    for img in imgs:
        path = os.path.join(UPLOAD_DIR, os.path.basename(img.image_path))
        if os.path.exists(path):
            os.remove(path)
        session.delete(img)
    if log.image_path:
        path = os.path.join(UPLOAD_DIR, os.path.basename(log.image_path))
        if os.path.exists(path):
            os.remove(path)
    session.delete(log)
    session.flush()
    recalc_odometer(bike_id, session)
    session.commit()
