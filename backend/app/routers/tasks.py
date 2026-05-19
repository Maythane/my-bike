from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional, Any
from pydantic import BaseModel

from app.database import get_session
from app.models import MaintenanceTask, MaintenanceLog, Motorcycle, TaskTemplate, PriorityEnum
from app.status import compute_status

router = APIRouter(tags=["tasks"])


class TaskCreate(BaseModel):
    name: str
    interval_km: Optional[int] = None
    interval_months: Optional[int] = None
    priority: PriorityEnum = PriorityEnum.medium
    notes: Optional[str] = None


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    interval_km: Optional[int] = None
    interval_months: Optional[int] = None
    priority: Optional[PriorityEnum] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class TaskFromTemplate(BaseModel):
    template_id: int


class TaskWithStatus(BaseModel):
    id: int
    motorcycle_id: int
    name: str
    interval_km: Optional[int]
    interval_months: Optional[int]
    priority: str
    is_active: bool
    notes: Optional[str]
    status_score: float
    status_label: str
    last_service_date: Optional[Any]
    last_service_km: Optional[int]
    km_until_due: Optional[int]
    days_until_due: Optional[int]


def _get_bike_or_404(bike_id: int, session: Session) -> Motorcycle:
    bike = session.get(Motorcycle, bike_id)
    if not bike:
        raise HTTPException(status_code=404, detail="Motorcycle not found")
    return bike


def _get_task_or_404(task_id: int, session: Session) -> MaintenanceTask:
    task = session.get(MaintenanceTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def _enrich_task(task: MaintenanceTask, bike: Motorcycle, session: Session) -> TaskWithStatus:
    last_log = session.exec(
        select(MaintenanceLog)
        .where(MaintenanceLog.task_id == task.id)
        .order_by(MaintenanceLog.date_performed.desc())
        .limit(1)
    ).first()
    status = compute_status(task, bike, last_log)
    return TaskWithStatus(**task.model_dump(), **status)


@router.get("/api/motorcycles/{bike_id}/tasks", response_model=List[TaskWithStatus])
def list_tasks(bike_id: int, session: Session = Depends(get_session)):
    bike = _get_bike_or_404(bike_id, session)
    _PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}
    tasks = session.exec(
        select(MaintenanceTask)
        .where(MaintenanceTask.motorcycle_id == bike_id)
        .where(MaintenanceTask.is_active == True)
    ).all()
    tasks = sorted(tasks, key=lambda t: _PRIORITY_ORDER.get(t.priority, 99))
    return [_enrich_task(t, bike, session) for t in tasks]


@router.post("/api/motorcycles/{bike_id}/tasks", response_model=TaskWithStatus, status_code=201)
def create_task(bike_id: int, data: TaskCreate, session: Session = Depends(get_session)):
    bike = _get_bike_or_404(bike_id, session)
    if not data.interval_km and not data.interval_months:
        raise HTTPException(status_code=422, detail="At least one of interval_km or interval_months is required")
    task = MaintenanceTask(motorcycle_id=bike_id, **data.model_dump())
    session.add(task)
    session.commit()
    session.refresh(task)
    return _enrich_task(task, bike, session)


@router.post("/api/motorcycles/{bike_id}/tasks/from-template", response_model=TaskWithStatus, status_code=201)
def create_task_from_template(
    bike_id: int, data: TaskFromTemplate, session: Session = Depends(get_session)
):
    bike = _get_bike_or_404(bike_id, session)
    template = session.get(TaskTemplate, data.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    task = MaintenanceTask(
        motorcycle_id=bike_id,
        name=template.name,
        interval_km=template.default_interval_km,
        interval_months=template.default_interval_months,
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return _enrich_task(task, bike, session)


@router.put("/api/tasks/{task_id}", response_model=TaskWithStatus)
def update_task(task_id: int, data: TaskUpdate, session: Session = Depends(get_session)):
    task = _get_task_or_404(task_id, session)
    bike = _get_bike_or_404(task.motorcycle_id, session)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    session.add(task)
    session.commit()
    session.refresh(task)
    return _enrich_task(task, bike, session)


@router.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, session: Session = Depends(get_session)):
    task = _get_task_or_404(task_id, session)
    task.is_active = False
    session.add(task)
    session.commit()
