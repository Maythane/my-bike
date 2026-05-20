from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_session
from app.models import User, AppSettings, ShockSetting
from app.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    id: int
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


def _seed_user_defaults(user: User, session: Session) -> None:
    """สร้าง AppSettings และ ShockSetting default สำหรับ user ใหม่"""
    if not session.exec(select(AppSettings).where(AppSettings.user_id == user.id)).first():
        session.add(AppSettings(user_id=user.id))
    if not session.exec(select(ShockSetting).where(ShockSetting.user_id == user.id)).first():
        session.add(ShockSetting(user_id=user.id))
    session.commit()


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: RegisterRequest, session: Session = Depends(get_session)):
    email = data.email.lower().strip()
    if session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if len(data.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    user = User(email=email, hashed_password=hash_password(data.password))
    session.add(user)
    session.commit()
    session.refresh(user)
    _seed_user_defaults(user, session)
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, session: Session = Depends(get_session)):
    email = data.email.lower().strip()
    user = session.exec(select(User).where(User.email == email)).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return current_user


class UpdateEmailRequest(BaseModel):
    new_email: str


class UpdatePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.put("/email", status_code=200)
def update_email(
    data: UpdateEmailRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    email = data.new_email.lower().strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=422, detail="Invalid email")
    if session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(status_code=409, detail="Email already in use")
    current_user.email = email
    session.add(current_user)
    session.commit()
    return {"ok": True}


@router.put("/password", status_code=200)
def update_password(
    data: UpdatePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password incorrect")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    current_user.hashed_password = hash_password(data.new_password)
    session.add(current_user)
    session.commit()
    return {"ok": True}
