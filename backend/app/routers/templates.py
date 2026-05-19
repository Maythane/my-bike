from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import List

from app.database import get_session
from app.models import TaskTemplate

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=List[TaskTemplate])
def list_templates(session: Session = Depends(get_session)):
    return session.exec(select(TaskTemplate).order_by(TaskTemplate.category, TaskTemplate.name)).all()
