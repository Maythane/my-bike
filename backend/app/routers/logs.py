from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from typing import List, Optional
from datetime import date as Date, datetime
from pydantic import BaseModel
import os, uuid

from app.database import get_session
from app.models import MaintenanceLog, MaintenanceLogImage, MaintenanceTask, Motorcycle, User
from app.auth import get_current_user
from app.utils import recalc_odometer, save_compressed_image, get_motorcycle_for_user, MAX_UPLOAD_BYTES

router = APIRouter(tags=["logs"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "service")
MAX_IMAGES = 5


class ServiceLogCreate(BaseModel):
    name: str
    date_performed: Date
    mileage_at_service: int
    cost: Optional[float] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class ServiceLogUpdate(BaseModel):
    name: Optional[str] = None
    date_performed: Optional[Date] = None
    mileage_at_service: Optional[int] = None
    cost: Optional[float] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class LogImageRead(BaseModel):
    id: int
    image_path: str


class ServiceLogRead(BaseModel):
    id: int
    task_id: int
    name: str
    date_performed: Date
    mileage_at_service: int
    cost: Optional[float]
    location: Optional[str]
    notes: Optional[str]
    images: List[LogImageRead]
    created_at: datetime


def _build_read(log: MaintenanceLog, task_name: str, session: Session) -> ServiceLogRead:
    imgs = session.exec(
        select(MaintenanceLogImage)
        .where(MaintenanceLogImage.log_id == log.id)
        .order_by(MaintenanceLogImage.created_at)
    ).all()
    return ServiceLogRead(
        id=log.id,
        task_id=log.task_id,
        name=task_name,
        date_performed=log.date_performed,
        mileage_at_service=log.mileage_at_service,
        cost=log.cost,
        location=log.location,
        notes=log.notes,
        images=[LogImageRead(id=img.id, image_path=img.image_path) for img in imgs],
        created_at=log.created_at,
    )


def _get_log_for_user(log_id: int, user: User, session: Session) -> MaintenanceLog:
    log = session.get(MaintenanceLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Not found")
    task = session.get(MaintenanceTask, log.task_id)
    get_motorcycle_for_user(task.motorcycle_id, user, session)  # raises 404 if not owner
    return log


@router.get("/api/motorcycles/{bike_id}/service-logs", response_model=List[ServiceLogRead])
def list_service_logs(
    bike_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    get_motorcycle_for_user(bike_id, current_user, session)
    tasks = session.exec(
        select(MaintenanceTask).where(MaintenanceTask.motorcycle_id == bike_id)
    ).all()
    if not tasks:
        return []
    task_map = {t.id: t.name for t in tasks}
    task_ids = [t.id for t in tasks]
    logs = session.exec(
        select(MaintenanceLog)
        .where(MaintenanceLog.task_id.in_(task_ids))
        .order_by(MaintenanceLog.date_performed.desc(), MaintenanceLog.id.desc())
    ).all()
    return [_build_read(log, task_map.get(log.task_id, "—"), session) for log in logs]


@router.post("/api/motorcycles/{bike_id}/service-logs", response_model=ServiceLogRead, status_code=201)
def create_service_log(
    bike_id: int,
    data: ServiceLogCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    get_motorcycle_for_user(bike_id, current_user, session)
    task = session.exec(
        select(MaintenanceTask)
        .where(MaintenanceTask.motorcycle_id == bike_id)
        .where(MaintenanceTask.name == data.name)
    ).first()
    if not task:
        task = MaintenanceTask(motorcycle_id=bike_id, name=data.name, is_active=True)
        session.add(task)
        session.flush()
    log = MaintenanceLog(
        task_id=task.id,
        date_performed=data.date_performed,
        mileage_at_service=data.mileage_at_service,
        cost=data.cost,
        location=data.location,
        notes=data.notes,
    )
    session.add(log)
    session.flush()
    recalc_odometer(bike_id, session)
    session.commit()
    session.refresh(log)
    return _build_read(log, task.name, session)


@router.put("/api/service-logs/{log_id}", response_model=ServiceLogRead)
def update_service_log(
    log_id: int,
    data: ServiceLogUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    log = _get_log_for_user(log_id, current_user, session)
    task = session.get(MaintenanceTask, log.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if data.name is not None and data.name != task.name:
        existing = session.exec(
            select(MaintenanceTask)
            .where(MaintenanceTask.motorcycle_id == task.motorcycle_id)
            .where(MaintenanceTask.name == data.name)
        ).first()
        if existing:
            log.task_id = existing.id
            task = existing
        else:
            task.name = data.name
            session.add(task)
    if data.date_performed is not None:
        log.date_performed = data.date_performed
    if data.mileage_at_service is not None:
        log.mileage_at_service = data.mileage_at_service
    if data.cost is not None:
        log.cost = data.cost
    if data.location is not None:
        log.location = data.location
    if data.notes is not None:
        log.notes = data.notes
    session.add(log)
    session.flush()
    recalc_odometer(task.motorcycle_id, session)
    session.commit()
    session.refresh(log)
    return _build_read(log, task.name, session)


@router.post("/api/service-logs/{log_id}/images", response_model=ServiceLogRead)
async def upload_service_log_image(
    log_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    log = _get_log_for_user(log_id, current_user, session)
    task = session.get(MaintenanceTask, log.task_id)
    count = len(session.exec(
        select(MaintenanceLogImage).where(MaintenanceLogImage.log_id == log_id)
    ).all())
    if count >= MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_IMAGES} images per log")
    filename = f"{log_id}_{uuid.uuid4().hex[:8]}.jpg"
    dest = os.path.join(UPLOAD_DIR, filename)
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="ไฟล์ใหญ่เกินไป (สูงสุด 10 MB)")
    save_compressed_image(data, dest)
    img = MaintenanceLogImage(log_id=log_id, image_path=f"/uploads/service/{filename}")
    session.add(img)
    session.commit()
    return _build_read(log, task.name if task else "—", session)


@router.delete("/api/service-log-images/{img_id}", status_code=204)
def delete_service_log_image_by_id(
    img_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    img = session.get(MaintenanceLogImage, img_id)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    _get_log_for_user(img.log_id, current_user, session)  # ownership check
    path = os.path.join(UPLOAD_DIR, os.path.basename(img.image_path))
    if os.path.exists(path):
        os.remove(path)
    session.delete(img)
    session.commit()


@router.delete("/api/service-logs/{log_id}", status_code=204)
def delete_service_log(
    log_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    log = _get_log_for_user(log_id, current_user, session)
    task = session.get(MaintenanceTask, log.task_id)
    bike_id = task.motorcycle_id if task else None
    imgs = session.exec(select(MaintenanceLogImage).where(MaintenanceLogImage.log_id == log_id)).all()
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
    if bike_id:
        recalc_odometer(bike_id, session)
    session.commit()

