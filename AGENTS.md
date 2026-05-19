# My-bike — Moto Tracker

**Port:** 8764 | **DB:** `data/moto.db` (SQLite)

---

## Stack

**Backend**: Python 3.9+, FastAPI, SQLModel, SQLite
- venv: `backend/.venv/`
- Entry: `server.py` → `os.execve` uvicorn (ไม่ใช้ subprocess)
- Run: `cd backend && DB_PATH=../data/moto.db .venv/bin/uvicorn app.main:app --port 8764`

**Frontend**: React 19, TypeScript, Vite, TanStack Query
- Dev: `cd frontend && npm run dev` (proxy → localhost:8000)
- Build: `cd frontend && npm run build` → copy `frontend/dist/` → `backend/static/`

---

## Backend Structure

```
backend/app/
  main.py        ← FastAPI app, lifespan, mount routers
  models.py      ← SQLModel table models ทั้งหมด
  database.py    ← engine, create_db(), get_session()
  utils.py       ← helper functions
  seed.py        ← default data
  routers/
    profiles.py
    motorcycles.py
    tasks.py
    logs.py
    settings.py
    templates.py
    fuel.py
    shock.py
    shock_presets.py
backend/uploads/   ← uploaded images (bikes/, fuel/, service/)
backend/static/    ← built frontend (อย่าแก้ manually — build จาก frontend/)
```

---

## Frontend Structure

```
frontend/src/
  api/
    client.ts           ← base fetch wrapper
    profiles.ts
    motorcycles.ts
    tasks.ts
    logs.ts
    fuel.ts
    shock.ts
    shock_presets.ts
    templates.ts
  pages/
    GaragePage.tsx           ← motorcycle list/management
    BikePage.tsx             ← bike detail, tasks, logs (~27KB — ระบุ line range เมื่อแก้)
    ShockSettingsPage.tsx    ← shock absorber settings (~34KB — ระบุ line range เมื่อแก้)
  components/
    bikes/     ← BikeCard.tsx, BikeForm.tsx
    logs/
    profiles/
    tasks/
    layout/
    ui/        ← ConfirmDialog, EmptyState, Lightbox, SkeletonCard, StatusBadge
  hooks/
    useAnimatedClose.ts
    useConfirm.ts
    useGeoLocation.ts
    useSwipeReveal.ts
    useTheme.ts
  types/
    index.ts   ← interfaces ทั้งหมด (Motorcycle, FuelLog, TaskWithStatus ฯลฯ)
  data/
    bikeSpecs.ts
```

---

## Data Model

```
Profile → Motorcycle → MaintenanceTask → MaintenanceLog
                    → FuelLog
ShockSetting  (standalone)
ShockPreset   (standalone)
TaskTemplate  (standalone)
```

---

## Naming Conventions

| Context | Convention | ตัวอย่าง |
|---------|-----------|---------|
| Python vars/functions | snake_case | `get_session`, `mileage_unit` |
| Python classes | PascalCase | `MaintenanceLog`, `UnitEnum` |
| TypeScript vars/functions | camelCase | `fetchProfiles`, `mileageUnit` |
| TypeScript components/types | PascalCase | `BikePage`, `Motorcycle` |
| TypeScript component files | PascalCase | `BikePage.tsx` |
| TypeScript util/api files | camelCase | `profiles.ts`, `client.ts` |

---

## Code Style

- **Python comments**: ภาษาไทยได้ — ใช้สม่ำเสมอในไฟล์เดียวกัน
- **Type hints**: ทุก Python function ต้องมี
- **Pydantic schemas**: แยกจาก SQLModel table models (Create/Update/Response)
- **Error handling**: `raise HTTPException(status_code=..., detail=...)` เท่านั้น
- **No print()**: ห้ามใส่ใน production code
- **No over-engineering**: 3 function คล้ายกันดีกว่า 1 abstraction ซับซ้อน

---

## Rules

- ❌ ห้ามใช้ `subprocess` ใน `server.py` — ใช้ `os.execve` เท่านั้น
- ❌ ห้ามใช้ Alembic — `SQLModel.metadata.create_all()` เพียงพอ
- ❌ ห้ามใช้ PostgreSQL — SQLite เท่านั้น
- ❌ ห้ามเพิ่ม library ใหม่โดยไม่แจ้ง user ก่อน
- ❌ ห้ามสร้างไฟล์ `.env` — ใช้ environment variable ตรงๆ
- ❌ ห้ามเพิ่ม test ถ้าไม่ถูกขอ
- ⚠️ ไฟล์ที่มี >500 บรรทัด → ระบุ line range ที่ต้องแก้ ไม่ต้องอ่านทั้งไฟล์
- ⚠️ 1 task = 1 feature เท่านั้น — ห้ามรวม feature ใน prompt เดียว
