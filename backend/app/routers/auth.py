from datetime import datetime, timedelta, timezone
import logging
import re
import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_session
from app.models import User, AppSettings, ShockSetting
from app.auth import hash_password, verify_password, create_access_token, get_current_user

logger = logging.getLogger(__name__)

_otp_store: dict[str, tuple[str, datetime]] = {}
OTP_TTL_SECONDS = 300  # 5 minutes

def _send_otp(phone: str, code: str) -> None:
    logger.info("[OTP MOCK] %s → %s", phone, code)

def _generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"

def _store_otp(key: str, code: str) -> None:
    _otp_store[key] = (code, datetime.now(timezone.utc) + timedelta(seconds=OTP_TTL_SECONDS))

def _verify_otp(key: str, code: str) -> bool:
    entry = _otp_store.get(key)
    if not entry:
        return False
    stored_code, exp = entry
    if datetime.now(timezone.utc) > exp:
        _otp_store.pop(key, None)
        return False
    return stored_code == code


router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    identifier: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    id: int
    email: str
    username: Optional[str] = None
    phone: Optional[str] = None
    phone_verified: bool = False
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
    identifier = data.identifier.strip()
    user = None
    if "@" in identifier:
        user = session.exec(select(User).where(User.email == identifier.lower())).first()
    elif re.match(r"^\+?[0-9]{8,15}$", identifier):
        raise HTTPException(status_code=400, detail="เบอร์โทรต้องใช้ OTP — ใช้ /api/auth/otp/send")
    else:
        user = session.exec(select(User).where(User.username == identifier)).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="ไม่พบบัญชีหรือรหัสผ่านไม่ถูกต้อง")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    return TokenResponse(access_token=create_access_token(user.id))


class OtpSendRequest(BaseModel):
    phone: str


@router.post("/otp/send")
def otp_send(data: OtpSendRequest, session: Session = Depends(get_session)):
    phone = data.phone.strip()
    user = session.exec(select(User).where(User.phone == phone)).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบเบอร์โทรนี้ในระบบ")
    key = f"login:{phone}"
    if key in _otp_store:
        _, exp = _otp_store[key]
        if exp > datetime.now(timezone.utc) + timedelta(seconds=OTP_TTL_SECONDS - 60):
            raise HTTPException(status_code=429, detail="รอ 60 วินาทีก่อนขอ OTP ใหม่")
    code = _generate_otp()
    _store_otp(key, code)
    _send_otp(phone, code)
    return {"ok": True, "expires_in": OTP_TTL_SECONDS}


class OtpLoginRequest(BaseModel):
    phone: str
    otp_code: str


@router.post("/otp/login", response_model=TokenResponse)
def otp_login(data: OtpLoginRequest, session: Session = Depends(get_session)):
    phone = data.phone.strip()
    key = f"login:{phone}"
    if not _verify_otp(key, data.otp_code):
        raise HTTPException(status_code=401, detail="OTP ไม่ถูกต้องหรือหมดอายุ")
    _otp_store.pop(key, None)
    user = session.exec(select(User).where(User.phone == phone)).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบบัญชี")
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


class UpdateUsernameRequest(BaseModel):
    username: str


@router.put("/username", status_code=200)
def update_username(
    data: UpdateUsernameRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    username = data.username.strip()
    if not re.match(r"^[a-zA-Z0-9_]{3,30}$", username):
        raise HTTPException(status_code=422, detail="ใช้ได้เฉพาะ a-z 0-9 _ (3–30 ตัว)")
    if session.exec(select(User).where(User.username == username)).first():
        raise HTTPException(status_code=409, detail="Username นี้ถูกใช้แล้ว")
    current_user.username = username
    session.add(current_user)
    session.commit()
    return {"ok": True}


class PhoneRequestBody(BaseModel):
    phone: str


@router.post("/phone/request", status_code=200)
def phone_request(
    data: PhoneRequestBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    phone = data.phone.strip()
    existing = session.exec(select(User).where(User.phone == phone)).first()
    if existing and existing.id != current_user.id:
        raise HTTPException(status_code=409, detail="เบอร์นี้ถูกใช้แล้ว")
    key = f"verify:{phone}"
    if key in _otp_store:
        _, exp = _otp_store[key]
        if exp > datetime.now(timezone.utc) + timedelta(seconds=OTP_TTL_SECONDS - 60):
            raise HTTPException(status_code=429, detail="รอ 60 วินาทีก่อนขอ OTP ใหม่")
    code = _generate_otp()
    _store_otp(key, code)
    _send_otp(phone, code)
    return {"ok": True, "expires_in": OTP_TTL_SECONDS}


class PhoneConfirmBody(BaseModel):
    phone: str
    otp_code: str


@router.post("/phone/confirm", status_code=200)
def phone_confirm(
    data: PhoneConfirmBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    phone = data.phone.strip()
    key = f"verify:{phone}"
    if not _verify_otp(key, data.otp_code):
        raise HTTPException(status_code=401, detail="OTP ไม่ถูกต้องหรือหมดอายุ")
    _otp_store.pop(key, None)
    current_user.phone = phone
    current_user.phone_verified = True
    session.add(current_user)
    session.commit()
    return {"ok": True}
