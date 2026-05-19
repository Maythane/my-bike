# Multi-User Auth (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม email+password JWT auth ให้ My-bike พร้อม data isolation สมบูรณ์ต่อ user

**Architecture:** User model ใหม่ เชื่อมกับ Profile/AppSettings/ShockSetting/ShockPreset ผ่าน user_id FK — FastAPI `Depends(get_current_user)` guard ทุก router — React เก็บ JWT ใน localStorage และ inject header ทุก request ผ่าน axios interceptor

**Tech Stack:** FastAPI, SQLModel, python-jose[cryptography], passlib[bcrypt], React, axios, TanStack Query

---

### Task 1: Install dependencies + create backend/app/auth.py

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/app/auth.py`

- [ ] **Step 1: Add auth libraries to requirements.txt**

Replace `backend/requirements.txt` with:

```
fastapi==0.115.5
uvicorn[standard]==0.32.1
sqlmodel==0.0.22
python-multipart==0.0.12
Pillow==11.3.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
```

- [ ] **Step 2: Install new dependencies**

```bash
cd /Volumes/Maythane/My-Project/My-bike/backend
.venv/bin/pip install python-jose[cryptography]==3.3.0 passlib[bcrypt]==1.7.4
```

Expected: installs without error

- [ ] **Step 3: Create backend/app/auth.py**

```python
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlmodel import Session, select

from app.database import get_session

SECRET_KEY = os.environ["AUTH_SECRET_KEY"]  # KeyError at startup if missing — fail fast
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = int(os.environ.get("ACCESS_TOKEN_EXPIRE_DAYS", "7"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
):
    from app.models import User  # local import to avoid circular dependency
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = session.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user
```

- [ ] **Step 4: Verify import works**

```bash
cd /Volumes/Maythane/My-Project/My-bike/backend
AUTH_SECRET_KEY=testsecret DB_PATH=../data/moto.db .venv/bin/python -c "from app.auth import hash_password, create_access_token; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git -C /Volumes/Maythane/My-Project/My-bike add backend/requirements.txt backend/app/auth.py
git -C /Volumes/Maythane/My-Project/My-bike commit -m "feat(auth): add auth utilities (JWT + bcrypt)"
```

---

### Task 2: User model + FK fields in models.py

**Files:**
- Modify: `backend/app/models.py`

- [ ] **Step 1: Add User model and user_id FK to models.py**

At the top of `backend/app/models.py`, after the existing imports, add the import for `List` if not present (it's already there). Then make these changes:

**Add User model** — insert BEFORE the `Profile` class (User must be defined first):

```python
class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    profiles: List["Profile"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
```

**Modify Profile class** — add these two lines inside `Profile`:

```python
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    user: Optional["User"] = Relationship(back_populates="profiles")
```

**Modify AppSettings class** — add:

```python
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
```

**Modify ShockSetting class** — add:

```python
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
```

**Modify ShockPreset class** — add:

```python
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
```

- [ ] **Step 2: Verify models import cleanly**

```bash
cd /Volumes/Maythane/My-Project/My-bike/backend
AUTH_SECRET_KEY=test DB_PATH=../data/moto.db .venv/bin/python -c "from app.models import User, Profile, AppSettings, ShockSetting, ShockPreset; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git -C /Volumes/Maythane/My-Project/My-bike add backend/app/models.py
git -C /Volumes/Maythane/My-Project/My-bike commit -m "feat(auth): add User model and user_id FK to Profile/Settings/Shock tables"
```

---

### Task 3: Migration script for existing data

**Files:**
- Create: `backend/migrate_add_users.py`

> ใช้สำหรับ DB ที่มีข้อมูลอยู่แล้ว — ถ้า DB ใหม่เลยข้ามงานนี้ได้

- [ ] **Step 1: Create migration script**

```python
#!/usr/bin/env python3
"""
migrate_add_users.py
เพิ่ม user_id columns และสร้าง default user สำหรับข้อมูลเดิม
รัน: cd backend && DB_PATH=../data/moto.db .venv/bin/python migrate_add_users.py
"""
import os
import sqlite3
from pathlib import Path

DB_PATH = os.environ.get("DB_PATH", "../data/moto.db")


def migrate(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # เพิ่ม users table ถ้ายังไม่มี
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            hashed_password TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)

    # สร้าง default user (owner ของข้อมูลเดิม) ถ้ายังไม่มี
    cur.execute("SELECT id FROM users WHERE email = 'owner@local'")
    row = cur.fetchone()
    if not row:
        # hashed password = 'changeme' ด้วย bcrypt
        from passlib.context import CryptContext
        hashed = CryptContext(schemes=["bcrypt"], deprecated="auto").hash("changeme")
        cur.execute(
            "INSERT INTO users (email, hashed_password) VALUES (?, ?)",
            ("owner@local", hashed),
        )
    cur.execute("SELECT id FROM users WHERE email = 'owner@local'")
    owner_id = cur.fetchone()[0]
    print(f"Default owner user id={owner_id}")

    # เพิ่ม user_id column ถ้ายังไม่มี และ assign ข้อมูลเดิม
    for table, col in [
        ("profiles", "user_id"),
        ("settings", "user_id"),
        ("shock_settings", "user_id"),
        ("shock_presets", "user_id"),
    ]:
        cur.execute(f"PRAGMA table_info({table})")
        cols = [r[1] for r in cur.fetchall()]
        if col not in cols:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} INTEGER REFERENCES users(id)")
            print(f"Added {table}.{col}")
        cur.execute(f"UPDATE {table} SET {col} = ? WHERE {col} IS NULL", (owner_id,))
        updated = cur.rowcount
        if updated:
            print(f"Assigned {updated} rows in {table} to owner_id={owner_id}")

    conn.commit()
    conn.close()
    print("Migration complete.")
    print(f"Login with: email=owner@local  password=changeme")
    print("เปลี่ยน password หลัง login ครั้งแรกด้วย")


if __name__ == "__main__":
    migrate(DB_PATH)
```

- [ ] **Step 2: Run migration against existing DB**

```bash
cd /Volumes/Maythane/My-Project/My-bike/backend
DB_PATH=../data/moto.db .venv/bin/python migrate_add_users.py
```

Expected output includes:
```
Default owner user id=1
Migration complete.
Login with: email=owner@local  password=changeme
```

- [ ] **Step 3: Commit**

```bash
git -C /Volumes/Maythane/My-Project/My-bike add backend/migrate_add_users.py
git -C /Volumes/Maythane/My-Project/My-bike commit -m "feat(auth): add migration script to assign existing data to default user"
```

---

### Task 4: Auth router + mount in main.py + fix seed.py

**Files:**
- Create: `backend/app/routers/auth.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/seed.py`

- [ ] **Step 1: Create backend/app/routers/auth.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
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
    created_at: str

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
```

- [ ] **Step 2: Mount auth router in main.py**

In `backend/app/main.py`, add `auth` to the router imports and include it:

```python
from app.routers import profiles, motorcycles, tasks, logs, settings, templates, fuel, shock, shock_presets, auth
```

Add after the existing `app.include_router(...)` calls:

```python
app.include_router(auth.router)
```

- [ ] **Step 3: Fix seed.py — remove global AppSettings seed**

The global AppSettings seed in `seed_defaults()` is now per-user (seeded at register). Remove the AppSettings seeding block:

Replace the `seed_defaults` function in `backend/app/seed.py`:

```python
def seed_defaults(session: Session):
    # AppSettings ไม่ seed global อีกต่อไป — สร้างต่อ user ใน auth router
    all_templates = TEMPLATES + GRAND_FILANO_TEMPLATES
    for t in all_templates:
        existing_t = session.exec(
            select(TaskTemplate).where(
                TaskTemplate.name == t["name"],
                TaskTemplate.model == t.get("model")
            )
        ).first()
        if not existing_t:
            session.add(TaskTemplate(**t))
    session.commit()
```

- [ ] **Step 4: Verify server starts**

```bash
cd /Volumes/Maythane/My-Project/My-bike/backend
AUTH_SECRET_KEY=testsecret DB_PATH=../data/moto.db .venv/bin/uvicorn app.main:app --port 8764 &
sleep 2
curl -s http://localhost:8764/api/auth/me | head -c 100
kill %1
```

Expected: JSON with `{"detail":"Not authenticated"}` (401, meaning route exists)

- [ ] **Step 5: Commit**

```bash
git -C /Volumes/Maythane/My-Project/My-bike add backend/app/routers/auth.py backend/app/main.py backend/app/seed.py
git -C /Volumes/Maythane/My-Project/My-bike commit -m "feat(auth): add auth router (register/login/me) and mount in main"
```

---

### Task 5: Ownership helper in utils.py

**Files:**
- Modify: `backend/app/utils.py`

- [ ] **Step 1: Add get_motorcycle_for_user to utils.py**

Append to the end of `backend/app/utils.py`:

```python
def get_motorcycle_for_user(bike_id: int, user, session: Session) -> "Motorcycle":
    """Return Motorcycle if owned by user — raise 404 otherwise (ไม่ leak ว่า ID มีอยู่)"""
    from fastapi import HTTPException
    bike = session.get(Motorcycle, bike_id)
    if not bike:
        raise HTTPException(status_code=404, detail="Not found")
    profile = session.get(__import__('app.models', fromlist=['Profile']).Profile, bike.profile_id)
    if not profile or profile.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    return bike
```

- [ ] **Step 2: Simplify the import (cleaner version)**

Actually use a direct import. Replace the appended function with:

```python
def get_motorcycle_for_user(bike_id: int, user, session: Session) -> Motorcycle:
    """Return Motorcycle ถ้า user เป็นเจ้าของ — raise 404 ไม่ใช่ 403 เพื่อป้องกัน ID enumeration"""
    from fastapi import HTTPException
    from app.models import Profile
    bike = session.get(Motorcycle, bike_id)
    if not bike:
        raise HTTPException(status_code=404, detail="Not found")
    profile = session.get(Profile, bike.profile_id)
    if not profile or profile.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    return bike
```

- [ ] **Step 3: Commit**

```bash
git -C /Volumes/Maythane/My-Project/My-bike add backend/app/utils.py
git -C /Volumes/Maythane/My-Project/My-bike commit -m "feat(auth): add get_motorcycle_for_user ownership helper"
```

---

### Task 6: Protect profiles router

**Files:**
- Modify: `backend/app/routers/profiles.py`

- [ ] **Step 1: Replace profiles.py with auth-protected version**

Replace the entire `backend/app/routers/profiles.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.database import get_session
from app.models import Profile, Motorcycle, MaintenanceTask, MaintenanceLog, UnitEnum, User
from app.auth import get_current_user

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


def _get_owned_profile(profile_id: int, user: User, session: Session) -> Profile:
    profile = session.get(Profile, profile_id)
    if not profile or profile.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    return profile


@router.get("", response_model=List[ProfileRead])
def list_profiles(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return session.exec(
        select(Profile)
        .where(Profile.user_id == current_user.id)
        .order_by(Profile.created_at)
    ).all()


@router.post("", response_model=ProfileRead, status_code=201)
def create_profile(
    data: ProfileCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    profile = Profile(**data.model_dump(), user_id=current_user.id)
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


@router.put("/{profile_id}", response_model=ProfileRead)
def update_profile(
    profile_id: int,
    data: ProfileUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    profile = _get_owned_profile(profile_id, current_user, session)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


@router.delete("/{profile_id}", status_code=204)
def delete_profile(
    profile_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    profile = _get_owned_profile(profile_id, current_user, session)
    session.delete(profile)
    session.commit()


@router.get("/{profile_id}/export")
def export_profile(
    profile_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    profile = _get_owned_profile(profile_id, current_user, session)
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
```

- [ ] **Step 2: Quick smoke test**

```bash
cd /Volumes/Maythane/My-Project/My-bike/backend
AUTH_SECRET_KEY=testsecret DB_PATH=../data/moto.db .venv/bin/uvicorn app.main:app --port 8764 &
sleep 2
# ลอง list profiles โดยไม่มี token — ต้องได้ 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:8764/api/profiles
kill %1
```

Expected: `401`

- [ ] **Step 3: Commit**

```bash
git -C /Volumes/Maythane/My-Project/My-bike add backend/app/routers/profiles.py
git -C /Volumes/Maythane/My-Project/My-bike commit -m "feat(auth): protect profiles router with JWT auth"
```

---

### Task 7: Protect motorcycles router

**Files:**
- Modify: `backend/app/routers/motorcycles.py`

- [ ] **Step 1: Add auth imports and update all endpoints**

In `backend/app/routers/motorcycles.py`, make these changes:

**Change import line** (add User, get_current_user, get_motorcycle_for_user):

```python
from app.database import get_session
from app.models import Motorcycle, Profile, UnitEnum, User
from app.auth import get_current_user
from app.utils import save_compressed_image, get_motorcycle_for_user
```

**Replace `list_motorcycles`** (verify profile ownership before listing):

```python
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
```

**Replace `create_motorcycle`** (verify profile ownership):

```python
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
```

**Replace `list_all_motorcycles`** (filter to current user's bikes only):

```python
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
```

**Replace `create_motorcycle_simple`** (use current user's first profile):

```python
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
```

**Replace `get_motorcycle`, `update_motorcycle`, `upload_bike_image`, `delete_bike_image`, `delete_motorcycle`** — add `current_user` and use `get_motorcycle_for_user`:

```python
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
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    filename = f"{bike_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest = os.path.join(UPLOAD_DIR, filename)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    if bike.image_path:
        old = os.path.join(UPLOAD_DIR, os.path.basename(bike.image_path))
        if os.path.exists(old):
            os.remove(old)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
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
```

- [ ] **Step 2: Commit**

```bash
git -C /Volumes/Maythane/My-Project/My-bike add backend/app/routers/motorcycles.py
git -C /Volumes/Maythane/My-Project/My-bike commit -m "feat(auth): protect motorcycles router with ownership checks"
```

---

### Task 8: Protect tasks router

**Files:**
- Modify: `backend/app/routers/tasks.py`

- [ ] **Step 1: Add auth imports and update tasks router**

**Change imports** in `backend/app/routers/tasks.py`:

```python
from app.database import get_session
from app.models import MaintenanceTask, MaintenanceLog, Motorcycle, TaskTemplate, PriorityEnum, User
from app.auth import get_current_user
from app.utils import get_motorcycle_for_user
from app.status import compute_status
```

**Replace `_get_bike_or_404`** — remove this function entirely (replaced by `get_motorcycle_for_user` from utils).

**Replace all 5 endpoint functions:**

```python
@router.get("/api/motorcycles/{bike_id}/tasks", response_model=List[TaskWithStatus])
def list_tasks(
    bike_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    bike = get_motorcycle_for_user(bike_id, current_user, session)
    _PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}
    tasks = session.exec(
        select(MaintenanceTask)
        .where(MaintenanceTask.motorcycle_id == bike_id)
        .where(MaintenanceTask.is_active == True)
    ).all()
    tasks = sorted(tasks, key=lambda t: _PRIORITY_ORDER.get(t.priority, 99))
    return [_enrich_task(t, bike, session) for t in tasks]


@router.post("/api/motorcycles/{bike_id}/tasks", response_model=TaskWithStatus, status_code=201)
def create_task(
    bike_id: int,
    data: TaskCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    bike = get_motorcycle_for_user(bike_id, current_user, session)
    if not data.interval_km and not data.interval_months:
        raise HTTPException(status_code=422, detail="At least one of interval_km or interval_months is required")
    task = MaintenanceTask(motorcycle_id=bike_id, **data.model_dump())
    session.add(task)
    session.commit()
    session.refresh(task)
    return _enrich_task(task, bike, session)


@router.post("/api/motorcycles/{bike_id}/tasks/from-template", response_model=TaskWithStatus, status_code=201)
def create_task_from_template(
    bike_id: int,
    data: TaskFromTemplate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    bike = get_motorcycle_for_user(bike_id, current_user, session)
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
def update_task(
    task_id: int,
    data: TaskUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    task = _get_task_or_404(task_id, session)
    bike = get_motorcycle_for_user(task.motorcycle_id, current_user, session)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    session.add(task)
    session.commit()
    session.refresh(task)
    return _enrich_task(task, bike, session)


@router.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    task = _get_task_or_404(task_id, session)
    get_motorcycle_for_user(task.motorcycle_id, current_user, session)  # ownership check
    task.is_active = False
    session.add(task)
    session.commit()
```

- [ ] **Step 2: Commit**

```bash
git -C /Volumes/Maythane/My-Project/My-bike add backend/app/routers/tasks.py
git -C /Volumes/Maythane/My-Project/My-bike commit -m "feat(auth): protect tasks router with ownership checks"
```

---

### Task 9: Protect logs + fuel routers

**Files:**
- Modify: `backend/app/routers/logs.py`
- Modify: `backend/app/routers/fuel.py`

- [ ] **Step 1: Update logs.py imports**

In `backend/app/routers/logs.py`, change:

```python
from app.database import get_session
from app.models import MaintenanceLog, MaintenanceLogImage, MaintenanceTask, Motorcycle, User
from app.auth import get_current_user
from app.utils import recalc_odometer, save_compressed_image, get_motorcycle_for_user
```

- [ ] **Step 2: Add current_user + ownership to all logs endpoints**

For each endpoint in logs.py that takes `bike_id` or `log_id`:

**Endpoints with `bike_id`** — add `current_user: User = Depends(get_current_user)` and replace `session.get(Motorcycle, bike_id)` check with `get_motorcycle_for_user(bike_id, current_user, session)`.

**Endpoints with `log_id`** — add `current_user` and verify ownership via log→task→motorcycle:

```python
def _get_log_for_user(log_id: int, user, session: Session) -> MaintenanceLog:
    log = session.get(MaintenanceLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Not found")
    task = session.get(MaintenanceTask, log.task_id)
    get_motorcycle_for_user(task.motorcycle_id, user, session)  # raises 404 if not owner
    return log
```

Add this helper at the top of the router (after imports), then use `_get_log_for_user(log_id, current_user, session)` in every endpoint that fetches a log by ID.

For list endpoints scoped to `bike_id`:
```python
# ตัวอย่าง pattern สำหรับทุก endpoint ที่มี bike_id
bike = get_motorcycle_for_user(bike_id, current_user, session)
```

- [ ] **Step 3: Update fuel.py imports**

In `backend/app/routers/fuel.py`, change:

```python
from app.database import get_session
from app.models import FuelLog, FuelLogImage, Motorcycle, User
from app.auth import get_current_user
from app.utils import recalc_odometer, save_compressed_image, get_motorcycle_for_user
```

- [ ] **Step 4: Add current_user + ownership to all fuel endpoints**

Same pattern as logs.py — helper function for log-by-id ownership:

```python
def _get_fuel_for_user(fuel_id: int, user, session: Session) -> FuelLog:
    log = session.get(FuelLog, fuel_id)
    if not log:
        raise HTTPException(status_code=404, detail="Not found")
    get_motorcycle_for_user(log.motorcycle_id, user, session)
    return log
```

All `bike_id` endpoints: use `get_motorcycle_for_user(bike_id, current_user, session)`.
All `fuel_id` endpoints: use `_get_fuel_for_user(fuel_id, current_user, session)`.

- [ ] **Step 5: Commit**

```bash
git -C /Volumes/Maythane/My-Project/My-bike add backend/app/routers/logs.py backend/app/routers/fuel.py
git -C /Volumes/Maythane/My-Project/My-bike commit -m "feat(auth): protect logs and fuel routers with ownership checks"
```

---

### Task 10: Protect shock + shock_presets + settings routers

**Files:**
- Modify: `backend/app/routers/shock.py`
- Modify: `backend/app/routers/shock_presets.py`
- Modify: `backend/app/routers/settings.py`

- [ ] **Step 1: Replace shock.py**

```python
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import Optional
from pydantic import BaseModel

from app.database import get_session
from app.models import ShockSetting, User
from app.auth import get_current_user

router = APIRouter(prefix="/api/shock-setting", tags=["shock"])


class ShockSettingUpdate(BaseModel):
    rider_weight: Optional[float] = None
    passenger_weight: Optional[float] = None
    mode: Optional[str] = None


def _get_or_create(user: User, session: Session) -> ShockSetting:
    setting = session.exec(
        select(ShockSetting).where(ShockSetting.user_id == user.id)
    ).first()
    if not setting:
        setting = ShockSetting(user_id=user.id)
        session.add(setting)
        session.commit()
        session.refresh(setting)
    return setting


@router.get("", response_model=ShockSetting)
def get_shock_setting(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return _get_or_create(current_user, session)


@router.put("", response_model=ShockSetting)
def update_shock_setting(
    data: ShockSettingUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    setting = _get_or_create(current_user, session)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(setting, field, value)
    session.add(setting)
    session.commit()
    session.refresh(setting)
    return setting
```

- [ ] **Step 2: Replace shock_presets.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import Optional, List
from pydantic import BaseModel

from app.database import get_session
from app.models import ShockPreset, User
from app.auth import get_current_user

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


def _get_preset_for_user(preset_id: int, user: User, session: Session) -> ShockPreset:
    preset = session.get(ShockPreset, preset_id)
    if not preset or preset.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    return preset


@router.get("", response_model=List[ShockPreset])
def list_presets(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return session.exec(
        select(ShockPreset)
        .where(ShockPreset.user_id == current_user.id)
        .order_by(ShockPreset.created_at.desc())
    ).all()


@router.post("", response_model=ShockPreset)
def create_preset(
    data: ShockPresetCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    preset = ShockPreset(**data.model_dump(), user_id=current_user.id)
    session.add(preset)
    session.commit()
    session.refresh(preset)
    return preset


@router.patch("/{preset_id}", response_model=ShockPreset)
def update_preset(
    preset_id: int,
    data: ShockPresetUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    preset = _get_preset_for_user(preset_id, current_user, session)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(preset, field, value)
    session.add(preset)
    session.commit()
    session.refresh(preset)
    return preset


@router.delete("/{preset_id}", status_code=204)
def delete_preset(
    preset_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    preset = _get_preset_for_user(preset_id, current_user, session)
    session.delete(preset)
    session.commit()
```

- [ ] **Step 3: Replace settings.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import Optional
from pydantic import BaseModel

from app.database import get_session
from app.models import AppSettings, UnitEnum, User
from app.auth import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    default_unit: Optional[UnitEnum] = None
    timezone: Optional[str] = None


@router.get("", response_model=AppSettings)
def get_settings(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    settings = session.exec(
        select(AppSettings).where(AppSettings.user_id == current_user.id)
    ).first()
    if not settings:
        settings = AppSettings(user_id=current_user.id)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


@router.put("", response_model=AppSettings)
def update_settings(
    data: SettingsUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    settings = session.exec(
        select(AppSettings).where(AppSettings.user_id == current_user.id)
    ).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings
```

- [ ] **Step 4: Smoke test all protected routes return 401**

```bash
cd /Volumes/Maythane/My-Project/My-bike/backend
AUTH_SECRET_KEY=testsecret DB_PATH=../data/moto.db .venv/bin/uvicorn app.main:app --port 8764 &
sleep 2
for route in /api/shock-setting /api/shock-presets /api/settings; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8764$route)
  echo "$route → $code"
done
kill %1
```

Expected: ทุก route return `401`

- [ ] **Step 5: Commit**

```bash
git -C /Volumes/Maythane/My-Project/My-bike add backend/app/routers/shock.py backend/app/routers/shock_presets.py backend/app/routers/settings.py
git -C /Volumes/Maythane/My-Project/My-bike commit -m "feat(auth): protect shock, shock_presets, and settings routers"
```

---

### Task 11: Pass AUTH_SECRET_KEY through server.py

**Files:**
- Modify: `server.py`

- [ ] **Step 1: Update server.py to require and forward AUTH_SECRET_KEY**

In `server.py`, after the `env = os.environ.copy()` line, add:

```python
    if 'AUTH_SECRET_KEY' not in env:
        print('ERROR: AUTH_SECRET_KEY env var is required')
        print('  export AUTH_SECRET_KEY="$(openssl rand -hex 32)"')
        sys.exit(1)
    env['DB_PATH'] = str(DB_PATH)
```

Replace the existing `env['DB_PATH'] = str(DB_PATH)` line (which is already there). The full updated `main()` function:

```python
def main():
    ip   = _local_ip()
    path = f':{PORT}'
    print('─' * 60)
    print(f'  Moto Tracker  →  http://localhost{path}')
    print(f'  Network       →  http://{ip}{path}')
    print('─' * 60)
    print('  Ctrl+C to stop\n')

    if not os.environ.get('NO_BROWSER'):
        webbrowser.open(f'http://localhost{path}')

    env = os.environ.copy()

    if 'AUTH_SECRET_KEY' not in env:
        print('ERROR: AUTH_SECRET_KEY env var is required')
        print('  Generate one: export AUTH_SECRET_KEY="$(openssl rand -hex 32)"')
        sys.exit(1)

    env['DB_PATH'] = str(DB_PATH)

    os.chdir(str(BACKEND_DIR))
    os.execve(str(UVICORN), [
        'uvicorn', 'app.main:app',
        '--host', '0.0.0.0',
        '--port', str(PORT),
    ], env)
```

- [ ] **Step 2: Commit**

```bash
git -C /Volumes/Maythane/My-Project/My-bike add server.py
git -C /Volumes/Maythane/My-Project/My-bike commit -m "feat(auth): require AUTH_SECRET_KEY in server.py startup"
```

---

### Task 12: Frontend api/auth.ts + useAuth.ts hook

**Files:**
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/hooks/useAuth.ts`

- [ ] **Step 1: Create frontend/src/api/auth.ts**

```typescript
import client from "./client";

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserInfo {
  id: number;
  email: string;
  created_at: string;
}

export async function fetchRegister(email: string, password: string): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>("/api/auth/register", { email, password });
  return data;
}

export async function fetchLogin(email: string, password: string): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>("/api/auth/login", { email, password });
  return data;
}

export async function fetchMe(): Promise<UserInfo> {
  const { data } = await client.get<UserInfo>("/api/auth/me");
  return data;
}
```

- [ ] **Step 2: Create frontend/src/hooks/useAuth.ts**

```typescript
import { fetchLogin, fetchRegister } from "../api/auth";

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

  async function login(email: string, password: string): Promise<void> {
    const { access_token } = await fetchLogin(email, password);
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

  return { isAuthenticated, login, register, logout };
}
```

- [ ] **Step 3: Commit**

```bash
git -C /Volumes/Maythane/My-Project/My-bike add frontend/src/api/auth.ts frontend/src/hooks/useAuth.ts
git -C /Volumes/Maythane/My-Project/My-bike commit -m "feat(auth): add auth API functions and useAuth hook"
```

---

### Task 13: Update frontend/src/api/client.ts

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Add axios interceptors for token injection + 401 handling**

Replace `frontend/src/api/client.ts`:

```typescript
import axios from "axios";
import { getToken } from "../hooks/useAuth";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
  headers: { "Content-Type": "application/json" },
});

// Inject JWT token on every request
client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to /login on 401
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("moto_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default client;
```

- [ ] **Step 2: Commit**

```bash
git -C /Volumes/Maythane/My-Project/My-bike add frontend/src/api/client.ts
git -C /Volumes/Maythane/My-Project/My-bike commit -m "feat(auth): inject JWT token and handle 401 in axios client"
```

---

### Task 14: Create LoginPage.tsx + RegisterPage.tsx

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/RegisterPage.tsx`

- [ ] **Step 1: Create frontend/src/pages/LoginPage.tsx**

```tsx
import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>🏍️ Moto Tracker</h1>
        <h2>เข้าสู่ระบบ</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" disabled={loading} className="auth-btn">
            {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </button>
        </form>
        <p className="auth-link">
          ยังไม่มีบัญชี? <Link to="/register">สมัครสมาชิก</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create frontend/src/pages/RegisterPage.tsx**

```tsx
import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Password ไม่ตรงกัน");
      return;
    }
    if (password.length < 8) {
      setError("Password ต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    setLoading(true);
    try {
      await register(email, password);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>🏍️ Moto Tracker</h1>
        <h2>สมัครสมาชิก</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          <label>
            Confirm Password
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" disabled={loading} className="auth-btn">
            {loading ? "กำลังสมัคร…" : "สมัครสมาชิก"}
          </button>
        </form>
        <p className="auth-link">
          มีบัญชีแล้ว? <Link to="/login">เข้าสู่ระบบ</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add minimal auth CSS to index.css**

Append to `frontend/src/index.css`:

```css
/* Auth pages */
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.auth-card {
  background: var(--card-bg, rgba(255,255,255,0.06));
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 1rem;
  padding: 2rem;
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.auth-card h1 { font-size: 1.5rem; margin: 0; text-align: center; }
.auth-card h2 { font-size: 1.1rem; margin: 0; opacity: 0.7; text-align: center; }
.auth-form { display: flex; flex-direction: column; gap: 0.75rem; }
.auth-form label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.9rem; }
.auth-form input {
  padding: 0.6rem 0.8rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.05);
  color: inherit;
  font-size: 1rem;
}
.auth-btn {
  margin-top: 0.5rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: none;
  background: #39FF14;
  color: #000;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
}
.auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.auth-error { color: #ff4d4d; font-size: 0.875rem; margin: 0; }
.auth-link { text-align: center; font-size: 0.875rem; margin: 0; }
```

- [ ] **Step 4: Commit**

```bash
git -C /Volumes/Maythane/My-Project/My-bike add frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx frontend/src/index.css
git -C /Volumes/Maythane/My-Project/My-bike commit -m "feat(auth): add LoginPage and RegisterPage with Night Rider styling"
```

---

### Task 15: Update App.tsx — protected routes

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add auth imports and ProtectedRoute to App.tsx**

Add imports at the top:

```typescript
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { getToken } from "./hooks/useAuth";
```

Add `ProtectedRoute` component after the `Blobs` component:

```tsx
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
```

**Replace `AppShell` component** to add logout button and protected routes:

```tsx
function AppShell() {
  const { theme, toggle } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative", zIndex: 1 }}>
      <NavBar theme={theme} toggle={toggle} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<ProtectedRoute><GaragePage /></ProtectedRoute>} />
          <Route path="/bikes/:bikeId" element={<ProtectedRoute><BikePage /></ProtectedRoute>} />
          <Route path="/shock-settings" element={<ProtectedRoute><ShockSettingsPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
```

**Add logout button to `NavBar`** — inside the `NavBar` function, before the closing `</nav>`, add:

```tsx
      <button
        onClick={() => { localStorage.removeItem("moto_token"); window.location.href = "/login"; }}
        className="app-nav-toggle"
        title="ออกจากระบบ"
      >
        🚪
      </button>
```

- [ ] **Step 2: Build frontend and verify no TypeScript errors**

```bash
cd /Volumes/Maythane/My-Project/My-bike/frontend
npm run build
```

Expected: build succeeds with no errors

- [ ] **Step 3: End-to-end smoke test**

```bash
# Start server
cd /Volumes/Maythane/My-Project/My-bike
export AUTH_SECRET_KEY="$(openssl rand -hex 32)"
python server.py &
sleep 3

# Register new user
TOKEN=$(curl -s -X POST http://localhost:8764/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo "Token received: ${TOKEN:0:20}..."

# Get /me
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8764/api/auth/me

# Create a profile
curl -s -X POST http://localhost:8764/api/profiles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Bikes","icon":"🏍️","color_accent":"#39FF14"}'

kill %1
```

Expected: register returns token, /me returns `{"id":...,"email":"test@test.com",...}`, profile created successfully

- [ ] **Step 4: Commit**

```bash
git -C /Volumes/Maythane/My-Project/My-bike add frontend/src/App.tsx
git -C /Volumes/Maythane/My-Project/My-bike commit -m "feat(auth): add protected routes and logout button to App.tsx"
```
