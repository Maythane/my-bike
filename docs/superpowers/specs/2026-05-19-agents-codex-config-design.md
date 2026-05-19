# Design: AGENTS.md + .codex/setup.sh for My-bike

**Date:** 2026-05-19
**Scope:** Project-specific Codex configuration for My-bike (FastAPI + React/TS)

---

## Goal

ให้ Codex (OpenAI Codex CLI) ทำงานใน My-bike ได้ทันทีโดยไม่ต้องสำรวจ codebase เอง — AGENTS.md เป็น single source of truth สำหรับ project context, .codex/setup.sh เตรียม environment ก่อน Codex เริ่ม thread

## Files to Create

```
My-bike/
├── AGENTS.md
└── .codex/
    └── setup.sh
```

## How Codex Reads These Files

- **AGENTS.md**: Codex concatenates AGENTS.md from Git root → working directory (`My-Project/AGENTS.md` → `My-bike/AGENTS.md`). My-bike/AGENTS.md ต้องเป็น project-specific เท่านั้น ไม่ซ้ำ shared conventions
- **setup.sh**: รันอัตโนมัติเมื่อ Codex สร้าง worktree ใหม่ต้นแต่ละ thread

---

## AGENTS.md Content Design

### Sections (ลำดับ)

1. **Header** — project name, port, DB path
2. **Stack** — backend + frontend summary พร้อม run commands
3. **Backend Structure** — routers ทั้ง 9 ตัว
4. **Frontend Structure** — pages (พร้อมขนาดไฟล์), components, hooks, types
5. **Data Model** — relationship tree แบบย่อ
6. **Code Style** — Python + TypeScript rules
7. **Rules** — hard constraints (❌) และ warnings (⚠️)

### Key Content

```markdown
# My-bike — Moto Tracker

**Port:** 8764 | **DB:** `data/moto.db` (SQLite)

## Stack
- Backend: Python 3.9+, FastAPI, SQLModel, SQLite
  - venv: `backend/.venv/`
  - Entry: `server.py` → `os.execve` uvicorn (ไม่ใช้ subprocess)
  - Run: `cd backend && DB_PATH=../data/moto.db .venv/bin/uvicorn app.main:app --port 8764`
- Frontend: React 19, TypeScript, Vite, TanStack Query
  - Dev: `cd frontend && npm run dev`
  - Build: `npm run build` → copy `dist/` → `backend/static/`

## Backend Structure
backend/app/
  main.py, models.py, database.py, utils.py, seed.py
  routers/: profiles, motorcycles, tasks, logs,
            settings, templates, fuel, shock, shock_presets

## Frontend Structure
frontend/src/
  api/: client.ts, profiles.ts, motorcycles.ts, tasks.ts,
        logs.ts, fuel.ts, shock.ts, shock_presets.ts, templates.ts
  pages/: GaragePage.tsx, BikePage.tsx (~27KB), ShockSettingsPage.tsx (~34KB)
  components/: bikes/, logs/, profiles/, tasks/, layout/, ui/
  hooks/: useAnimatedClose, useConfirm, useGeoLocation, useSwipeReveal, useTheme
  types/index.ts  ← interfaces ทั้งหมด (Motorcycle, FuelLog, TaskWithStatus ฯลฯ)
  data/bikeSpecs.ts

## Data Model (ย่อ)
Profile → Motorcycle → MaintenanceTask → MaintenanceLog
Motorcycle → FuelLog
ShockSetting / ShockPreset / TaskTemplate (standalone)

## Code Style
- Python: type hints ทุก function, ภาษาไทยใน comment ได้
- Pydantic schemas แยกจาก SQLModel table models
- Error: raise HTTPException เท่านั้น, ห้าม print()
- TS: camelCase vars/functions, PascalCase components/types

## Rules
- ❌ ห้ามใช้ subprocess ใน server.py (ใช้ os.execve)
- ❌ ห้ามใช้ Alembic (SQLModel.metadata.create_all() พอ)
- ❌ ห้ามใช้ PostgreSQL
- ❌ ห้ามเพิ่ม library ใหม่โดยไม่แจ้ง
- ❌ ห้ามสร้าง .env
- ❌ ห้ามเพิ่ม test ถ้าไม่ถูกขอ
- ⚠️ ไฟล์ >500 บรรทัด → ระบุ line range ที่แก้ ไม่ต้องอ่านทั้งไฟล์
- ⚠️ 1 task = 1 feature เท่านั้น
```

---

## .codex/setup.sh Content Design

```bash
#!/usr/bin/env bash
set -euo pipefail

# Install Python deps if venv missing
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

**หมายเหตุ:** working directory เมื่อ setup.sh รันคือ project root (`My-bike/`) เสมอ

---

## Constraints

- AGENTS.md ต้องอัปเดตเมื่อเพิ่ม router หรือ page ใหม่
- setup.sh ต้องอัปเดตถ้า dependency manager เปลี่ยน (เช่น จาก npm เป็น pnpm)
- ห้ามใส่ secret หรือ path ที่ machine-specific ใน setup.sh — ใช้ relative path เท่านั้น
