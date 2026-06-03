# Auth UI + ShockSetting Per Motorcycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace login/register pages with unified AuthPage, add avatar dropdown with account modal and settings page, scope ShockSetting to individual motorcycles, and apply per-brand visual theming (banner + accent color) on the ShockSettings page.

**Architecture:** Backend gains ShockBrand table (logo, accent color, shock models list) and per-bike shock endpoints. Frontend adds AuthPage, AvatarMenu, AccountModal, SettingsPage, ShockSetupPage. ShockSettingsPage reads the selected bike's `shock_brand`, looks up the ShockBrand record, and injects CSS custom properties (`--brand-accent`, `--brand-accent-bg`, etc.) onto its container element — brand theming stays scoped to that page.

**Tech Stack:** FastAPI + SQLModel + SQLite (backend), React 19 + TypeScript + TanStack Query v5 + React Router v7 (frontend), Jelly Glass CSS design system (existing `index.css` variables).

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `backend/app/models.py` | Add ShockBrand; add fields to ShockSetting, ShockPreset, User |
| Create | `backend/migrate_shock_per_bike.py` | One-time schema migration + seed |
| Create | `backend/app/routers/shock_brands.py` | GET /api/shock-brands, PUT /api/admin/shock-brands/{id}/image |
| Modify | `backend/app/routers/shock.py` | Per-bike endpoint `/api/motorcycles/{bike_id}/shock-setting` |
| Modify | `backend/app/routers/auth.py` | Add PUT /api/auth/email and PUT /api/auth/password |
| Modify | `backend/app/main.py` | Register shock_brands router, mount /static/brands |
| Modify | `frontend/src/index.css` | Fix auth-* classes, add brand theming classes |
| Modify | `frontend/src/types/index.ts` | Add ShockBrand, update ShockSetting type |
| Create | `frontend/src/api/shockBrands.ts` | fetchShockBrands() |
| Create | `frontend/src/api/settings.ts` | fetchSettings(), updateSettings() |
| Modify | `frontend/src/api/shock.ts` | getShockSetting(bikeId), updateShockSetting(bikeId, ...) |
| Modify | `frontend/src/api/shock_presets.ts` | Add shock_brand, shock_model to create/update |
| Modify | `frontend/src/api/auth.ts` | Add fetchUpdateEmail, fetchUpdatePassword |
| Create | `frontend/src/components/ui/Blobs.tsx` | Extracted Blobs background component |
| Create | `frontend/src/pages/AuthPage.tsx` | Unified login + register with tabs |
| Create | `frontend/src/components/ui/AvatarMenu.tsx` | Avatar button + dropdown |
| Create | `frontend/src/components/ui/AccountModal.tsx` | Email/password change modal |
| Create | `frontend/src/pages/SettingsPage.tsx` | /settings — unit, timezone, per-bike shock overview |
| Create | `frontend/src/pages/ShockSetupPage.tsx` | /settings/bikes/:bikeId/shock — brand + model picker |
| Modify | `frontend/src/pages/ShockSettingsPage.tsx` | Bike selector + brand CSS variable injection |
| Modify | `frontend/src/App.tsx` | New routes, AvatarMenu in NavBar, hide NavBar on /login |
| Delete | `frontend/src/pages/LoginPage.tsx` | Replaced by AuthPage |
| Delete | `frontend/src/pages/RegisterPage.tsx` | Replaced by AuthPage |

---

## Task 1: Migration + Schema

**Files:**
- Modify: `backend/app/models.py`
- Create: `backend/migrate_shock_per_bike.py`

- [ ] **Step 1: Update models.py — add ShockBrand, extend ShockSetting, ShockPreset, User**

Replace the `ShockSetting` and `ShockPreset` classes and `User` class, and add `ShockBrand` after `TaskTemplate`. Full replacements:

In `backend/app/models.py`, add this import at the top (already has these, just confirm):
```python
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime, date, timezone
from enum import Enum
```

Replace `ShockSetting` class:
```python
class ShockSetting(SQLModel, table=True):
    __tablename__ = "shock_settings"
    id: Optional[int] = Field(default=None, primary_key=True)
    motorcycle_id: Optional[int] = Field(default=None, foreign_key="motorcycles.id", index=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    rider_weight: float = Field(default=75.0)
    passenger_weight: float = Field(default=0.0)
    mode: str = Field(default="street")
    shock_brand: Optional[str] = Field(default=None)
    shock_model: Optional[str] = Field(default=None)
```

Replace `ShockPreset` class:
```python
class ShockPreset(SQLModel, table=True):
    __tablename__ = "shock_presets"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    rider_weight: float
    passenger_weight: float
    mode: str = Field(default="street")
    preload: float
    comp: int
    reb: int
    note: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    motorcycle_id: Optional[int] = Field(default=None, foreign_key="motorcycles.id", index=True)
    shock_brand: Optional[str] = Field(default=None)
    shock_model: Optional[str] = Field(default=None)
```

Add `is_admin` to `User` class (after `created_at`):
```python
class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    profiles: List["Profile"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
```

Add `ShockBrand` class after `TaskTemplate`:
```python
class ShockBrand(SQLModel, table=True):
    __tablename__ = "shock_brands"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    accent_color: str = Field(default="#a78bfa")
    banner_bg_color: str = Field(default="#09091a")
    header_image_path: Optional[str] = Field(default=None)
    shock_models: Optional[str] = Field(default=None)  # JSON array string e.g. '["P-Series","G30"]'
```

- [ ] **Step 2: Create migration script `backend/migrate_shock_per_bike.py`**

```python
import sqlite3
import os
import argparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BRANDS_DIR = os.path.join(SCRIPT_DIR, "static", "brands")

SEED_BRANDS = [
    ("Profender", "#e8251a", "#000000", '["P-Series","G30","G2R"]'),
    ("Öhlins",   "#f4a620", "#1a5fb4", '["STX 36","EC 460","TTX GP"]'),
    ("YSS",      "#e01010", "#000000", '["G-Series","Z-Series","ME302"]'),
    ("Stock",    "#a78bfa", "#09091a", "[]"),
]


def col_exists(conn: sqlite3.Connection, table: str, col: str) -> bool:
    return col in [r[1] for r in conn.execute(f"PRAGMA table_info({table})")]


def migrate(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    try:
        # ── shock_settings ──────────────────────────────────────────
        for col, definition in [
            ("motorcycle_id", "INTEGER REFERENCES motorcycles(id)"),
            ("shock_brand",   "TEXT"),
            ("shock_model",   "TEXT"),
        ]:
            if not col_exists(conn, "shock_settings", col):
                conn.execute(f"ALTER TABLE shock_settings ADD COLUMN {col} {definition}")

        # Assign motorcycle_id to existing rows (first bike of that user)
        conn.execute("""
            UPDATE shock_settings
            SET motorcycle_id = (
                SELECT motorcycles.id FROM motorcycles
                JOIN profiles ON profiles.id = motorcycles.profile_id
                WHERE profiles.user_id = shock_settings.user_id
                ORDER BY motorcycles.id ASC LIMIT 1
            )
            WHERE motorcycle_id IS NULL AND user_id IS NOT NULL
        """)

        # ── shock_presets ────────────────────────────────────────────
        for col, definition in [
            ("motorcycle_id", "INTEGER REFERENCES motorcycles(id)"),
            ("shock_brand",   "TEXT"),
            ("shock_model",   "TEXT"),
        ]:
            if not col_exists(conn, "shock_presets", col):
                conn.execute(f"ALTER TABLE shock_presets ADD COLUMN {col} {definition}")

        # ── users ────────────────────────────────────────────────────
        if not col_exists(conn, "users", "is_admin"):
            conn.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")

        # ── shock_brands ─────────────────────────────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS shock_brands (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT UNIQUE NOT NULL,
                accent_color     TEXT NOT NULL DEFAULT '#a78bfa',
                banner_bg_color  TEXT NOT NULL DEFAULT '#09091a',
                header_image_path TEXT,
                shock_models TEXT
            )
        """)
        for name, accent, banner_bg, models in SEED_BRANDS:
            conn.execute(
                "INSERT OR IGNORE INTO shock_brands "
                "(name, accent_color, banner_bg_color, shock_models) VALUES (?,?,?,?)",
                (name, accent, banner_bg, models),
            )

        # ── static/brands directory ──────────────────────────────────
        os.makedirs(BRANDS_DIR, exist_ok=True)

        conn.commit()
        print("Migration complete.")
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="moto_tracker.db")
    args = parser.parse_args()
    migrate(args.db)
```

- [ ] **Step 3: Run migration against production DB**

```bash
cd /Volumes/Maythane/My-Project/My-bike/backend
python3 migrate_shock_per_bike.py --db moto_tracker.db
```

Expected output: `Migration complete.`

- [ ] **Step 4: Verify schema**

```bash
sqlite3 moto_tracker.db ".schema shock_brands" && \
sqlite3 moto_tracker.db "SELECT name, accent_color FROM shock_brands;" && \
sqlite3 moto_tracker.db "PRAGMA table_info(shock_settings);" | grep -E "motorcycle_id|shock_brand|shock_model"
```

Expected: shock_brands table exists with 4 rows; shock_settings has new columns.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models.py backend/migrate_shock_per_bike.py
git commit -m "feat: add ShockBrand model, per-bike ShockSetting fields, is_admin to User"
```

---

## Task 2: ShockBrand Backend Router

**Files:**
- Create: `backend/app/routers/shock_brands.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create `backend/app/routers/shock_brands.py`**

```python
import json
import os
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlmodel import Session, select

from app.auth import get_current_user
from app.database import get_session
from app.models import ShockBrand, User

router = APIRouter(tags=["shock-brands"])

BRANDS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "static", "brands")


class ShockBrandRead(BaseModel):
    id: int
    name: str
    accent_color: str
    banner_bg_color: str
    header_image_url: Optional[str]
    shock_models: List[str]

    @classmethod
    def from_model(cls, brand: ShockBrand) -> "ShockBrandRead":
        return cls(
            id=brand.id,
            name=brand.name,
            accent_color=brand.accent_color,
            banner_bg_color=brand.banner_bg_color,
            header_image_url=f"/static/brands/{brand.header_image_path}"
            if brand.header_image_path else None,
            shock_models=json.loads(brand.shock_models) if brand.shock_models else [],
        )


@router.get("/api/shock-brands", response_model=List[ShockBrandRead])
def list_brands(session: Session = Depends(get_session)):
    brands = session.exec(select(ShockBrand).order_by(ShockBrand.id)).all()
    return [ShockBrandRead.from_model(b) for b in brands]


@router.put("/api/admin/shock-brands/{brand_id}/image", response_model=ShockBrandRead)
async def upload_brand_image(
    brand_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    brand = session.get(ShockBrand, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    ext = os.path.splitext(file.filename or "")[1].lower() or ".png"
    filename = f"{brand.name.lower().replace(' ', '_').replace('ö', 'o')}{ext}"
    os.makedirs(BRANDS_DIR, exist_ok=True)
    dest = os.path.join(BRANDS_DIR, filename)
    contents = await file.read()
    with open(dest, "wb") as f:
        f.write(contents)
    brand.header_image_path = filename
    session.add(brand)
    session.commit()
    session.refresh(brand)
    return ShockBrandRead.from_model(brand)
```

- [ ] **Step 2: Update `backend/app/main.py` — register router + mount static/brands**

Add `shock_brands` to the import line and add it to the includes:

```python
from app.routers import profiles, motorcycles, tasks, logs, settings, templates, fuel, shock, shock_presets, auth, shock_brands
```

After `app.include_router(shock_presets.router)` add:
```python
app.include_router(shock_brands.router)
```

After the existing `UPLOADS_DIR` mount block, add:
```python
BRANDS_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "brands")
os.makedirs(BRANDS_DIR, exist_ok=True)
app.mount("/static/brands", StaticFiles(directory=BRANDS_DIR), name="brands")
```

- [ ] **Step 3: Verify — restart server and test**

```bash
cd /Volumes/Maythane/My-Project/My-bike
python3 server.py &
sleep 2
curl -s http://localhost:8764/api/shock-brands | python3 -m json.tool
```

Expected: JSON array with 4 brands (Profender, Öhlins, YSS, Stock), each with `shock_models` array.

- [ ] **Step 4: Kill test server + commit**

```bash
kill %1
git add backend/app/routers/shock_brands.py backend/app/main.py
git commit -m "feat: add ShockBrand router with list + admin image upload"
```

---

## Task 3: ShockSetting Per-Bike API

**Files:**
- Modify: `backend/app/routers/shock.py`

- [ ] **Step 1: Replace `backend/app/routers/shock.py` entirely**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import Optional
from pydantic import BaseModel

from app.database import get_session
from app.models import ShockSetting, User
from app.auth import get_current_user
from app.utils import get_motorcycle_for_user

router = APIRouter(tags=["shock"])


class ShockSettingUpdate(BaseModel):
    rider_weight: Optional[float] = None
    passenger_weight: Optional[float] = None
    mode: Optional[str] = None
    shock_brand: Optional[str] = None
    shock_model: Optional[str] = None


def _get_or_create(bike_id: int, user: User, session: Session) -> ShockSetting:
    get_motorcycle_for_user(bike_id, user, session)  # ownership check — raises 404 if not owner
    setting = session.exec(
        select(ShockSetting).where(ShockSetting.motorcycle_id == bike_id)
    ).first()
    if not setting:
        setting = ShockSetting(motorcycle_id=bike_id, user_id=user.id)
        session.add(setting)
        session.commit()
        session.refresh(setting)
    return setting


@router.get("/api/motorcycles/{bike_id}/shock-setting", response_model=ShockSetting)
def get_shock_setting(
    bike_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return _get_or_create(bike_id, current_user, session)


@router.put("/api/motorcycles/{bike_id}/shock-setting", response_model=ShockSetting)
def update_shock_setting(
    bike_id: int,
    data: ShockSettingUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    setting = _get_or_create(bike_id, current_user, session)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(setting, field, value)
    session.add(setting)
    session.commit()
    session.refresh(setting)
    return setting
```

- [ ] **Step 2: Verify — restart server and test**

```bash
cd /Volumes/Maythane/My-Project/My-bike && python3 server.py &
sleep 2
TOKEN=$(curl -s -X POST http://localhost:8764/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"maythane.psb@gmail.com","password":"maythane01"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
BIKE_ID=$(curl -s http://localhost:8764/api/motorcycles \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
curl -s "http://localhost:8764/api/motorcycles/${BIKE_ID}/shock-setting" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Expected: ShockSetting JSON with `motorcycle_id` matching `BIKE_ID`.

- [ ] **Step 3: Kill test server + commit**

```bash
kill %1
git add backend/app/routers/shock.py
git commit -m "feat: change shock-setting to per-motorcycle endpoint"
```

---

## Task 4: Auth Update Endpoints

**Files:**
- Modify: `backend/app/routers/auth.py`

- [ ] **Step 1: Add PUT /email and PUT /password to `backend/app/routers/auth.py`**

At the bottom of the file (after the existing `/me` endpoint), add:

```python
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
```

Also add `select` to the sqlmodel import if not already present. The existing import is:
```python
from sqlmodel import Session, select
```
Confirm it's there — if not, add `select`.

- [ ] **Step 2: Verify**

```bash
cd /Volumes/Maythane/My-Project/My-bike && python3 server.py &
sleep 2
TOKEN=$(curl -s -X POST http://localhost:8764/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"maythane.psb@gmail.com","password":"maythane01"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
# Test wrong current password
curl -s -X PUT http://localhost:8764/api/auth/password \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"current_password":"wrong","new_password":"newpass123"}' | python3 -m json.tool
```

Expected: `{"detail": "Current password incorrect"}` with HTTP 401.

- [ ] **Step 3: Kill test server + commit**

```bash
kill %1
git add backend/app/routers/auth.py
git commit -m "feat: add PUT /api/auth/email and PUT /api/auth/password endpoints"
```

---

## Task 5: Frontend CSS

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Replace old auth CSS classes and add new ones**

Find and replace the existing `.auth-page` through `.auth-link` block (lines ~1941–1984) with:

```css
/* ─── Auth Page ─────────────────────────────────────────────────── */
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.auth-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-md);
  padding: 2rem;
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
  z-index: 1;
}
.auth-card h1 { font-size: 1.5rem; margin: 0; text-align: center; color: var(--ink); }
.auth-card h2 { font-size: 1rem; margin: 0; color: var(--slate); text-align: center; }
.auth-tabs { display: flex; background: var(--surface); border-radius: var(--r); padding: 3px; gap: 2px; }
.auth-tab {
  flex: 1; text-align: center; padding: 0.5rem;
  border-radius: calc(var(--r) - 2px);
  font-size: 0.875rem; font-weight: 500;
  color: var(--slate); cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}
.auth-tab.active {
  background: var(--purple-bg);
  color: var(--purple);
  border-color: var(--purple-border);
  font-weight: 600;
}
.auth-form { display: flex; flex-direction: column; gap: 0.625rem; }
.auth-form label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.875rem; color: var(--slate); }
.auth-form input {
  padding: 0.6rem 0.8rem;
  border-radius: var(--r);
  border: 1px solid var(--glass-border);
  background: var(--surface);
  color: var(--ink);
  font-size: 1rem;
}
.auth-form input:focus { outline: none; border-color: var(--purple-border); }
.auth-error { color: var(--red); font-size: 0.875rem; margin: 0; }
.auth-success { color: var(--green); font-size: 0.875rem; margin: 0; }

/* ─── Avatar Dropdown ───────────────────────────────────────────── */
.avatar-menu { position: relative; }
.avatar-btn {
  width: 34px; height: 34px; border-radius: var(--r-full);
  background: linear-gradient(135deg, var(--green), #00d2ff);
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 700; color: #000;
  box-shadow: 0 0 0 2px var(--green-border);
  transition: transform 0.18s var(--jelly-ease);
}
.avatar-btn:hover { transform: scale(1.08); }
.avatar-dropdown {
  position: absolute; right: 0; top: calc(100% + 8px);
  background: var(--elevated); border: 1px solid var(--glass-border);
  border-radius: var(--r-md); padding: 6px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.55);
  min-width: 220px; z-index: 200;
  animation: dropdown-in 0.15s var(--jelly-ease);
}
@keyframes dropdown-in {
  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.avatar-dropdown-header {
  padding: 10px 12px; border-bottom: 1px solid var(--hairline); margin-bottom: 4px;
}
.avatar-dropdown-email { font-size: 12px; color: var(--slate); margin-bottom: 2px; }
.avatar-dropdown-user  { font-size: 13px; color: var(--green); font-weight: 600; }
.avatar-dropdown-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; border-radius: calc(var(--r-md) - 6px);
  cursor: pointer; font-size: 13px; color: var(--ink);
  transition: background 0.12s;
}
.avatar-dropdown-item:hover { background: var(--surface); }
.avatar-dropdown-item.danger { color: var(--red); }
.avatar-dropdown-divider { height: 1px; background: var(--hairline); margin: 4px 0; }

/* ─── Account Modal ─────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 300; padding: 1rem;
}
.modal-box {
  background: rgba(18,18,40,0.98);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-md);
  padding: 1.5rem;
  width: 100%; max-width: 380px;
  display: flex; flex-direction: column; gap: 1rem;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6);
  animation: modal-in 0.2s var(--jelly-ease);
}
@keyframes modal-in {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
}
.modal-title { font-size: 15px; font-weight: 600; color: var(--ink); }
.modal-close {
  background: none; border: none; color: var(--steel);
  font-size: 20px; cursor: pointer; padding: 0; line-height: 1;
}
.modal-close:hover { color: var(--ink); }

/* ─── Settings Page ─────────────────────────────────────────────── */
.settings-section-label {
  font-size: 11px; color: var(--steel);
  text-transform: uppercase; letter-spacing: 0.08em;
  margin-bottom: 8px;
}
.settings-card {
  background: var(--glass-bg); border: 1px solid var(--glass-border);
  border-radius: var(--r-md); padding: 1rem;
  display: flex; flex-direction: column; gap: 0.75rem;
}
.settings-row {
  display: flex; justify-content: space-between; align-items: center;
}
.settings-row-label { font-size: 14px; color: var(--ink); }
.settings-bike-card {
  background: var(--glass-bg); border: 1px solid var(--glass-border);
  border-radius: var(--r); padding: 0.875rem 1rem;
  display: flex; justify-content: space-between; align-items: center;
}
.settings-bike-name { font-size: 13px; font-weight: 600; color: var(--ink); }
.settings-bike-shock { font-size: 12px; color: var(--slate); margin-top: 2px; }
.toggle-group { display: flex; gap: 4px; }
.toggle-btn {
  padding: 5px 14px; border-radius: var(--r-full); font-size: 13px; font-weight: 500;
  border: 1px solid var(--hairline); background: var(--surface); color: var(--slate);
  cursor: pointer; transition: all 0.15s;
}
.toggle-btn.active {
  background: var(--purple-bg); border-color: var(--purple-border);
  color: var(--purple); font-weight: 600;
}

/* ─── Shock Brand Theming (ShockSettingsPage only) ──────────────── */
.shock-brand-banner {
  height: 90px; position: relative; overflow: hidden;
}
.shock-brand-banner img {
  width: 100%; height: 100%; object-fit: contain; display: block;
}
.shock-brand-banner-fade {
  position: absolute; inset: 0;
  background: linear-gradient(to bottom, transparent 45%, var(--canvas) 100%);
}
.shock-page-navbar {
  position: relative;
}
.shock-page-navbar::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--brand-accent, var(--purple));
  border-radius: 0 2px 2px 0;
}
.chip-brand-active {
  padding: 5px 13px; border-radius: var(--r-full); font-size: 13px; font-weight: 600;
  background: var(--brand-accent-bg, var(--purple-bg));
  border: 1px solid var(--brand-accent-border, var(--purple-border));
  color: var(--brand-accent, var(--purple));
  cursor: pointer; transition: all 0.15s;
}
.chip-brand-idle {
  padding: 5px 13px; border-radius: var(--r-full); font-size: 13px;
  background: var(--surface); border: 1px solid var(--hairline);
  color: var(--slate); cursor: pointer; transition: all 0.15s;
}
.chip-brand-idle:hover { background: var(--elevated); color: var(--ink); }
.btn-brand {
  background: var(--brand-accent, var(--purple));
  color: #fff; font-weight: 700; font-size: 14px;
  padding: 10px 20px; border-radius: var(--r); border: none; cursor: pointer;
  box-shadow: 0 4px 16px var(--brand-accent-glow, rgba(167,139,250,0.30));
  transition: filter 0.15s, transform 0.18s var(--jelly-ease);
}
.btn-brand:hover:not(:disabled) { filter: brightness(1.1); transform: scale(1.03); }
.btn-brand:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 2: Build check**

```bash
cd /Volumes/Maythane/My-Project/My-bike/frontend && npm run build 2>&1 | tail -5
```

Expected: no CSS errors, build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Volumes/Maythane/My-Project/My-bike
git add frontend/src/index.css
git commit -m "style: fix auth CSS to use design tokens, add brand theming and modal classes"
```

---

## Task 6: Frontend Types + API Layer

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/api/shockBrands.ts`
- Create: `frontend/src/api/settings.ts`
- Modify: `frontend/src/api/shock.ts`
- Modify: `frontend/src/api/shock_presets.ts`
- Modify: `frontend/src/api/auth.ts`

- [ ] **Step 1: Add types to `frontend/src/types/index.ts`**

Append to the end of the file:

```typescript
export interface ShockBrand {
  id: number;
  name: string;
  accent_color: string;
  banner_bg_color: string;
  header_image_url: string | null;
  shock_models: string[];
}

export interface ShockSetting {
  id: number;
  motorcycle_id: number | null;
  user_id: number | null;
  rider_weight: number;
  passenger_weight: number;
  mode: string;
  shock_brand: string | null;
  shock_model: string | null;
}
```

- [ ] **Step 2: Create `frontend/src/api/shockBrands.ts`**

```typescript
import client from "./client";
import type { ShockBrand } from "../types";

export const fetchShockBrands = () =>
  client.get<ShockBrand[]>("/api/shock-brands").then((r) => r.data);
```

- [ ] **Step 3: Create `frontend/src/api/settings.ts`**

```typescript
import client from "./client";
import type { AppSettings } from "../types";

export const fetchSettings = () =>
  client.get<AppSettings>("/api/settings").then((r) => r.data);

export const updateSettings = (data: Partial<Pick<AppSettings, "default_unit" | "timezone">>) =>
  client.put<AppSettings>("/api/settings", data).then((r) => r.data);
```

- [ ] **Step 4: Replace `frontend/src/api/shock.ts`**

```typescript
import client from "./client";
import type { ShockSetting } from "../types";

export type { ShockSetting };

export const getShockSetting = (bikeId: number) =>
  client.get<ShockSetting>(`/api/motorcycles/${bikeId}/shock-setting`).then((r) => r.data);

export const updateShockSetting = (
  bikeId: number,
  data: Partial<Omit<ShockSetting, "id" | "motorcycle_id" | "user_id">>,
) => client.put<ShockSetting>(`/api/motorcycles/${bikeId}/shock-setting`, data).then((r) => r.data);
```

- [ ] **Step 5: Update `frontend/src/api/shock_presets.ts` — add optional brand fields to ShockPresetCreate**

In the existing file, find the `ShockPresetCreate` type (or equivalent object passed to `createPreset`). The file uses a `ShockPreset` type for creation. Update it:

```typescript
import client from "./client";

export type ShockPreset = {
  id: number;
  name: string;
  rider_weight: number;
  passenger_weight: number;
  mode: string;
  preload: number;
  comp: number;
  reb: number;
  note: string | null;
  created_at: string;
  user_id: number | null;
  motorcycle_id: number | null;
  shock_brand: string | null;
  shock_model: string | null;
};

export type ShockPresetCreate = Omit<ShockPreset, "id" | "created_at">;
export type ShockPresetUpdate = Partial<ShockPresetCreate>;

export const listPresets = (bikeId?: number) => {
  const url = bikeId
    ? `/api/shock-presets?motorcycle_id=${bikeId}`
    : "/api/shock-presets";
  return client.get<ShockPreset[]>(url).then((r) => r.data);
};

export const createPreset = (data: ShockPresetCreate) =>
  client.post<ShockPreset>("/api/shock-presets", data).then((r) => r.data);

export const updatePreset = (id: number, data: ShockPresetUpdate) =>
  client.patch<ShockPreset>(`/api/shock-presets/${id}`, data).then((r) => r.data);

export const deletePreset = (id: number) =>
  client.delete(`/api/shock-presets/${id}`);
```

- [ ] **Step 6: Add email/password update functions to `frontend/src/api/auth.ts`**

Append to the existing file (which already has `fetchRegister`, `fetchLogin`, `fetchMe`):

```typescript
export async function fetchUpdateEmail(new_email: string): Promise<void> {
  await client.put("/api/auth/email", { new_email });
}

export async function fetchUpdatePassword(
  current_password: string,
  new_password: string,
): Promise<void> {
  await client.put("/api/auth/password", { current_password, new_password });
}
```

- [ ] **Step 7: Build check**

```bash
cd /Volumes/Maythane/My-Project/My-bike/frontend && npm run build 2>&1 | tail -8
```

Expected: TypeScript compiles cleanly.

- [ ] **Step 8: Commit**

```bash
cd /Volumes/Maythane/My-Project/My-bike
git add frontend/src/types/index.ts frontend/src/api/shockBrands.ts \
        frontend/src/api/settings.ts frontend/src/api/shock.ts \
        frontend/src/api/shock_presets.ts frontend/src/api/auth.ts
git commit -m "feat: update frontend types and API layer for per-bike shock + brand system"
```

---

## Task 7: Blobs Component + AuthPage

**Files:**
- Create: `frontend/src/components/ui/Blobs.tsx`
- Create: `frontend/src/pages/AuthPage.tsx`
- Delete: `frontend/src/pages/LoginPage.tsx`
- Delete: `frontend/src/pages/RegisterPage.tsx`

- [ ] **Step 1: Create `frontend/src/components/ui/Blobs.tsx`**

```tsx
export default function Blobs() {
  return (
    <div
      aria-hidden
      style={{ position: "fixed", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none" }}
    >
      <div style={{
        position: "absolute", width: 560, height: 560,
        background: "radial-gradient(circle, rgba(57,255,150,0.55) 0%, transparent 70%)",
        filter: "blur(90px)", top: "-140px", right: "-100px",
        animation: "blob-float 13s ease-in-out infinite", opacity: 0.6,
      }} />
      <div style={{
        position: "absolute", width: 480, height: 480,
        background: "radial-gradient(circle, rgba(0,210,255,0.50) 0%, transparent 70%)",
        filter: "blur(80px)", bottom: "5%", left: "-80px",
        animation: "blob-float 17s ease-in-out infinite reverse",
        animationDelay: "-6s", opacity: 0.5,
      }} />
      <div style={{
        position: "absolute", width: 420, height: 420,
        background: "radial-gradient(circle, rgba(124,58,237,0.55) 0%, transparent 70%)",
        filter: "blur(80px)", top: "38%", left: "45%",
        transform: "translate(-50%, -50%)",
        animation: "blob-float 20s ease-in-out infinite",
        animationDelay: "-10s", opacity: 0.45,
      }} />
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/pages/AuthPage.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Blobs from "../components/ui/Blobs";

type Tab = "login" | "register";

export default function AuthPage() {
  const { isAuthenticated, login, register } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (tab === "register" && password !== confirm) {
      setError("Password ไม่ตรงกัน");
      return;
    }
    setLoading(true);
    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

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
            onClick={() => { setTab("login"); setError(null); }}
          >
            เข้าสู่ระบบ
          </div>
          <div
            className={`auth-tab${tab === "register" ? " active" : ""}`}
            onClick={() => { setTab("register"); setError(null); }}
          >
            สมัครสมาชิก
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
              placeholder="••••••••"
              required
            />
          </label>
          {tab === "register" && (
            <label>
              Confirm Password
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
          )}
          {error && <p className="auth-error">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ marginTop: "0.5rem" }}
          >
            {loading
              ? "กำลังดำเนินการ…"
              : tab === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Delete old pages**

```bash
rm /Volumes/Maythane/My-Project/My-bike/frontend/src/pages/LoginPage.tsx
rm /Volumes/Maythane/My-Project/My-bike/frontend/src/pages/RegisterPage.tsx
```

- [ ] **Step 4: Build check (will fail until App.tsx is updated — note errors)**

```bash
cd /Volumes/Maythane/My-Project/My-bike/frontend && npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected errors: `Cannot find module './pages/LoginPage'` and `RegisterPage` — these will be fixed in Task 12.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/Maythane/My-Project/My-bike
git add frontend/src/components/ui/Blobs.tsx frontend/src/pages/AuthPage.tsx
git rm frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx
git commit -m "feat: replace LoginPage+RegisterPage with unified AuthPage (tab switcher)"
```

---

## Task 8: AvatarMenu Component

**Files:**
- Create: `frontend/src/components/ui/AvatarMenu.tsx`

- [ ] **Step 1: Create `frontend/src/components/ui/AvatarMenu.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "../../api/auth";
import { useAuth } from "../../hooks/useAuth";
import AccountModal from "./AccountModal";

export default function AvatarMenu() {
  const [open, setOpen] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 60_000,
  });

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const initial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <>
      <div className="avatar-menu" ref={ref}>
        <button className="avatar-btn" onClick={() => setOpen((v) => !v)} title="บัญชีผู้ใช้">
          {initial}
        </button>

        {open && (
          <div className="avatar-dropdown">
            <div className="avatar-dropdown-header">
              <div className="avatar-dropdown-email">Signed in as</div>
              <div className="avatar-dropdown-user">{user?.email ?? "…"}</div>
            </div>

            <div
              className="avatar-dropdown-item"
              onClick={() => { setOpen(false); setShowAccount(true); }}
            >
              <span>👤</span> Manage Account
            </div>
            <div
              className="avatar-dropdown-item"
              onClick={() => { setOpen(false); navigate("/settings"); }}
            >
              <span>⚙️</span> Settings
            </div>

            <div className="avatar-dropdown-divider" />

            <div
              className="avatar-dropdown-item danger"
              onClick={() => { setOpen(false); logout(); }}
            >
              <span>🚪</span> Logout
            </div>
          </div>
        )}
      </div>

      {showAccount && <AccountModal onClose={() => setShowAccount(false)} />}
    </>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /Volumes/Maythane/My-Project/My-bike/frontend && npm run build 2>&1 | grep -i error | head -5
```

Expected: only the existing LoginPage/RegisterPage import errors in App.tsx — AvatarMenu itself should be clean.

- [ ] **Step 3: Commit**

```bash
cd /Volumes/Maythane/My-Project/My-bike
git add frontend/src/components/ui/AvatarMenu.tsx
git commit -m "feat: add AvatarMenu component with dropdown (Account, Settings, Logout)"
```

---

## Task 9: AccountModal Component

**Files:**
- Create: `frontend/src/components/ui/AccountModal.tsx`

- [ ] **Step 1: Create `frontend/src/components/ui/AccountModal.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchUpdateEmail, fetchUpdatePassword } from "../../api/auth";

type Tab = "email" | "password";

export default function AccountModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("email");

  const [newEmail, setNewEmail] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function reset() {
    setError(null);
    setSuccess(null);
    setNewEmail("");
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await fetchUpdateEmail(newEmail);
      setSuccess("อัปเดต email แล้ว");
      qc.invalidateQueries({ queryKey: ["me"] });
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPw !== confirmPw) {
      setError("Password ใหม่ไม่ตรงกัน");
      return;
    }
    setLoading(true);
    try {
      await fetchUpdatePassword(currentPw, newPw);
      setSuccess("เปลี่ยน password แล้ว");
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <span className="modal-title">👤 Manage Account</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="auth-tabs">
          <div
            className={`auth-tab${tab === "email" ? " active" : ""}`}
            onClick={() => { setTab("email"); reset(); }}
          >
            Email
          </div>
          <div
            className={`auth-tab${tab === "password" ? " active" : ""}`}
            onClick={() => { setTab("password"); reset(); }}
          >
            Password
          </div>
        </div>

        {tab === "email" && (
          <form onSubmit={handleEmailSubmit} className="auth-form">
            <label>
              New Email
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                required
              />
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
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                required
              />
            </label>
            <label>
              New Password
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                minLength={8}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                required
              />
            </label>
            <label>
              Confirm New Password
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
              />
            </label>
            {error && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">✓ {success}</p>}
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "กำลังเปลี่ยน…" : "Change Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /Volumes/Maythane/My-Project/My-bike/frontend && npm run build 2>&1 | grep -i error | head -5
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/Maythane/My-Project/My-bike
git add frontend/src/components/ui/AccountModal.tsx
git commit -m "feat: add AccountModal with email and password change tabs"
```

---

## Task 10: SettingsPage + ShockSetupPage

**Files:**
- Create: `frontend/src/pages/SettingsPage.tsx`
- Create: `frontend/src/pages/ShockSetupPage.tsx`

- [ ] **Step 1: Create `frontend/src/pages/SettingsPage.tsx`**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllMotorcycles } from "../api/motorcycles";
import { fetchSettings, updateSettings } from "../api/settings";
import { getShockSetting } from "../api/shock";

export default function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const { data: bikes } = useQuery({ queryKey: ["motorcycles"], queryFn: getAllMotorcycles });

  const [unit, setUnit] = useState<"km" | "miles" | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const effectiveUnit = unit ?? settings?.default_unit ?? "km";
  const effectiveTz = timezone ?? settings?.timezone ?? "Asia/Bangkok";

  const { mutate: saveSettings, isPending } = useMutation({
    mutationFn: () => updateSettings({ default_unit: effectiveUnit, timezone: effectiveTz }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setSaveMsg("บันทึกแล้ว");
      setTimeout(() => setSaveMsg(null), 2000);
    },
  });

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate(-1)}
          style={{ fontSize: 13 }}
        >
          ← กลับ
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
          ⚙️ Settings
        </h1>
      </div>

      {/* General settings */}
      <div style={{ marginBottom: 24 }}>
        <div className="settings-section-label">ทั่วไป</div>
        <div className="settings-card">
          <div className="settings-row">
            <span className="settings-row-label">Distance Unit</span>
            <div className="toggle-group">
              <button
                className={`toggle-btn${effectiveUnit === "km" ? " active" : ""}`}
                onClick={() => setUnit("km")}
              >km</button>
              <button
                className={`toggle-btn${effectiveUnit === "miles" ? " active" : ""}`}
                onClick={() => setUnit("miles")}
              >miles</button>
            </div>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">Timezone</span>
            <input
              style={{
                background: "var(--surface)", border: "1px solid var(--glass-border)",
                borderRadius: "var(--r)", padding: "6px 12px", color: "var(--ink)",
                fontSize: 13, width: 160,
              }}
              value={effectiveTz}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Per-bike shock setup */}
      <div style={{ marginBottom: 24 }}>
        <div className="settings-section-label">Shock Setup ต่อคัน</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {bikes?.map((bike) => (
            <BikeSockRow
              key={bike.id}
              bikeId={bike.id}
              bikeName={bike.nickname ?? `${bike.make} ${bike.model}`}
              onEdit={() => navigate(`/settings/bikes/${bike.id}/shock`)}
            />
          ))}
          {!bikes?.length && (
            <div style={{ color: "var(--slate)", fontSize: 13 }}>ยังไม่มีรถในระบบ</div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          className="btn btn-primary"
          onClick={() => saveSettings()}
          disabled={isPending}
        >
          {isPending ? "กำลังบันทึก…" : "Save Settings"}
        </button>
        {saveMsg && (
          <span style={{ color: "var(--green)", fontSize: 13 }}>✓ {saveMsg}</span>
        )}
      </div>
    </div>
  );
}

function BikeSockRow({
  bikeId, bikeName, onEdit,
}: { bikeId: number; bikeName: string; onEdit: () => void }) {
  const { data: setting } = useQuery({
    queryKey: ["shock-setting", bikeId],
    queryFn: () => getShockSetting(bikeId),
  });

  const shockLabel = setting?.shock_brand
    ? `${setting.shock_brand}${setting.shock_model ? ` · ${setting.shock_model}` : ""}`
    : "ยังไม่ได้ตั้งค่า";

  return (
    <div className="settings-bike-card">
      <div>
        <div className="settings-bike-name">{bikeName}</div>
        <div className="settings-bike-shock">{shockLabel}</div>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onEdit} style={{ fontSize: 12 }}>
        แก้ไข
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/pages/ShockSetupPage.tsx`**

```tsx
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMotorcycle } from "../api/motorcycles";
import { getShockSetting, updateShockSetting } from "../api/shock";
import { fetchShockBrands } from "../api/shockBrands";

export default function ShockSetupPage() {
  const { bikeId } = useParams<{ bikeId: string }>();
  const id = Number(bikeId);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: bike } = useQuery({ queryKey: ["motorcycle", id], queryFn: () => getMotorcycle(id) });
  const { data: setting } = useQuery({
    queryKey: ["shock-setting", id],
    queryFn: () => getShockSetting(id),
  });
  const { data: brands } = useQuery({ queryKey: ["shock-brands"], queryFn: fetchShockBrands });

  const [brand, setBrand] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const effectiveBrand = brand ?? setting?.shock_brand ?? null;
  const effectiveModel = model ?? setting?.shock_model ?? null;

  const selectedBrandData = brands?.find((b) => b.name === effectiveBrand);

  const { mutate: save, isPending } = useMutation({
    mutationFn: () =>
      updateShockSetting(id, { shock_brand: effectiveBrand ?? undefined, shock_model: effectiveModel ?? undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shock-setting", id] });
      setSaved(true);
      setTimeout(() => navigate("/settings"), 1000);
    },
  });

  const bikeName = bike ? (bike.nickname ?? `${bike.make} ${bike.model}`) : "…";

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/settings")} style={{ fontSize: 13 }}>
          ← Settings
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
          Shock Setup
        </h1>
      </div>
      <p style={{ color: "var(--slate)", fontSize: 13, marginBottom: 20 }}>{bikeName}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Step 1: Brand */}
        <div>
          <StepLabel n={1} label="Shock Brand" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {brands?.map((b) => (
              <button
                key={b.name}
                className={effectiveBrand === b.name ? "chip-brand-active" : "chip-brand-idle"}
                onClick={() => { setBrand(b.name); setModel(null); }}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Model — only when brand is selected and has models */}
        {selectedBrandData && selectedBrandData.shock_models.length > 0 && (
          <div>
            <StepLabel n={2} label="Shock Model" />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {selectedBrandData.shock_models.map((m) => (
                <button
                  key={m}
                  className={effectiveModel === m ? "chip-brand-active" : "chip-brand-idle"}
                  onClick={() => setModel(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {saved ? (
          <p style={{ color: "var(--green)", fontSize: 14 }}>✓ บันทึกแล้ว กลับไปหน้า Settings…</p>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => save()}
            disabled={isPending || !effectiveBrand}
          >
            {isPending ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        )}
      </div>
    </div>
  );
}

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%",
        background: "var(--purple-bg)", border: "1px solid var(--purple-border)",
        color: "var(--purple)", fontSize: 11, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{n}</div>
      <span style={{ fontSize: 12, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Build check**

```bash
cd /Volumes/Maythane/My-Project/My-bike/frontend && npm run build 2>&1 | grep -i error | head -5
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/Maythane/My-Project/My-bike
git add frontend/src/pages/SettingsPage.tsx frontend/src/pages/ShockSetupPage.tsx
git commit -m "feat: add SettingsPage (unit/timezone + per-bike shock overview) and ShockSetupPage"
```

---

## Task 11: ShockSettingsPage — Bike Selector + Brand Theming

**Files:**
- Modify: `frontend/src/pages/ShockSettingsPage.tsx`

- [ ] **Step 1: Add imports at top of ShockSettingsPage.tsx**

Find the existing imports block (first ~3 lines) and add:

```tsx
import { useQuery } from "@tanstack/react-query";
import { getAllMotorcycles } from "../api/motorcycles";
import { fetchShockBrands } from "../api/shockBrands";
import type { ShockBrand } from "../types";
```

- [ ] **Step 2: Add bike selection state and brand lookup — inside the component function**

The existing component starts with `export default function ShockSettingsPage() {` and has state for `riderWeight`, `passengerWeight`, `mode`. Add after the existing `useState` declarations:

```tsx
  const BIKE_KEY = "lastSelectedBikeId";
  const [selectedBikeId, setSelectedBikeId] = useState<number | null>(() => {
    const saved = localStorage.getItem(BIKE_KEY);
    return saved ? Number(saved) : null;
  });

  const { data: bikes } = useQuery({ queryKey: ["motorcycles"], queryFn: getAllMotorcycles });
  const { data: brands } = useQuery({ queryKey: ["shock-brands"], queryFn: fetchShockBrands });

  // Default to first bike if none selected
  const activeBikeId = selectedBikeId ?? bikes?.[0]?.id ?? null;

  function selectBike(id: number) {
    setSelectedBikeId(id);
    localStorage.setItem(BIKE_KEY, String(id));
  }

  // Brand lookup from the active bike's shock setting
  const [activeBrand, setActiveBrand] = useState<ShockBrand | null>(null);
```

- [ ] **Step 3: Replace the `getShockSetting()` / `updateShockSetting()` calls to use `activeBikeId`**

The existing code calls `getShockSetting()` (no argument) — change to `getShockSetting(activeBikeId!)` inside a `useEffect` that depends on `activeBikeId`. Find the existing `useEffect` that fetches shock settings and update it:

```tsx
  useEffect(() => {
    if (!activeBikeId) return;
    getShockSetting(activeBikeId).then((s) => {
      setRiderWeight(s.rider_weight);
      setPassengerWeight(s.passenger_weight);
      setMode(s.mode as RideMode);
      // Brand lookup
      if (s.shock_brand && brands) {
        const found = brands.find((b) => b.name === s.shock_brand) ?? null;
        setActiveBrand(found);
      } else {
        setActiveBrand(null);
      }
    });
  }, [activeBikeId, brands]);
```

- [ ] **Step 4: Update the save function to pass `activeBikeId`**

Find the existing call to `updateShockSetting(...)` and change it to:

```tsx
await updateShockSetting(activeBikeId!, { rider_weight: riderWeight, passenger_weight: passengerWeight, mode });
```

- [ ] **Step 5: Compute brand CSS variables + inject on container**

Add this helper near the top of the file (before the component):

```tsx
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
```

Inside the component, add:

```tsx
  const brandStyle: React.CSSProperties = activeBrand
    ? ({
        "--brand-accent": activeBrand.accent_color,
        "--brand-accent-bg": hexToRgba(activeBrand.accent_color, 0.14),
        "--brand-accent-border": hexToRgba(activeBrand.accent_color, 0.40),
        "--brand-accent-glow": hexToRgba(activeBrand.accent_color, 0.28),
        "--brand-banner-bg": activeBrand.banner_bg_color,
      } as React.CSSProperties)
    : {};
```

- [ ] **Step 6: Wrap the page JSX with brand style + add banner + bike selector**

Find the outermost `<div>` or `<div className="page">` in the return statement and update it:

```tsx
  return (
    <div style={brandStyle}>
      {/* Brand banner — only when brand has an image */}
      {activeBrand?.header_image_url && (
        <div className="shock-brand-banner" style={{ background: "var(--brand-banner-bg, var(--canvas))" }}>
          <img src={activeBrand.header_image_url} alt={activeBrand.name} />
          <div className="shock-brand-banner-fade" />
        </div>
      )}

      <div className="page">
        {/* Bike selector */}
        {bikes && bikes.length > 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {bikes.map((bike) => (
              <button
                key={bike.id}
                className={activeBikeId === bike.id ? "chip-brand-active" : "chip-brand-idle"}
                onClick={() => selectBike(bike.id)}
              >
                {bike.nickname ?? `${bike.make} ${bike.model}`}
              </button>
            ))}
          </div>
        )}

        {/* existing page content stays here unchanged */}
        {/* ... */}
      </div>
    </div>
  );
```

Keep all existing content (weight inputs, mode selector, preset list) inside the inner `<div className="page">`.

- [ ] **Step 7: Update save preset call to include motorcycle_id and shock brand info**

Find the `createPreset(...)` call and add the new fields:

```tsx
await createPreset({
  ...existingFields,  // keep all existing fields (name, rider_weight, etc.)
  motorcycle_id: activeBikeId ?? undefined,
  shock_brand: activeBrand?.name ?? undefined,
  shock_model: /* existing shock setting's shock_model */ undefined,
});
```

- [ ] **Step 8: Build + verify no TypeScript errors**

```bash
cd /Volumes/Maythane/My-Project/My-bike/frontend && npm run build 2>&1 | grep -E "error TS" | head -10
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
cd /Volumes/Maythane/My-Project/My-bike
git add frontend/src/pages/ShockSettingsPage.tsx
git commit -m "feat: add bike selector + brand banner + CSS variable theming to ShockSettingsPage"
```

---

## Task 12: App.tsx — Wire Everything Together

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Replace `App.tsx` entirely**

```tsx
import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTheme } from "./hooks/useTheme";
import { getToken } from "./hooks/useAuth";
import Blobs from "./components/ui/Blobs";
import AvatarMenu from "./components/ui/AvatarMenu";
import AuthPage from "./pages/AuthPage";
import GaragePage from "./pages/GaragePage";
import BikePage from "./pages/BikePage";
import ShockSettingsPage from "./pages/ShockSettingsPage";
import SettingsPage from "./pages/SettingsPage";
import ShockSetupPage from "./pages/ShockSetupPage";

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function NavBar({ theme, toggle }: { theme: "light" | "dark"; toggle: () => void }) {
  return (
    <nav className="app-nav">
      <span style={{ fontSize: 20 }}>🏍️</span>
      <div className="app-nav-links">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `app-nav-link${isActive ? " is-active" : ""}`}
        >
          My Garage
        </NavLink>
        <NavLink
          to="/shock-settings"
          className={({ isActive }) => `app-nav-link app-nav-link-accent${isActive ? " is-active" : ""}`}
        >
          ตั้งค่าโช้ค
        </NavLink>
      </div>
      <div style={{ flex: 1 }} />
      <button
        onClick={toggle}
        title={theme === "dark" ? "Light mode" : "Dark mode"}
        className="app-nav-toggle"
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.10) rotate(15deg)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1) rotate(0deg)")}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>
      <AvatarMenu />
    </nav>
  );
}

function AppShell() {
  const { theme, toggle } = useTheme();
  return (
    <Routes>
      {/* Public — no NavBar */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />

      {/* Protected — with NavBar */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative", zIndex: 1 }}>
              <NavBar theme={theme} toggle={toggle} />
              <div style={{ flex: 1, overflowY: "auto" }}>
                <Routes>
                  <Route path="/" element={<GaragePage />} />
                  <Route path="/bikes/:bikeId" element={<BikePage />} />
                  <Route path="/shock-settings" element={<ShockSettingsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settings/bikes/:bikeId/shock" element={<ShockSetupPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Blobs />
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Full build**

```bash
cd /Volumes/Maythane/My-Project/My-bike/frontend && npm run build 2>&1 | tail -10
```

Expected: `✓ built in Xs` — no TypeScript errors.

- [ ] **Step 3: Deploy to backend static**

```bash
cd /Volumes/Maythane/My-Project/My-bike/frontend && npm run deploy
```

- [ ] **Step 4: Start server and smoke test**

```bash
cd /Volumes/Maythane/My-Project/My-bike && python3 server.py &
sleep 2
# Verify auth page loads
curl -s -o /dev/null -w "%{http_code}" http://localhost:8764/login
```

Expected: `200`

Open **http://localhost:8764** in browser and verify:
- `/login` → AuthPage with tabs (เข้าสู่ระบบ / สมัครสมาชิก), Blobs background
- Login works → redirects to `/`
- NavBar shows avatar (no 🚪 button)
- Avatar click → dropdown with email shown
- Dropdown Settings → navigates to `/settings`
- `/settings` shows unit/timezone + per-bike shock row
- "แก้ไข" on bike → `/settings/bikes/{id}/shock` → select brand/model → save
- `/shock-settings` → bike selector chips (if >1 bike), brand banner appears after shock brand set
- Switching bikes changes banner + accent color

- [ ] **Step 5: Kill server + commit**

```bash
kill %1
cd /Volumes/Maythane/My-Project/My-bike
git add frontend/src/App.tsx
git commit -m "feat: wire AuthPage, AvatarMenu, SettingsPage, ShockSetupPage into App routing"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Part 1: AuthPage — Task 7
- ✅ Part 2: AvatarMenu — Task 8; App.tsx changes — Task 12
- ✅ Part 3: AccountModal — Task 9; backend endpoints — Task 4
- ✅ Part 4: SettingsPage `/settings` — Task 10; ShockSetupPage — Task 10
- ✅ Part 5: ShockBrand model — Task 1; ShockBrand router — Task 2
- ✅ Part 6: ShockSetting per-bike API — Task 3; migration — Task 1; ShockSettingsPage theming — Task 11
- ✅ CSS constraint (purple active tabs, btn-primary) — Task 5
- ✅ Admin image upload — Task 2
- ✅ `is_admin` on User — Task 1
- ✅ Brand banner only on ShockSettings — Task 11 (not added to other pages)
- ✅ `lastSelectedBikeId` in localStorage — Task 11

**Type consistency check:**
- `ShockSetting` type defined in `types/index.ts` Task 6 — used by `shock.ts` Task 6 and ShockSettingsPage Task 11 ✅
- `ShockBrand` type defined in `types/index.ts` Task 6 — used by `shockBrands.ts` Task 6, ShockSetupPage Task 10, ShockSettingsPage Task 11 ✅
- `getShockSetting(bikeId)` signature Task 6 — called with `activeBikeId` in Task 11 ✅
- `fetchShockBrands()` defined Task 6 — called in Tasks 10, 11 ✅
- `hexToRgba()` defined in Task 11 — used only in Task 11 ✅
