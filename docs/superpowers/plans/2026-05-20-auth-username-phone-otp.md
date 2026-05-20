# Auth: Username / Phone OTP Login + Account Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow login with email, username, or phone (OTP); let users set username and verified phone in account settings; fix avatar dropdown CSS transparency on mobile.

**Architecture:** Single `identifier` field replaces `email` in login; backend detects type by content (`@` = email, digits = phone, else = username). OTP is in-memory with 5-min TTL, mocked to console. Username and phone are nullable unique fields on User, added via idempotent startup migration.

**Tech Stack:** FastAPI + SQLModel + SQLite (backend), React 19 + TypeScript + TanStack Query v5 + React Router v7 (frontend), Jelly Glass CSS.

---

## File Map

| File | Change |
|------|--------|
| `backend/app/models.py` | Add `username`, `phone`, `phone_verified` to `User` |
| `backend/app/database.py` | Add migration for 3 new user columns |
| `backend/app/routers/auth.py` | Update `UserRead`, `LoginRequest`; add OTP store + 5 new endpoints |
| `frontend/src/api/auth.ts` | Update `fetchLogin`, `UserInfo`; add 5 new API functions |
| `frontend/src/hooks/useAuth.ts` | Rename `login` param; add `loginWithOtp` |
| `frontend/src/pages/AuthPage.tsx` | Auto-detect identifier; add OTP step UI for phone login |
| `frontend/src/components/ui/AccountModal.tsx` | Add Username and Phone tabs |
| `frontend/src/components/ui/AvatarMenu.tsx` | Use username if set; fix initial |
| `frontend/src/index.css` | Fix `.avatar-dropdown` background opacity |

---

## Task 1: User Model + DB Migration

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/database.py`

- [ ] **Step 1: Add fields to User model**

Open `backend/app/models.py`. Find the `User` class (currently ends at `is_admin`). Add three fields:

```python
class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)
    username: Optional[str] = Field(default=None, unique=True, index=True)
    phone: Optional[str] = Field(default=None, unique=True, index=True)
    phone_verified: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    profiles: List["Profile"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
```

- [ ] **Step 2: Add migration to database.py**

Open `backend/app/database.py`. Find `_migrate_shock_per_bike()`. Append three entries to its `new_columns` list (inside the `with engine.connect() as conn:` block, before the `conn.commit()`):

```python
new_columns = [
    # ... existing entries ...
    ("users", "username",       "TEXT UNIQUE"),
    ("users", "phone",          "TEXT UNIQUE"),
    ("users", "phone_verified", "INTEGER NOT NULL DEFAULT 0"),
]
```

The existing idempotent loop already handles `col_exists` checking — no additional code needed.

- [ ] **Step 3: Verify migration runs**

```bash
cd /Volumes/Maythane/My-Project/My-bike
AUTH_SECRET_KEY="test" python3 -c "
import sys; sys.path.insert(0,'backend')
from app.database import create_db
create_db()
print('OK')
"
```

Expected output: `OK` (no errors)

Then confirm columns exist:

```bash
sqlite3 data/moto.db "PRAGMA table_info(users);" | grep -E "username|phone"
```

Expected: two rows showing `username` and `phone` and `phone_verified`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/models.py backend/app/database.py
git commit -m "feat: add username/phone/phone_verified fields to User model"
```

---

## Task 2: Backend — Update Login + Add OTP Infrastructure

**Files:**
- Modify: `backend/app/routers/auth.py`

- [ ] **Step 1: Update imports at top of auth.py**

Add `random`, `re`, `timedelta`, `timezone` to the import section:

```python
from datetime import datetime, timedelta, timezone
import random
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_session
from app.models import User, AppSettings, ShockSetting
from app.auth import hash_password, verify_password, create_access_token, get_current_user
```

- [ ] **Step 2: Add OTP store and helper — above the router definition**

```python
_otp_store: dict[str, tuple[str, datetime]] = {}
OTP_TTL_SECONDS = 300  # 5 minutes

def _send_otp(phone: str, code: str) -> None:
    print(f"[OTP MOCK] {phone} → {code}", flush=True)

def _generate_otp() -> str:
    return f"{random.randint(0, 999999):06d}"

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
```

- [ ] **Step 3: Update LoginRequest and UserRead**

Replace existing `LoginRequest` and `UserRead` classes:

```python
class LoginRequest(BaseModel):
    identifier: str
    password: str


class UserRead(BaseModel):
    id: int
    email: str
    username: Optional[str] = None
    phone: Optional[str] = None
    phone_verified: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}
```

Add `from typing import Optional` to imports if not already present (check top of file).

- [ ] **Step 4: Update login endpoint**

Replace the existing `@router.post("/login")` function:

```python
@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, session: Session = Depends(get_session)):
    identifier = data.identifier.strip()
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
```

- [ ] **Step 5: Verify login still works with email**

Start the server in background:
```bash
AUTH_SECRET_KEY="test" python3 server.py &
sleep 3
```

Test login with email (use an existing account — register one first if needed):
```bash
curl -s -X POST http://localhost:8764/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@test.com","password":"password123"}' | python3 -m json.tool
```

Expected: `{"access_token": "...", "token_type": "bearer"}` or `401` if no such user.

Register then login:
```bash
curl -s -X POST http://localhost:8764/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}' | python3 -m json.tool

curl -s -X POST http://localhost:8764/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@test.com","password":"password123"}' | python3 -m json.tool
```

Expected second call: `{"access_token": "...", "token_type": "bearer"}`

Stop server: `kill %1`

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/auth.py
git commit -m "feat: update login to accept identifier; add OTP infrastructure"
```

---

## Task 3: Backend — OTP Login Endpoints

**Files:**
- Modify: `backend/app/routers/auth.py`

- [ ] **Step 1: Add OTP send endpoint**

Append after the existing `login` endpoint:

```python
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
```

- [ ] **Step 2: Add OTP login endpoint**

```python
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
```

- [ ] **Step 3: Verify OTP endpoints**

```bash
AUTH_SECRET_KEY="test" python3 server.py &
sleep 3
```

Try sending OTP to unregistered phone (expect 404):
```bash
curl -s -X POST http://localhost:8764/api/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"0812345678"}' | python3 -m json.tool
```
Expected: `{"detail": "ไม่พบเบอร์โทรนี้ในระบบ"}`

Try OTP login with wrong code (expect 401):
```bash
curl -s -X POST http://localhost:8764/api/auth/otp/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"0812345678","otp_code":"000000"}' | python3 -m json.tool
```
Expected: `{"detail": "OTP ไม่ถูกต้องหรือหมดอายุ"}`

Stop server: `kill %1`

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/auth.py
git commit -m "feat: add OTP send and OTP login endpoints"
```

---

## Task 4: Backend — Username + Phone Account Endpoints

**Files:**
- Modify: `backend/app/routers/auth.py`

- [ ] **Step 1: Add update-username endpoint**

Append after the existing `update_password` endpoint:

```python
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
```

- [ ] **Step 2: Add phone request endpoint**

```python
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
```

- [ ] **Step 3: Add phone confirm endpoint**

```python
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
```

- [ ] **Step 4: Verify all new endpoints are registered**

```bash
AUTH_SECRET_KEY="test" python3 server.py &
sleep 3
curl -s http://localhost:8764/openapi.json | python3 -c "
import json,sys
paths = json.load(sys.stdin)['paths']
for p in sorted(paths):
    if 'auth' in p:
        print(p)
"
kill %1
```

Expected output includes:
```
/api/auth/login
/api/auth/me
/api/auth/otp/login
/api/auth/otp/send
/api/auth/phone/confirm
/api/auth/phone/request
/api/auth/register
/api/auth/username
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/auth.py
git commit -m "feat: add username, phone request/confirm account endpoints"
```

---

## Task 5: Frontend — API Layer + useAuth

**Files:**
- Modify: `frontend/src/api/auth.ts`
- Modify: `frontend/src/hooks/useAuth.ts`

- [ ] **Step 1: Update UserInfo type and fetchLogin in api/auth.ts**

Replace the current `UserInfo` interface and `fetchLogin` function:

```typescript
export interface UserInfo {
  id: number;
  email: string;
  username: string | null;
  phone: string | null;
  phone_verified: boolean;
  created_at: string;
}

export async function fetchLogin(identifier: string, password: string): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>("/api/auth/login", { identifier, password });
  return data;
}
```

- [ ] **Step 2: Add new API functions to api/auth.ts**

Append after the existing `fetchUpdatePassword`:

```typescript
export async function sendOtp(phone: string): Promise<void> {
  await client.post("/api/auth/otp/send", { phone });
}

export async function otpLogin(phone: string, otp_code: string): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>("/api/auth/otp/login", { phone, otp_code });
  return data;
}

export async function fetchUpdateUsername(username: string): Promise<void> {
  await client.put("/api/auth/username", { username });
}

export async function fetchRequestPhone(phone: string): Promise<void> {
  await client.post("/api/auth/phone/request", { phone });
}

export async function fetchConfirmPhone(phone: string, otp_code: string): Promise<void> {
  await client.post("/api/auth/phone/confirm", { phone, otp_code });
}
```

- [ ] **Step 3: Update useAuth.ts**

Replace the entire file content:

```typescript
import { fetchLogin, fetchRegister, otpLogin } from "../api/auth";

const TOKEN_KEY = "moto_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function useAuth() {
  const isAuthenticated = !!getToken();

  async function login(identifier: string, password: string): Promise<void> {
    const { access_token } = await fetchLogin(identifier, password);
    setToken(access_token);
  }

  async function loginWithOtp(phone: string, otp_code: string): Promise<void> {
    const { access_token } = await otpLogin(phone, otp_code);
    setToken(access_token);
  }

  async function register(email: string, password: string): Promise<void> {
    const { access_token } = await fetchRegister(email, password);
    setToken(access_token);
  }

  function logout(): void {
    clearToken();
    window.location.href = "/login";
  }

  return { isAuthenticated, login, loginWithOtp, register, logout };
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Volumes/Maythane/My-Project/My-bike/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `fetchLogin`, `UserInfo`, or `useAuth`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/auth.ts frontend/src/hooks/useAuth.ts
git commit -m "feat: update auth API for identifier login; add OTP + username + phone functions"
```

---

## Task 6: Frontend — AuthPage OTP Flow

**Files:**
- Modify: `frontend/src/pages/AuthPage.tsx`

- [ ] **Step 1: Replace AuthPage.tsx entirely**

```typescript
import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { sendOtp } from "../api/auth";
import Blobs from "../components/ui/Blobs";

type Tab = "login" | "register";

function isPhoneIdentifier(value: string): boolean {
  return /^\+?[0-9]{8,15}$/.test(value.trim());
}

export default function AuthPage() {
  const { isAuthenticated, login, loginWithOtp, register } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // OTP state (phone login only)
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const isPhone = tab === "login" && isPhoneIdentifier(identifier);

  function resetOtp() {
    setOtpSent(false);
    setOtp("");
    setCountdown(0);
  }

  function handleTabChange(t: Tab) {
    setTab(t);
    setError(null);
    resetOtp();
  }

  async function handleSendOtp() {
    setError(null);
    setLoading(true);
    try {
      await sendOtp(identifier.trim());
      setOtpSent(true);
      setCountdown(300);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "ส่ง OTP ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (tab === "register" && password !== confirm) {
      setError("Password ไม่ตรงกัน");
      return;
    }
    setLoading(true);
    try {
      if (tab === "login" && isPhone && otpSent) {
        await loginWithOtp(identifier.trim(), otp.trim());
      } else if (tab === "login") {
        await login(identifier.trim(), password);
      } else {
        await register(identifier.trim(), password);
      }
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  return (
    <div className="auth-page">
      <Blobs />
      <div className="auth-card">
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>🏍️</div>
          <h1>Moto Tracker</h1>
          <h2>ติดตามการบำรุงรักษารถมอเตอร์ไซค์</h2>
        </div>

        <div className="auth-tabs">
          <div
            className={`auth-tab${tab === "login" ? " active" : ""}`}
            onClick={() => handleTabChange("login")}
          >
            เข้าสู่ระบบ
          </div>
          <div
            className={`auth-tab${tab === "register" ? " active" : ""}`}
            onClick={() => handleTabChange("register")}
          >
            สมัครสมาชิก
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            {tab === "register" ? "Email" : "Email / Username / เบอร์โทร"}
            <input
              type="text"
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); resetOtp(); setError(null); }}
              placeholder={tab === "register" ? "you@example.com" : "Email, username หรือเบอร์โทร"}
              required
              autoFocus
              autoComplete="username"
            />
          </label>

          {/* Phone OTP flow */}
          {isPhone && !otpSent && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={handleSendOtp}
              style={{ marginTop: "0.25rem" }}
            >
              {loading ? "กำลังส่ง…" : "ส่ง OTP"}
            </button>
          )}

          {isPhone && otpSent && (
            <>
              <label>
                รหัส OTP (6 หลัก)
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  required
                  autoFocus
                />
              </label>
              <div style={{ fontSize: 12, color: "var(--slate)", marginTop: -8 }}>
                {countdown > 0
                  ? `OTP หมดอายุใน ${mm}:${ss}`
                  : "OTP หมดอายุแล้ว"}
                {countdown === 0 && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading}
                    style={{ marginLeft: 8, color: "var(--purple)", background: "none",
                             border: "none", cursor: "pointer", fontSize: 12 }}
                  >
                    ส่งใหม่
                  </button>
                )}
              </div>
            </>
          )}

          {/* Password flow (non-phone) */}
          {!isPhone && (
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete={tab === "login" ? "current-password" : "new-password"}
              />
            </label>
          )}

          {tab === "register" && (
            <label>
              Confirm Password
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </label>
          )}

          {error && <p className="auth-error">{error}</p>}

          {/* Submit button: hidden when phone but OTP not sent yet */}
          {!(isPhone && !otpSent) && (
            <button
              type="submit"
              disabled={loading || (isPhone && otpSent && otp.length < 6)}
              className="btn btn-primary"
              style={{ marginTop: "0.5rem" }}
            >
              {loading
                ? "กำลังดำเนินการ…"
                : tab === "login"
                  ? isPhone ? "ยืนยัน OTP" : "เข้าสู่ระบบ"
                  : "สมัครสมาชิก"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Volumes/Maythane/My-Project/My-bike/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in `AuthPage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AuthPage.tsx
git commit -m "feat: AuthPage auto-detect identifier; add phone OTP login flow"
```

---

## Task 7: Frontend — AccountModal Username + Phone Tabs

**Files:**
- Modify: `frontend/src/components/ui/AccountModal.tsx`

- [ ] **Step 1: Replace AccountModal.tsx entirely**

```typescript
import { useState, useEffect, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchUpdateEmail,
  fetchUpdatePassword,
  fetchUpdateUsername,
  fetchRequestPhone,
  fetchConfirmPhone,
  fetchMe,
} from "../../api/auth";

type Tab = "email" | "password" | "username" | "phone";

export default function AccountModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 60_000 });
  const [tab, setTab] = useState<Tab>("email");

  const [newEmail, setNewEmail]     = useState("");
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [phone, setPhone]           = useState("");
  const [otpCode, setOtpCode]       = useState("");
  const [otpSent, setOtpSent]       = useState(false);
  const [countdown, setCountdown]   = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function reset() {
    setError(null); setSuccess(null);
    setNewEmail(""); setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setNewUsername(""); setPhone(""); setOtpCode("");
    setOtpSent(false); setCountdown(0);
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setSuccess(null); setLoading(true);
    try {
      await fetchUpdateEmail(newEmail);
      setSuccess("อัปเดต email แล้ว");
      qc.invalidateQueries({ queryKey: ["me"] });
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด");
    } finally { setLoading(false); }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setSuccess(null);
    if (newPw !== confirmPw) { setError("Password ใหม่ไม่ตรงกัน"); return; }
    setLoading(true);
    try {
      await fetchUpdatePassword(currentPw, newPw);
      setSuccess("เปลี่ยน password แล้ว");
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด");
    } finally { setLoading(false); }
  }

  async function handleUsernameSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setSuccess(null); setLoading(true);
    try {
      await fetchUpdateUsername(newUsername);
      setSuccess("ตั้ง username แล้ว");
      qc.invalidateQueries({ queryKey: ["me"] });
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด");
    } finally { setLoading(false); }
  }

  async function handleSendOtp() {
    setError(null); setSuccess(null); setLoading(true);
    try {
      await fetchRequestPhone(phone);
      setOtpSent(true); setCountdown(300);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "ส่ง OTP ไม่สำเร็จ");
    } finally { setLoading(false); }
  }

  async function handlePhoneConfirm(e: FormEvent) {
    e.preventDefault(); setError(null); setSuccess(null); setLoading(true);
    try {
      await fetchConfirmPhone(phone, otpCode);
      setSuccess("ยืนยันเบอร์โทรแล้ว ✓");
      qc.invalidateQueries({ queryKey: ["me"] });
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด");
    } finally { setLoading(false); }
  }

  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <span className="modal-title">👤 Manage Account</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="auth-tabs">
          {(["email", "password", "username", "phone"] as Tab[]).map((t) => (
            <div
              key={t}
              className={`auth-tab${tab === t ? " active" : ""}`}
              onClick={() => { setTab(t); reset(); }}
            >
              {t === "email" ? "Email" : t === "password" ? "Password"
                : t === "username" ? "Username" : "เบอร์โทร"}
            </div>
          ))}
        </div>

        {tab === "email" && (
          <form onSubmit={handleEmailSubmit} className="auth-form">
            <label>
              New Email
              <input type="email" value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com" required />
            </label>
            {error && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">✓ {success}</p>}
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "กำลังอัปเดต…" : "Update Email"}
            </button>
          </form>
        )}

        {tab === "password" && (
          <form onSubmit={handlePasswordSubmit} className="auth-form">
            <label>
              Current Password
              <input type="password" value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)} required />
            </label>
            <label>
              New Password
              <input type="password" value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                minLength={8} placeholder="อย่างน้อย 8 ตัวอักษร" required />
            </label>
            <label>
              Confirm New Password
              <input type="password" value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)} required />
            </label>
            {error && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">✓ {success}</p>}
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "กำลังเปลี่ยน…" : "Change Password"}
            </button>
          </form>
        )}

        {tab === "username" && (
          <form onSubmit={handleUsernameSubmit} className="auth-form">
            {user?.username && (
              <p style={{ fontSize: 13, color: "var(--slate)", margin: "0 0 8px" }}>
                ปัจจุบัน: <strong style={{ color: "var(--ink)" }}>@{user.username}</strong>
              </p>
            )}
            <label>
              Username ใหม่
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="เช่น rider_mark"
                pattern="[a-zA-Z0-9_]+"
                minLength={3}
                maxLength={30}
                required
              />
            </label>
            <p style={{ fontSize: 11, color: "var(--slate)", margin: "-8px 0 8px" }}>
              ใช้ได้เฉพาะ a–z, 0–9, _ (3–30 ตัว)
            </p>
            {error && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">✓ {success}</p>}
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "กำลังบันทึก…" : "Set Username"}
            </button>
          </form>
        )}

        {tab === "phone" && (
          <div className="auth-form">
            {user?.phone_verified && (
              <p style={{ fontSize: 13, color: "var(--slate)", margin: "0 0 8px" }}>
                ปัจจุบัน: <strong style={{ color: "var(--green)" }}>✓ {user.phone}</strong>
              </p>
            )}
            {!otpSent ? (
              <>
                <label>
                  เบอร์โทร
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812345678"
                    required
                  />
                </label>
                {error && <p className="auth-error">{error}</p>}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={loading || !phone.trim()}
                  onClick={handleSendOtp}
                >
                  {loading ? "กำลังส่ง…" : "ส่ง OTP"}
                </button>
              </>
            ) : (
              <form onSubmit={handlePhoneConfirm}>
                <p style={{ fontSize: 13, color: "var(--slate)", margin: "0 0 8px" }}>
                  ส่ง OTP ไปที่ <strong style={{ color: "var(--ink)" }}>{phone}</strong>
                </p>
                <label>
                  รหัส OTP (6 หลัก)
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    autoFocus
                    required
                  />
                </label>
                <div style={{ fontSize: 12, color: "var(--slate)", marginTop: -8, marginBottom: 8 }}>
                  {countdown > 0 ? `OTP หมดอายุใน ${mm}:${ss}` : "OTP หมดอายุแล้ว"}
                  {countdown === 0 && (
                    <button type="button" onClick={handleSendOtp} disabled={loading}
                      style={{ marginLeft: 8, color: "var(--purple)", background: "none",
                               border: "none", cursor: "pointer", fontSize: 12 }}>
                      ส่งใหม่
                    </button>
                  )}
                </div>
                {error && <p className="auth-error">{error}</p>}
                {success && <p className="auth-success">✓ {success}</p>}
                <button type="submit"
                  disabled={loading || otpCode.length < 6}
                  className="btn btn-primary">
                  {loading ? "กำลังยืนยัน…" : "ยืนยัน"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Volumes/Maythane/My-Project/My-bike/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in `AccountModal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/AccountModal.tsx
git commit -m "feat: add Username and Phone tabs to AccountModal"
```

---

## Task 8: AvatarMenu Display + CSS Fix + Build

**Files:**
- Modify: `frontend/src/components/ui/AvatarMenu.tsx`
- Modify: `frontend/src/index.css`
- Build: `frontend/`

- [ ] **Step 1: Update AvatarMenu.tsx display logic**

Find lines 31 and 44 in `frontend/src/components/ui/AvatarMenu.tsx`.

Replace line 31:
```typescript
// Before:
const initial = user?.email?.[0]?.toUpperCase() ?? "?";

// After:
const displayName = user?.username ? `@${user.username}` : (user?.email ?? "…");
const initial = (user?.username?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();
```

Replace line 44 (the `avatar-dropdown-user` div):
```typescript
// Before:
<div className="avatar-dropdown-user">{user?.email ?? "…"}</div>

// After:
<div className="avatar-dropdown-user">{displayName}</div>
```

- [ ] **Step 2: Fix dropdown background CSS**

Open `frontend/src/index.css`. Find line with `background: rgba(9, 9, 26, 0.50)` inside `.avatar-dropdown`.

Change it to:
```css
background: rgba(9, 9, 26, 0.88);
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Volumes/Maythane/My-Project/My-bike/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Build frontend**

```bash
cd /Volumes/Maythane/My-Project/My-bike/frontend
npm run build 2>&1
```

Expected: `✓ built in X.XXs` — no errors.

- [ ] **Step 5: End-to-end smoke test**

```bash
AUTH_SECRET_KEY="test" python3 /Volumes/Maythane/My-Project/My-bike/server.py &
sleep 3
```

1. Open http://localhost:8764/login
2. Register a new account
3. Open Manage Account → set a username (e.g. `rider_test`)
4. Open dropdown — verify it shows `@rider_test` instead of email
5. Logout
6. Login with the username `rider_test` + password → should succeed
7. Verify dropdown background is opaque/readable on mobile view (DevTools → mobile emulation)

```bash
kill %1
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui/AvatarMenu.tsx frontend/src/index.css frontend/dist/
git commit -m "feat: show username in AvatarMenu; fix dropdown opacity; rebuild frontend"
```
