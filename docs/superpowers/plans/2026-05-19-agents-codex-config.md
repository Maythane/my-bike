# AGENTS.md + .codex/setup.sh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้าง `AGENTS.md` และ `.codex/setup.sh` ให้ Codex CLI ทำงานใน My-bike ได้ทันทีโดยมี full project context

**Architecture:** AGENTS.md อยู่ที่ project root — Codex concatenate กับ parent `My-Project/AGENTS.md` อัตโนมัติ setup.sh อยู่ใน `.codex/` รันก่อน Codex เริ่ม thread ใหม่ทุกครั้ง

**Tech Stack:** Markdown (AGENTS.md), Bash (setup.sh), Python venv, npm

---

### Task 1: Create AGENTS.md

**Files:**
- Create: `AGENTS.md`

- [ ] **Step 1: Create AGENTS.md at project root**

Create `/Volumes/Maythane/My-Project/My-bike/AGENTS.md` with this exact content:

```markdown
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
```

- [ ] **Step 2: Verify file was created**

```bash
wc -l AGENTS.md
```

Expected: ~90 บรรทัด

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add project-specific AGENTS.md for Codex"
```

---

### Task 2: Create .codex/setup.sh

**Files:**
- Create: `.codex/setup.sh`

- [ ] **Step 1: Create .codex directory and setup.sh**

```bash
mkdir -p .codex
```

Create `/Volumes/Maythane/My-Project/My-bike/.codex/setup.sh` with this exact content:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Install Python venv if missing
if [ ! -f "backend/.venv/bin/activate" ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q -r backend/requirements.txt
fi

source backend/.venv/bin/activate
export DB_PATH="$(pwd)/data/moto.db"

# Install frontend deps if missing
if [ ! -d "frontend/node_modules" ]; then
  (cd frontend && npm install --silent)
fi

echo "My-bike ready — DB=$DB_PATH"
```

- [ ] **Step 2: Make setup.sh executable**

```bash
chmod +x .codex/setup.sh
```

- [ ] **Step 3: Verify setup.sh runs without errors**

```bash
bash .codex/setup.sh
```

Expected output:
```
My-bike ready — DB=/Volumes/Maythane/My-Project/My-bike/data/moto.db
```

- [ ] **Step 4: Commit**

```bash
git add .codex/setup.sh
git commit -m "chore: add .codex/setup.sh for Codex CLI environment"
```

---

### Task 3: Add docs to gitignore check

**Files:**
- Read: `.gitignore`

- [ ] **Step 1: Check .gitignore doesn't exclude .codex or AGENTS.md**

```bash
grep -E "\.codex|AGENTS" .gitignore || echo "not excluded — OK"
```

Expected: `not excluded — OK` (ถ้ามี pattern อยู่ ต้องลบออก)

- [ ] **Step 2: Verify both files are tracked by git**

```bash
git status
```

Expected: ไม่มีไฟล์ค้างอยู่ใน untracked/modified หลังจาก commit ทั้งสองแล้ว
