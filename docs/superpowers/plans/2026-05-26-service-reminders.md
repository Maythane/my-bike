# Service Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users configure per-bike mileage-based reminders for 5 service items (engine oil, gear oil, spark plug, air filter, oil filter), see their status on the bike page, and mark each as done.

**Architecture:** A new `service_reminders` table stores per-bike reminder configs (interval, last-done mileage, enabled flag). A new FastAPI router computes live status by comparing `last_done_mileage + interval_km` against `current_mileage`. The frontend shows a compact alert bar on BikePage and a full settings+status page at `/bikes/:id/reminders`.

**Tech Stack:** FastAPI + SQLModel (Python), SQLite, React + TanStack Query (TypeScript), existing inline-style + CSS-class pattern.

---

## File Map

**Create:**
- `backend/app/routers/reminders.py` — GET list (with status), PUT bulk update, POST mark-done
- `frontend/src/api/reminders.ts` — API calls
- `frontend/src/components/reminders/ReminderAlertBar.tsx` — compact alert strip for BikePage
- `frontend/src/pages/ServiceRemindersPage.tsx` — full reminders config + status page

**Modify:**
- `backend/app/models.py` — add `ServiceReminder` SQLModel table
- `backend/app/database.py` — add `_migrate_reminders()` call in `create_db()`
- `backend/app/main.py` — include reminders router
- `frontend/src/types/index.ts` — add `ServiceReminder` type
- `frontend/src/pages/BikePage.tsx` — add `ReminderAlertBar` + link
- `frontend/src/App.tsx` — add route `/bikes/:bikeId/reminders`
- `frontend/src/index.css` — reminder styles

---

## Task 1: Backend Model + Migration

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/database.py`

- [ ] **Step 1: Add `ServiceReminder` model to `models.py`**

Open `backend/app/models.py` and append at the bottom:

```python
class ServiceReminder(SQLModel, table=True):
    __tablename__ = "service_reminders"
    id: Optional[int] = Field(default=None, primary_key=True)
    motorcycle_id: int = Field(foreign_key="motorcycles.id", index=True)
    item_key: str        # "engine_oil" | "gear_oil" | "spark_plug" | "air_filter" | "oil_filter"
    item_name: str
    interval_km: int = Field(default=3000)
    last_done_mileage: Optional[int] = Field(default=None)
    enabled: bool = Field(default=True)
```

- [ ] **Step 2: Add migration function to `database.py`**

In `backend/app/database.py`, after the `_migrate_shock_charts` function, add:

```python
DEFAULT_REMINDER_ITEMS = [
    ("engine_oil",  "น้ำมันเครื่อง",         3000),
    ("gear_oil",    "น้ำมันเฟืองท้าย",       6000),
    ("spark_plug",  "หัวเทียน",               8000),
    ("air_filter",  "ไส้กรองอากาศ",          8000),
    ("oil_filter",  "ไส้กรองน้ำมันเครื่อง", 6000),
]


def _migrate_reminders():
    """Create service_reminders table (idempotent)."""
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS service_reminders (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                motorcycle_id INTEGER NOT NULL REFERENCES motorcycles(id),
                item_key      TEXT NOT NULL,
                item_name     TEXT NOT NULL,
                interval_km   INTEGER NOT NULL DEFAULT 3000,
                last_done_mileage INTEGER,
                enabled       INTEGER NOT NULL DEFAULT 1,
                UNIQUE(motorcycle_id, item_key)
            )
        """))
        conn.commit()
```

- [ ] **Step 3: Call `_migrate_reminders()` in `create_db()`**

In `backend/app/database.py`, find the `create_db()` function and add the call:

```python
def create_db():
    SQLModel.metadata.create_all(engine)
    _migrate()
    _migrate_shock_per_bike()
    _migrate_shock_charts()
    _migrate_images()
    _migrate_reminders()   # ← add this line
```

- [ ] **Step 4: Verify migration runs without error**

```bash
cd /Users/mark/My-Project/My-bike/backend
DB_PATH=/Users/mark/My-Project/My-bike/data/moto.db .venv/bin/python3 -c "
from app.database import _migrate_reminders
_migrate_reminders()
from sqlalchemy import text, create_engine
import os
engine = create_engine('sqlite:///' + os.environ['DB_PATH'])
with engine.connect() as c:
    cols = [r[1] for r in c.execute(text('PRAGMA table_info(service_reminders)')).fetchall()]
    print('columns:', cols)
"
```

Expected output:
```
columns: ['id', 'motorcycle_id', 'item_key', 'item_name', 'interval_km', 'last_done_mileage', 'enabled']
```

- [ ] **Step 5: Commit**

```bash
cd /Users/mark/My-Project/My-bike
git add backend/app/models.py backend/app/database.py
git commit -m "feat: add ServiceReminder model and DB migration"
```

---

## Task 2: Backend Router

**Files:**
- Create: `backend/app/routers/reminders.py`

- [ ] **Step 1: Create `reminders.py` router**

Create `backend/app/routers/reminders.py` with this complete content:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy import text
from typing import Optional, List
from pydantic import BaseModel

from app.database import get_session, DEFAULT_REMINDER_ITEMS
from app.models import ServiceReminder, User, Motorcycle
from app.auth import get_current_user
from app.utils import get_motorcycle_for_user

router = APIRouter(tags=["reminders"])

WARN_KM = 500  # show "due soon" when ≤ 500 km remaining


class ReminderRead(BaseModel):
    id: int
    item_key: str
    item_name: str
    interval_km: int
    last_done_mileage: Optional[int]
    enabled: bool
    status: str        # "ok" | "due_soon" | "overdue" | "never"
    km_remaining: Optional[int]


class ReminderUpdate(BaseModel):
    item_key: str
    interval_km: int
    enabled: bool


def _compute_status(last_done: Optional[int], interval: int, current: int) -> tuple[str, Optional[int]]:
    if last_done is None:
        return "never", None
    remaining = (last_done + interval) - current
    if remaining <= 0:
        return "overdue", remaining
    if remaining <= WARN_KM:
        return "due_soon", remaining
    return "ok", remaining


def _ensure_reminders(bike_id: int, session: Session) -> None:
    """Auto-create default reminder rows for a bike if they don't exist yet."""
    for key, name, interval in DEFAULT_REMINDER_ITEMS:
        existing = session.exec(
            select(ServiceReminder)
            .where(ServiceReminder.motorcycle_id == bike_id)
            .where(ServiceReminder.item_key == key)
        ).first()
        if not existing:
            session.add(ServiceReminder(
                motorcycle_id=bike_id,
                item_key=key,
                item_name=name,
                interval_km=interval,
            ))
    session.commit()


@router.get("/api/motorcycles/{bike_id}/service-reminders", response_model=List[ReminderRead])
def get_reminders(
    bike_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    bike = get_motorcycle_for_user(bike_id, current_user, session)
    _ensure_reminders(bike_id, session)
    reminders = session.exec(
        select(ServiceReminder).where(ServiceReminder.motorcycle_id == bike_id)
    ).all()
    # Return in canonical order
    order = [k for k, _, _ in DEFAULT_REMINDER_ITEMS]
    reminders_sorted = sorted(reminders, key=lambda r: order.index(r.item_key) if r.item_key in order else 99)
    result = []
    for r in reminders_sorted:
        status, km_remaining = _compute_status(r.last_done_mileage, r.interval_km, bike.current_mileage)
        result.append(ReminderRead(
            id=r.id,
            item_key=r.item_key,
            item_name=r.item_name,
            interval_km=r.interval_km,
            last_done_mileage=r.last_done_mileage,
            enabled=r.enabled,
            status=status,
            km_remaining=km_remaining,
        ))
    return result


@router.put("/api/motorcycles/{bike_id}/service-reminders", response_model=List[ReminderRead])
def update_reminders(
    bike_id: int,
    updates: List[ReminderUpdate],
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    bike = get_motorcycle_for_user(bike_id, current_user, session)
    _ensure_reminders(bike_id, session)
    for upd in updates:
        reminder = session.exec(
            select(ServiceReminder)
            .where(ServiceReminder.motorcycle_id == bike_id)
            .where(ServiceReminder.item_key == upd.item_key)
        ).first()
        if not reminder:
            raise HTTPException(status_code=404, detail=f"Reminder {upd.item_key} not found")
        reminder.interval_km = upd.interval_km
        reminder.enabled = upd.enabled
        session.add(reminder)
    session.commit()
    # Return updated list (reuse GET logic)
    return get_reminders(bike_id, session, current_user)


@router.post("/api/motorcycles/{bike_id}/service-reminders/{item_key}/done", response_model=ReminderRead)
def mark_done(
    bike_id: int,
    item_key: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    bike = get_motorcycle_for_user(bike_id, current_user, session)
    reminder = session.exec(
        select(ServiceReminder)
        .where(ServiceReminder.motorcycle_id == bike_id)
        .where(ServiceReminder.item_key == item_key)
    ).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    reminder.last_done_mileage = bike.current_mileage
    session.add(reminder)
    session.commit()
    session.refresh(reminder)
    status, km_remaining = _compute_status(reminder.last_done_mileage, reminder.interval_km, bike.current_mileage)
    return ReminderRead(
        id=reminder.id,
        item_key=reminder.item_key,
        item_name=reminder.item_name,
        interval_km=reminder.interval_km,
        last_done_mileage=reminder.last_done_mileage,
        enabled=reminder.enabled,
        status=status,
        km_remaining=km_remaining,
    )
```

- [ ] **Step 2: Verify the file has no syntax errors**

```bash
cd /Users/mark/My-Project/My-bike/backend
.venv/bin/python3 -c "from app.routers.reminders import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/reminders.py
git commit -m "feat: add service reminders router (GET / PUT / POST done)"
```

---

## Task 3: Wire Router into main.py

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Import and include the reminders router**

In `backend/app/main.py`, add the import on the existing router import line:

```python
# Change this line:
from app.routers import profiles, motorcycles, tasks, logs, settings, templates, fuel, shock, shock_presets, auth, shock_brands

# To:
from app.routers import profiles, motorcycles, tasks, logs, settings, templates, fuel, shock, shock_presets, auth, shock_brands, reminders
```

Then add the include after the other `app.include_router(...)` calls:

```python
app.include_router(reminders.router)
```

- [ ] **Step 2: Verify server starts**

```bash
cd /Users/mark/My-Project/My-bike/backend
DB_PATH=/Users/mark/My-Project/My-bike/data/moto.db AUTH_SECRET_KEY=dev .venv/bin/python3 -c "
from app.main import app
print('routes:', [r.path for r in app.routes if hasattr(r, 'path') and 'reminder' in r.path])
"
```

Expected output includes:
```
routes: ['/api/motorcycles/{bike_id}/service-reminders', '/api/motorcycles/{bike_id}/service-reminders', '/api/motorcycles/{bike_id}/service-reminders/{item_key}/done']
```

- [ ] **Step 3: Test reminder logic end-to-end with Python**

```bash
cd /Users/mark/My-Project/My-bike/backend
DB_PATH=/Users/mark/My-Project/My-bike/data/moto.db .venv/bin/python3 -c "
import os; os.environ['DB_PATH'] = '/Users/mark/My-Project/My-bike/data/moto.db'
from app.database import engine, _migrate_reminders
from app.routers.reminders import _ensure_reminders, _compute_status
from sqlmodel import Session

_migrate_reminders()
with Session(engine) as s:
    _ensure_reminders(1, s)
    from app.models import ServiceReminder
    from sqlmodel import select
    rows = s.exec(select(ServiceReminder).where(ServiceReminder.motorcycle_id == 1)).all()
    print(f'Created {len(rows)} reminders for bike 1')
    for r in rows:
        print(f'  {r.item_key}: interval={r.interval_km}, last_done={r.last_done_mileage}')

print('Status tests:')
print('  never done:', _compute_status(None, 3000, 5000))
print('  ok (2000 done, interval 3000, now 4500):', _compute_status(2000, 3000, 4500))
print('  due_soon (2000 done, interval 3000, now 4600):', _compute_status(2000, 3000, 4600))
print('  overdue (2000 done, interval 3000, now 5001):', _compute_status(2000, 3000, 5001))
"
```

Expected:
```
Created 5 reminders for bike 1
  engine_oil: interval=3000, last_done=None
  gear_oil: interval=6000, last_done=None
  spark_plug: interval=8000, last_done=None
  air_filter: interval=8000, last_done=None
  oil_filter: interval=6000, last_done=None
Status tests:
  never done: ('never', None)
  ok (2000 done, interval 3000, now 4500): ('ok', 500)
  due_soon (2000 done, interval 3000, now 4600): ('due_soon', 400)
  overdue (2000 done, interval 3000, now 5001): ('overdue', -1)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: wire reminders router into FastAPI app"
```

---

## Task 4: Frontend Types + API

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/api/reminders.ts`

- [ ] **Step 1: Add `ServiceReminder` type to `types/index.ts`**

Open `frontend/src/types/index.ts` and append at the bottom:

```typescript
export type ReminderStatus = "ok" | "due_soon" | "overdue" | "never";

export interface ServiceReminder {
  id: number;
  item_key: string;
  item_name: string;
  interval_km: number;
  last_done_mileage: number | null;
  enabled: boolean;
  status: ReminderStatus;
  km_remaining: number | null;
}
```

- [ ] **Step 2: Create `frontend/src/api/reminders.ts`**

```typescript
import client from "./client";
import type { ServiceReminder } from "../types";

export const getReminders = (bikeId: number) =>
  client.get<ServiceReminder[]>(`/api/motorcycles/${bikeId}/service-reminders`).then((r) => r.data);

export const updateReminders = (
  bikeId: number,
  updates: { item_key: string; interval_km: number; enabled: boolean }[],
) =>
  client.put<ServiceReminder[]>(`/api/motorcycles/${bikeId}/service-reminders`, updates).then((r) => r.data);

export const markReminderDone = (bikeId: number, itemKey: string) =>
  client.post<ServiceReminder>(`/api/motorcycles/${bikeId}/service-reminders/${itemKey}/done`).then((r) => r.data);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/mark/My-Project/My-bike/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (no errors).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/reminders.ts
git commit -m "feat: add ServiceReminder type and API client"
```

---

## Task 5: ServiceRemindersPage

**Files:**
- Create: `frontend/src/pages/ServiceRemindersPage.tsx`
- Modify: `frontend/src/index.css`

This page has two modes: **status view** (default) and **edit mode** (toggle to adjust intervals + enable/disable). Both are on the same page.

- [ ] **Step 1: Create `ServiceRemindersPage.tsx`**

```typescript
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getReminders, updateReminders, markReminderDone } from "../api/reminders";
import { getMotorcycle } from "../api/motorcycles";
import type { ServiceReminder } from "../types";

const STATUS_COLOR: Record<string, string> = {
  ok:       "var(--green)",
  due_soon: "#f59e0b",
  overdue:  "var(--red)",
  never:    "var(--steel)",
};

const STATUS_LABEL: Record<string, string> = {
  ok:       "ปกติ",
  due_soon: "ใกล้ถึงรอบ",
  overdue:  "เกินกำหนด",
  never:    "ยังไม่เคยบันทึก",
};

export default function ServiceRemindersPage() {
  const { bikeId } = useParams<{ bikeId: string }>();
  const id = Number(bikeId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { interval_km: number; enabled: boolean }>>({});

  const { data: bike } = useQuery({ queryKey: ["motorcycle", id], queryFn: () => getMotorcycle(id) });
  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ["reminders", id],
    queryFn: () => getReminders(id),
  });

  const saveMut = useMutation({
    mutationFn: () =>
      updateReminders(id, reminders.map((r) => ({
        item_key: r.item_key,
        interval_km: drafts[r.item_key]?.interval_km ?? r.interval_km,
        enabled: drafts[r.item_key]?.enabled ?? r.enabled,
      }))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders", id] });
      setEditMode(false);
      setDrafts({});
    },
  });

  const doneMut = useMutation({
    mutationFn: (itemKey: string) => markReminderDone(id, itemKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders", id] }),
  });

  function enterEdit() {
    const d: Record<string, { interval_km: number; enabled: boolean }> = {};
    reminders.forEach((r) => { d[r.item_key] = { interval_km: r.interval_km, enabled: r.enabled }; });
    setDrafts(d);
    setEditMode(true);
  }

  function cancelEdit() {
    setDrafts({});
    setEditMode(false);
  }

  const bikeName = bike ? (bike.nickname ?? `${bike.make} ${bike.model}`) : "…";

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => {
          document.documentElement.dataset.navDir = "back";
          setTimeout(() => { delete document.documentElement.dataset.navDir; }, 500);
          navigate(`/bikes/${id}`, { viewTransition: true });
        }}>← กลับ</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: 0 }}>รอบซ่อมบำรุง</h1>
          <p style={{ fontSize: 13, color: "var(--slate)", margin: "2px 0 0" }}>{bikeName}</p>
        </div>
        {!editMode ? (
          <button className="btn btn-sm" style={{ color: "var(--purple)", borderColor: "var(--purple-border)", background: "var(--purple-bg)" }}
            onClick={enterEdit}>ตั้งค่า</button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm" style={{ color: "var(--steel)" }} onClick={cancelEdit}>ยกเลิก</button>
            <button className="btn btn-primary btn-sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
        )}
      </div>

      {/* Mileage context */}
      {bike && (
        <div style={{ fontSize: 13, color: "var(--slate)", marginBottom: 16 }}>
          เลขไมล์ปัจจุบัน: <strong style={{ color: "var(--ink)" }}>{bike.current_mileage.toLocaleString()} กม.</strong>
        </div>
      )}

      {isLoading && <p style={{ color: "var(--slate)", fontSize: 14 }}>กำลังโหลด…</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {reminders.map((r) => {
          const draft = drafts[r.item_key];
          const displayEnabled = draft ? draft.enabled : r.enabled;
          const displayInterval = draft ? draft.interval_km : r.interval_km;
          const statusColor = STATUS_COLOR[r.status];

          return (
            <div key={r.item_key} className="reminder-card" style={{ opacity: displayEnabled ? 1 : 0.5 }}>
              {/* Top row: status dot + name + badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", flex: 1 }}>{r.item_name}</span>
                <span className="reminder-badge" style={{ background: `${statusColor}22`, color: statusColor }}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>

              {/* Progress bar */}
              {r.last_done_mileage !== null && (
                <div className="reminder-bar-wrap">
                  <div className="reminder-bar-fill" style={{
                    width: `${Math.min(100, Math.max(0, ((r.interval_km - (r.km_remaining ?? 0)) / r.interval_km) * 100))}%`,
                    background: statusColor,
                  }} />
                </div>
              )}

              {/* Detail row */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--slate)" }}>
                <span>
                  {r.last_done_mileage !== null
                    ? `ครั้งล่าสุด: ${r.last_done_mileage.toLocaleString()} กม.`
                    : "ยังไม่เคยบันทึก"}
                </span>
                <span>
                  {r.km_remaining !== null
                    ? r.km_remaining <= 0
                      ? `เกิน ${Math.abs(r.km_remaining).toLocaleString()} กม.`
                      : `อีก ${r.km_remaining.toLocaleString()} กม.`
                    : `ทุก ${r.interval_km.toLocaleString()} กม.`}
                </span>
              </div>

              {/* Edit mode controls */}
              {editMode && (
                <div className="reminder-edit-row">
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate)" }}>
                    <input type="checkbox" checked={displayEnabled}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.item_key]: { ...d[r.item_key], enabled: e.target.checked } }))} />
                    เปิดใช้งาน
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate)" }}>
                    ทุก
                    <input
                      type="number"
                      className="reminder-interval-input"
                      value={displayInterval}
                      min={100}
                      max={99999}
                      step={100}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.item_key]: { ...d[r.item_key], interval_km: Number(e.target.value) } }))}
                    />
                    กม.
                  </label>
                </div>
              )}

              {/* Mark done button (view mode, enabled items only) */}
              {!editMode && displayEnabled && (
                <button
                  className="btn btn-sm"
                  style={{ width: "100%", marginTop: 4, color: "var(--slate)", borderColor: "var(--hairline)" }}
                  disabled={doneMut.isPending}
                  onClick={() => doneMut.mutate(r.item_key)}
                >
                  บันทึกการเปลี่ยน / ซ่อม
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add reminder CSS to `index.css`**

Append at the end of `frontend/src/index.css`:

```css
/* ─── Service Reminders ─────────────────────────────────────────── */
.reminder-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-md);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: opacity 0.2s;
}
.reminder-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;
  flex-shrink: 0;
}
.reminder-bar-wrap {
  height: 4px;
  background: var(--hairline);
  border-radius: 99px;
  overflow: hidden;
}
.reminder-bar-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.4s var(--jelly-ease);
}
.reminder-edit-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 4px;
  border-top: 1px solid var(--hairline);
  flex-wrap: wrap;
  gap: 8px;
}
.reminder-interval-input {
  width: 70px;
  padding: 4px 8px;
  border-radius: var(--r);
  border: 1px solid var(--glass-border);
  background: var(--surface);
  color: var(--ink);
  font-size: 13px;
  text-align: center;
}
.reminder-interval-input:focus {
  outline: none;
  border-color: var(--purple-border);
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mark/My-Project/My-bike
git add frontend/src/pages/ServiceRemindersPage.tsx frontend/src/index.css
git commit -m "feat: add ServiceRemindersPage with status + edit mode"
```

---

## Task 6: ReminderAlertBar Component + BikePage Integration

**Files:**
- Create: `frontend/src/components/reminders/ReminderAlertBar.tsx`
- Modify: `frontend/src/pages/BikePage.tsx`

The alert bar shows on BikePage when there are overdue or due_soon **enabled** reminders. Tapping it navigates to the reminders page.

- [ ] **Step 1: Create `ReminderAlertBar.tsx`**

```typescript
import { useNavigate } from "react-router-dom";
import type { ServiceReminder } from "../../types";

export default function ReminderAlertBar({ bikeId, reminders }: {
  bikeId: number;
  reminders: ServiceReminder[];
}) {
  const navigate = useNavigate();
  const urgent = reminders.filter((r) => r.enabled && (r.status === "overdue" || r.status === "due_soon"));
  if (urgent.length === 0) return null;

  const overdueCount  = urgent.filter((r) => r.status === "overdue").length;
  const dueSoonCount  = urgent.filter((r) => r.status === "due_soon").length;

  const parts: string[] = [];
  if (overdueCount > 0)  parts.push(`${overdueCount} รายการเกินกำหนด`);
  if (dueSoonCount > 0)  parts.push(`${dueSoonCount} รายการใกล้ถึงรอบ`);

  const isOverdue = overdueCount > 0;

  return (
    <button
      className="reminder-alert-bar"
      style={{ borderColor: isOverdue ? "rgba(255,90,90,0.35)" : "rgba(245,158,11,0.35)",
               background: isOverdue ? "rgba(255,90,90,0.08)" : "rgba(245,158,11,0.08)" }}
      onClick={() => navigate(`/bikes/${bikeId}/reminders`, { viewTransition: true })}
    >
      <span style={{ fontSize: 16 }}>{isOverdue ? "⚠️" : "🔔"}</span>
      <span style={{ fontSize: 13, color: isOverdue ? "var(--red)" : "#f59e0b", fontWeight: 500 }}>
        {parts.join(" · ")}
      </span>
      <span style={{ fontSize: 12, color: "var(--slate)", marginLeft: "auto" }}>ดูรายละเอียด →</span>
    </button>
  );
}
```

- [ ] **Step 2: Add `.reminder-alert-bar` CSS to `index.css`**

Append inside the `/* ─── Service Reminders ─────── */` section added in Task 5:

```css
.reminder-alert-bar {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--r-md);
  border: 1px solid;
  background: none;
  cursor: pointer;
  text-align: left;
  margin-bottom: 12px;
  transition: opacity 0.15s;
}
.reminder-alert-bar:hover { opacity: 0.85; }
```

- [ ] **Step 3: Add `ReminderAlertBar` to `BikePage.tsx`**

In `frontend/src/pages/BikePage.tsx`:

Add import at the top (after other imports):
```typescript
import { getReminders } from "../api/reminders";
import ReminderAlertBar from "../components/reminders/ReminderAlertBar";
```

Add query after the existing `economy` query:
```typescript
const { data: reminders = [] } = useQuery({
  queryKey: ["reminders", bid],
  queryFn: () => getReminders(bid),
  enabled: !!bid,
});
```

Add `<ReminderAlertBar>` in the JSX, just before the tab section (find the tab row and insert before it):
```tsx
{/* Reminder alert bar */}
<ReminderAlertBar bikeId={bid} reminders={reminders} />
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/mark/My-Project/My-bike/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/reminders/ReminderAlertBar.tsx \
        frontend/src/pages/BikePage.tsx \
        frontend/src/index.css
git commit -m "feat: add ReminderAlertBar on BikePage"
```

---

## Task 7: Route + Deploy

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add route in `App.tsx`**

Add the import:
```typescript
import ServiceRemindersPage from "./pages/ServiceRemindersPage";
```

Add the route inside the protected `<Routes>`, after the existing `/settings/bikes/:bikeId/shock` route:
```tsx
<Route path="/bikes/:bikeId/reminders" element={<ServiceRemindersPage />} />
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
cd /Users/mark/My-Project/My-bike/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Build and deploy**

```bash
cd /Users/mark/My-Project/My-bike/frontend
npm run deploy
```

Expected: `✓ built in ~250ms` with no errors.

- [ ] **Step 4: Restart backend and smoke-test**

After restarting backend, test the following in the browser:

1. Open any bike page → should see the reminder alert bar (all items show "never" status → no bar shown yet)
2. Navigate to `/bikes/1/reminders` directly or via the bar after manually calling mark-done via Python below
3. Tap "ตั้งค่า" → intervals become editable, checkboxes appear → change oil interval to 1000 → tap "บันทึก" → intervals update
4. Tap "บันทึกการเปลี่ยน / ซ่อม" on engine oil → status changes to "ok"
5. Manually set `last_done_mileage` to a low value in DB to trigger overdue → alert bar appears on BikePage

To trigger overdue for testing:
```bash
cd /Users/mark/My-Project/My-bike/backend
DB_PATH=/Users/mark/My-Project/My-bike/data/moto.db .venv/bin/python3 -c "
import os; os.environ['DB_PATH'] = '/Users/mark/My-Project/My-bike/data/moto.db'
from app.database import engine
from sqlalchemy import text
with engine.begin() as conn:
    conn.execute(text(\"UPDATE service_reminders SET last_done_mileage = 1000 WHERE motorcycle_id = 1 AND item_key = 'engine_oil'\"))
    print('Set engine_oil last_done=1000 → should be overdue at current mileage')
"
```

- [ ] **Step 5: Final commit**

```bash
cd /Users/mark/My-Project/My-bike
git add frontend/src/App.tsx
git commit -m "feat: add /bikes/:bikeId/reminders route — service reminders complete"
```
