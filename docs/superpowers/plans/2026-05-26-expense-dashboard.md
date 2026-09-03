# Expense Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full expense tracking dashboard combining fuel costs, maintenance costs, and new custom expenses (insurance, registration, parts, etc.) with monthly/yearly charts and per-bike filtering.

**Architecture:** New `expenses` SQLite table stores custom expenses; a new FastAPI router aggregates all three cost sources into a summary endpoint. The frontend has a global `/expenses` dashboard page plus a compact BikePage card; both can open an `ExpenseModal` to add custom expenses.

**Tech Stack:** FastAPI + SQLModel + SQLAlchemy raw SQL (SQLite), React + TanStack Query (`useQueries` for multi-bike aggregation), pure-CSS stacked bar charts.

---

## File Map

**Create:**
- `backend/app/routers/expenses.py` — CRUD + summary aggregate endpoint
- `frontend/src/api/expenses.ts` — API calls
- `frontend/src/components/expenses/ExpenseCategoryBreakdown.tsx` — progress-bar breakdown
- `frontend/src/components/expenses/ExpenseTrendChart.tsx` — stacked bar chart
- `frontend/src/components/expenses/ExpenseModal.tsx` — add/edit modal
- `frontend/src/pages/ExpenseDashboardPage.tsx` — global dashboard

**Modify:**
- `backend/app/models.py` — add `Expense` model
- `backend/app/database.py` — add `_migrate_expenses()` + call in `create_db()`
- `backend/app/main.py` — include expenses router
- `frontend/src/types/index.ts` — add expense types
- `frontend/src/pages/BikePage.tsx` — add expense card
- `frontend/src/App.tsx` — add route + nav link
- `frontend/src/index.css` — add expense styles

---

## Task 1: Backend Model + Migration

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/database.py`

- [ ] **Step 1: Add `Expense` model to `models.py`**

Open `backend/app/models.py`. At the bottom, after `ServiceReminder`, append:

```python
class Expense(SQLModel, table=True):
    __tablename__ = "expenses"
    id: Optional[int] = Field(default=None, primary_key=True)
    motorcycle_id: int = Field(foreign_key="motorcycles.id", index=True)
    category: str
    amount: float
    date: date
    notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 2: Add `_migrate_expenses()` to `database.py`**

In `backend/app/database.py`, after the `_migrate_reminders` function, add:

```python
def _migrate_expenses():
    """Create expenses table (idempotent)."""
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS expenses (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                motorcycle_id INTEGER NOT NULL REFERENCES motorcycles(id) ON DELETE CASCADE,
                category      TEXT NOT NULL,
                amount        REAL NOT NULL,
                date          DATE NOT NULL,
                notes         TEXT,
                created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.commit()
```

- [ ] **Step 3: Call `_migrate_expenses()` in `create_db()`**

Find `create_db()` and add the call at the end:

```python
def create_db():
    SQLModel.metadata.create_all(engine)
    _migrate()
    _migrate_shock_per_bike()
    _migrate_shock_charts()
    _migrate_images()
    _migrate_reminders()
    _migrate_expenses()   # ← add this
```

- [ ] **Step 4: Verify migration**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike/backend
DB_PATH=/Users/mark/my-work-space/My-Project/My-bike/data/moto.db AUTH_SECRET_KEY=dev \
  .venv/bin/python3 -c "
from app.database import _migrate_expenses
_migrate_expenses()
from sqlalchemy import text, create_engine
import os
e = create_engine('sqlite:///' + os.environ['DB_PATH'])
with e.connect() as c:
    cols = [r[1] for r in c.execute(text('PRAGMA table_info(expenses)')).fetchall()]
    print('columns:', cols)
"
```

Expected:
```
columns: ['id', 'motorcycle_id', 'category', 'amount', 'date', 'notes', 'created_at']
```

- [ ] **Step 5: Commit**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike
git add backend/app/models.py backend/app/database.py
git commit -m "feat: add Expense model and DB migration"
```

---

## Task 2: Backend Expenses Router

**Files:**
- Create: `backend/app/routers/expenses.py`

- [ ] **Step 1: Create `expenses.py`**

Create `backend/app/routers/expenses.py` with this complete content:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy import text
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, date as date_cls
from calendar import monthrange

from app.database import get_session
from app.models import Expense, User
from app.auth import get_current_user
from app.utils import get_motorcycle_for_user

router = APIRouter(tags=["expenses"])

PRESET_CATEGORIES: dict[str, tuple[str, str]] = {
    "fuel":         ("น้ำมัน",     "⛽"),
    "maintenance":  ("ซ่อมบำรุง",  "🔧"),
    "insurance":    ("ประกันภัย",  "🛡️"),
    "registration": ("ต่อทะเบียน", "📋"),
    "parts":        ("อะไหล่",     "⚙️"),
    "parking":      ("ค่าจอด",     "🅿️"),
    "other":        ("อื่นๆ",      "📌"),
}


class ExpenseRead(BaseModel):
    id: int
    category: str
    amount: float
    date: str
    notes: Optional[str]


class ExpenseCreate(BaseModel):
    category: str
    amount: float
    date: str  # "YYYY-MM-DD"
    notes: Optional[str] = None


class ExpenseUpdate(BaseModel):
    category: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None
    notes: Optional[str] = None


class CategoryTotal(BaseModel):
    category: str
    label: str
    icon: str
    amount: float
    percent: float


class MonthBucket(BaseModel):
    month: str   # "YYYY-MM"
    fuel: float
    maintenance: float
    other: float


class ExpenseSummary(BaseModel):
    total: float
    cost_per_km: Optional[float]
    by_category: List[CategoryTotal]
    monthly_trend: List[MonthBucket]


def _months_ending_at(year: int, month: int, n: int = 6) -> list[tuple[int, int]]:
    """Return n (year, month) pairs ending at (year, month), oldest first."""
    result = []
    y, m = year, month
    for _ in range(n):
        result.append((y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return list(reversed(result))


def _fuel_total(session: Session, bike_id: int, y: str, m: Optional[str]) -> float:
    q = ("SELECT COALESCE(SUM(cost), 0) FROM fuel_logs "
         "WHERE motorcycle_id = :bid AND cost IS NOT NULL AND strftime('%Y', date) = :y")
    p: dict = {"bid": bike_id, "y": y}
    if m:
        q += " AND strftime('%m', date) = :m"
        p["m"] = m
    return session.execute(text(q), p).scalar() or 0.0


def _maint_total(session: Session, bike_id: int, y: str, m: Optional[str]) -> float:
    q = ("SELECT COALESCE(SUM(ml.cost), 0) FROM maintenance_logs ml "
         "JOIN maintenance_tasks mt ON mt.id = ml.task_id "
         "WHERE mt.motorcycle_id = :bid AND ml.cost IS NOT NULL "
         "AND strftime('%Y', ml.date_performed) = :y")
    p: dict = {"bid": bike_id, "y": y}
    if m:
        q += " AND strftime('%m', ml.date_performed) = :m"
        p["m"] = m
    return session.execute(text(q), p).scalar() or 0.0


def _custom_by_cat(session: Session, bike_id: int, y: str, m: Optional[str]) -> dict[str, float]:
    q = ("SELECT category, COALESCE(SUM(amount), 0) FROM expenses "
         "WHERE motorcycle_id = :bid AND strftime('%Y', date) = :y")
    p: dict = {"bid": bike_id, "y": y}
    if m:
        q += " AND strftime('%m', date) = :m"
        p["m"] = m
    q += " GROUP BY category"
    return {r[0]: float(r[1]) for r in session.execute(text(q), p).fetchall()}


def _to_read(e: Expense) -> ExpenseRead:
    return ExpenseRead(id=e.id, category=e.category, amount=e.amount,
                       date=str(e.date), notes=e.notes)


@router.get("/api/motorcycles/{bike_id}/expense-summary", response_model=ExpenseSummary)
def get_expense_summary(
    bike_id: int,
    year: int,
    month: Optional[int] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    get_motorcycle_for_user(bike_id, current_user, session)
    now = datetime.now()
    end_year = year
    end_month = month if month is not None else (now.month if year == now.year else 12)
    y_str = str(year)
    m_str = f"{month:02d}" if month is not None else None

    fuel = _fuel_total(session, bike_id, y_str, m_str)
    maint = _maint_total(session, bike_id, y_str, m_str)
    custom = _custom_by_cat(session, bike_id, y_str, m_str)
    grand = fuel + maint + sum(custom.values())

    raw: dict[str, float] = {"fuel": fuel, "maintenance": maint, **custom}
    by_category = [
        CategoryTotal(
            category=cat,
            label=PRESET_CATEGORIES.get(cat, (cat, "📌"))[0],
            icon=PRESET_CATEGORIES.get(cat, (cat, "📌"))[1],
            amount=round(amt, 2),
            percent=round(amt / grand * 100, 1) if grand > 0 else 0.0,
        )
        for cat, amt in sorted(raw.items(), key=lambda x: -x[1])
        if amt > 0
    ]

    # cost_per_km: km ridden = MAX - MIN mileage from fuel_logs in period
    km_q = ("SELECT MAX(mileage_at_fillup), MIN(mileage_at_fillup), COUNT(*) "
            "FROM fuel_logs WHERE motorcycle_id = :bid AND strftime('%Y', date) = :y")
    km_p: dict = {"bid": bike_id, "y": y_str}
    if m_str:
        km_q += " AND strftime('%m', date) = :m"
        km_p["m"] = m_str
    row = session.execute(text(km_q), km_p).fetchone()
    cost_per_km = None
    if row and row[2] >= 2 and row[0] is not None and row[0] != row[1]:
        km = row[0] - row[1]
        cost_per_km = round(grand / km, 2) if km > 0 else None

    monthly_trend = []
    for yt, mt in _months_ending_at(end_year, end_month, 6):
        ys, ms = str(yt), f"{mt:02d}"
        f = _fuel_total(session, bike_id, ys, ms)
        mn = _maint_total(session, bike_id, ys, ms)
        oth = sum(_custom_by_cat(session, bike_id, ys, ms).values())
        monthly_trend.append(MonthBucket(
            month=f"{yt}-{ms}",
            fuel=round(f, 2),
            maintenance=round(mn, 2),
            other=round(oth, 2),
        ))

    return ExpenseSummary(
        total=round(grand, 2),
        cost_per_km=cost_per_km,
        by_category=by_category,
        monthly_trend=monthly_trend,
    )


@router.get("/api/motorcycles/{bike_id}/expenses", response_model=List[ExpenseRead])
def list_expenses(
    bike_id: int,
    year: Optional[int] = None,
    month: Optional[int] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    get_motorcycle_for_user(bike_id, current_user, session)
    q = select(Expense).where(Expense.motorcycle_id == bike_id)
    if year and month:
        last = monthrange(year, month)[1]
        m_str = f"{month:02d}"
        q = (q.where(Expense.date >= date_cls(year, month, 1))
              .where(Expense.date <= date_cls(year, month, last)))
    elif year:
        q = (q.where(Expense.date >= date_cls(year, 1, 1))
              .where(Expense.date <= date_cls(year, 12, 31)))
    return [_to_read(e) for e in session.exec(q.order_by(Expense.date.desc())).all()]


@router.post("/api/motorcycles/{bike_id}/expenses", response_model=ExpenseRead, status_code=201)
def create_expense(
    bike_id: int,
    data: ExpenseCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    get_motorcycle_for_user(bike_id, current_user, session)
    expense = Expense(
        motorcycle_id=bike_id,
        category=data.category,
        amount=data.amount,
        date=date_cls.fromisoformat(data.date),
        notes=data.notes,
    )
    session.add(expense)
    session.commit()
    session.refresh(expense)
    return _to_read(expense)


@router.put("/api/motorcycles/{bike_id}/expenses/{expense_id}", response_model=ExpenseRead)
def update_expense(
    bike_id: int,
    expense_id: int,
    data: ExpenseUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    get_motorcycle_for_user(bike_id, current_user, session)
    expense = session.exec(
        select(Expense)
        .where(Expense.id == expense_id)
        .where(Expense.motorcycle_id == bike_id)
    ).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "date" and value:
            value = date_cls.fromisoformat(value)
        setattr(expense, field, value)
    session.add(expense)
    session.commit()
    session.refresh(expense)
    return _to_read(expense)


@router.delete("/api/motorcycles/{bike_id}/expenses/{expense_id}", status_code=204)
def delete_expense(
    bike_id: int,
    expense_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    get_motorcycle_for_user(bike_id, current_user, session)
    expense = session.exec(
        select(Expense)
        .where(Expense.id == expense_id)
        .where(Expense.motorcycle_id == bike_id)
    ).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    session.delete(expense)
    session.commit()
```

- [ ] **Step 2: Verify syntax**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike/backend
DB_PATH=/Users/mark/my-work-space/My-Project/My-bike/data/moto.db AUTH_SECRET_KEY=dev \
  .venv/bin/python3 -c "from app.routers.expenses import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Smoke-test summary endpoint logic**

```bash
DB_PATH=/Users/mark/my-work-space/My-Project/My-bike/data/moto.db AUTH_SECRET_KEY=dev \
  .venv/bin/python3 -c "
from app.routers.expenses import _months_ending_at
buckets = _months_ending_at(2026, 5, 6)
print(buckets)
assert buckets[0] == (2025, 12)
assert buckets[-1] == (2026, 5)
print('trend OK')
"
```

Expected:
```
[(2025, 12), (2026, 1), (2026, 2), (2026, 3), (2026, 4), (2026, 5)]
trend OK
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/expenses.py
git commit -m "feat: add expenses router with CRUD and summary endpoint"
```

---

## Task 3: Wire Router + Frontend Types + API

**Files:**
- Modify: `backend/app/main.py`
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/api/expenses.ts`

- [ ] **Step 1: Import and include expenses router in `main.py`**

Change the router import line from:
```python
from app.routers import profiles, motorcycles, tasks, logs, settings, templates, fuel, shock, shock_presets, auth, shock_brands, reminders
```
To:
```python
from app.routers import profiles, motorcycles, tasks, logs, settings, templates, fuel, shock, shock_presets, auth, shock_brands, reminders, expenses
```

Add after `app.include_router(reminders.router)`:
```python
app.include_router(expenses.router)
```

- [ ] **Step 2: Verify routes registered**

```bash
DB_PATH=/Users/mark/my-work-space/My-Project/My-bike/data/moto.db AUTH_SECRET_KEY=dev \
  .venv/bin/python3 -c "
from app.main import app
routes = [r.path for r in app.routes if hasattr(r, 'path') and 'expense' in r.path]
print(routes)
"
```

Expected:
```
['/api/motorcycles/{bike_id}/expense-summary', '/api/motorcycles/{bike_id}/expenses', '/api/motorcycles/{bike_id}/expenses', '/api/motorcycles/{bike_id}/expenses/{expense_id}', '/api/motorcycles/{bike_id}/expenses/{expense_id}']
```

- [ ] **Step 3: Add expense types to `frontend/src/types/index.ts`**

Append at the bottom of `frontend/src/types/index.ts`:

```typescript
export interface ExpenseRead {
  id: number;
  category: string;
  amount: number;
  date: string;
  notes: string | null;
}

export interface CategoryTotal {
  category: string;
  label: string;
  icon: string;
  amount: number;
  percent: number;
}

export interface MonthBucket {
  month: string;      // "YYYY-MM"
  fuel: number;
  maintenance: number;
  other: number;
}

export interface ExpenseSummary {
  total: number;
  cost_per_km: number | null;
  by_category: CategoryTotal[];
  monthly_trend: MonthBucket[];
}
```

- [ ] **Step 4: Create `frontend/src/api/expenses.ts`**

```typescript
import client from "./client";
import type { ExpenseRead, ExpenseSummary } from "../types";

export const getExpenseSummary = (bikeId: number, year: number, month?: number) =>
  client.get<ExpenseSummary>(`/api/motorcycles/${bikeId}/expense-summary`, {
    params: { year, ...(month != null ? { month } : {}) },
  }).then((r) => r.data);

export const getExpenses = (bikeId: number, year?: number, month?: number) =>
  client.get<ExpenseRead[]>(`/api/motorcycles/${bikeId}/expenses`, {
    params: { ...(year ? { year } : {}), ...(month != null ? { month } : {}) },
  }).then((r) => r.data);

export const createExpense = (
  bikeId: number,
  data: { category: string; amount: number; date: string; notes?: string | null },
) =>
  client.post<ExpenseRead>(`/api/motorcycles/${bikeId}/expenses`, data).then((r) => r.data);

export const updateExpense = (
  bikeId: number,
  expenseId: number,
  data: Partial<{ category: string; amount: number; date: string; notes: string | null }>,
) =>
  client.put<ExpenseRead>(`/api/motorcycles/${bikeId}/expenses/${expenseId}`, data).then((r) => r.data);

export const deleteExpense = (bikeId: number, expenseId: number) =>
  client.delete(`/api/motorcycles/${bikeId}/expenses/${expenseId}`);
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike
git add backend/app/main.py frontend/src/types/index.ts frontend/src/api/expenses.ts
git commit -m "feat: wire expenses router, add frontend types and API client"
```

---

## Task 4: ExpenseCategoryBreakdown + ExpenseTrendChart

**Files:**
- Create: `frontend/src/components/expenses/ExpenseCategoryBreakdown.tsx`
- Create: `frontend/src/components/expenses/ExpenseTrendChart.tsx`

- [ ] **Step 1: Create `ExpenseCategoryBreakdown.tsx`**

```bash
mkdir -p /Users/mark/my-work-space/My-Project/My-bike/frontend/src/components/expenses
```

Create `frontend/src/components/expenses/ExpenseCategoryBreakdown.tsx`:

```typescript
import type { CategoryTotal } from "../../types";

const CATEGORY_COLORS: Record<string, string> = {
  fuel:         "var(--purple)",
  maintenance:  "var(--green)",
  insurance:    "#f59e0b",
  registration: "#64748b",
  parts:        "#38bdf8",
  parking:      "#f472b6",
  other:        "#94a3b8",
};

export default function ExpenseCategoryBreakdown({ items }: { items: CategoryTotal[] }) {
  if (items.length === 0) return (
    <p style={{ color: "var(--slate)", fontSize: 13, textAlign: "center", padding: "12px 0" }}>
      ยังไม่มีข้อมูลค่าใช้จ่าย
    </p>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item) => {
        const color = CATEGORY_COLORS[item.category] ?? "#94a3b8";
        return (
          <div key={item.category} className="expense-category-row">
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span style={{ fontSize: 13, color: "var(--ink)" }}>{item.label}</span>
            </div>
            <div style={{ flex: 1, height: 4, background: "var(--hairline)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${item.percent}%`, height: "100%", background: color, borderRadius: 99,
                            transition: "width 0.4s var(--jelly-ease)" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", minWidth: 64, textAlign: "right" }}>
              ฿{item.amount.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `ExpenseTrendChart.tsx`**

Create `frontend/src/components/expenses/ExpenseTrendChart.tsx`:

```typescript
import type { MonthBucket } from "../../types";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                     "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export default function ExpenseTrendChart({ buckets }: { buckets: MonthBucket[] }) {
  const maxTotal = Math.max(...buckets.map((b) => b.fuel + b.maintenance + b.other), 1);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 60 }}>
        {buckets.map((b) => {
          const total = b.fuel + b.maintenance + b.other;
          const fuelH  = (b.fuel / maxTotal) * 100;
          const maintH = (b.maintenance / maxTotal) * 100;
          const otherH = (b.other / maxTotal) * 100;
          const [yr, mo] = b.month.split("-");
          const label = THAI_MONTHS[parseInt(mo) - 1];
          const isCurrent = buckets.indexOf(b) === buckets.length - 1;
          return (
            <div key={b.month} style={{ flex: 1, display: "flex", flexDirection: "column",
                                         alignItems: "center", gap: 0 }}>
              <div style={{ width: "100%", display: "flex", flexDirection: "column",
                             justifyContent: "flex-end", height: 52, gap: 1 }}>
                {otherH > 0 && (
                  <div style={{ width: "100%", height: `${otherH}%`, borderRadius: "2px 2px 0 0",
                                 background: isCurrent ? "#f59e0b" : "#f59e0b44" }} />
                )}
                {maintH > 0 && (
                  <div style={{ width: "100%", height: `${maintH}%`,
                                 background: isCurrent ? "var(--green)" : "var(--green-bg)" }} />
                )}
                {fuelH > 0 && (
                  <div style={{ width: "100%", height: `${fuelH}%`, borderRadius: "0 0 2px 2px",
                                 background: isCurrent ? "var(--purple)" : "var(--purple-bg)" }} />
                )}
                {total === 0 && (
                  <div style={{ width: "100%", height: 3, borderRadius: 2,
                                 background: "var(--hairline)" }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
        {buckets.map((b, i) => {
          const [yr, mo] = b.month.split("-");
          const label = THAI_MONTHS[parseInt(mo) - 1];
          const isCurrent = i === buckets.length - 1;
          return (
            <div key={b.month} style={{ flex: 1, textAlign: "center", fontSize: 9,
                                         color: isCurrent ? "var(--purple)" : "var(--steel)" }}>
              {label}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <span style={{ fontSize: 10, color: "var(--purple)" }}>■ น้ำมัน</span>
        <span style={{ fontSize: 10, color: "var(--green)" }}>■ ซ่อมบำรุง</span>
        <span style={{ fontSize: 10, color: "#f59e0b" }}>■ อื่นๆ</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike
git add frontend/src/components/expenses/
git commit -m "feat: add ExpenseCategoryBreakdown and ExpenseTrendChart components"
```

---

## Task 5: ExpenseModal

**Files:**
- Create: `frontend/src/components/expenses/ExpenseModal.tsx`

- [ ] **Step 1: Create `ExpenseModal.tsx`**

Create `frontend/src/components/expenses/ExpenseModal.tsx`:

```typescript
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createExpense, updateExpense } from "../../api/expenses";
import { getAllMotorcycles } from "../../api/motorcycles";
import { useQuery } from "@tanstack/react-query";
import type { ExpenseRead } from "../../types";

const PRESET_CATS = [
  { key: "insurance",    label: "ประกันภัย",  icon: "🛡️" },
  { key: "registration", label: "ต่อทะเบียน", icon: "📋" },
  { key: "parts",        label: "อะไหล่",     icon: "⚙️" },
  { key: "parking",      label: "ค่าจอด",     icon: "🅿️" },
  { key: "other",        label: "อื่นๆ",      icon: "📌" },
];

interface Props {
  bikeId?: number;         // pre-filled if opened from BikePage
  expense?: ExpenseRead;   // set for edit mode
  onClose: () => void;
}

export default function ExpenseModal({ bikeId, expense, onClose }: Props) {
  const qc = useQueryClient();
  const { data: bikes = [] } = useQuery({ queryKey: ["motorcycles"], queryFn: getAllMotorcycles });

  const today = new Date().toISOString().slice(0, 10);
  const [selectedBike, setSelectedBike] = useState<number>(bikeId ?? 0);
  const [category, setCategory] = useState(expense?.category ?? "insurance");
  const [customCat, setCustomCat] = useState("");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [date, setDate] = useState(expense?.date ?? today);
  const [notes, setNotes] = useState(expense?.notes ?? "");

  useEffect(() => {
    if (!selectedBike && bikes.length > 0) setSelectedBike(bikes[0].id);
  }, [bikes, selectedBike]);

  const isCustom = !PRESET_CATS.find((p) => p.key === category);
  const finalCategory = isCustom ? (customCat || category) : category;

  const saveMut = useMutation({
    mutationFn: () => {
      const data = {
        category: finalCategory,
        amount: parseFloat(amount),
        date,
        notes: notes || null,
      };
      return expense
        ? updateExpense(selectedBike, expense.id, data)
        : createExpense(selectedBike, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-summary"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      onClose();
    },
  });

  const canSave = selectedBike > 0 && finalCategory && parseFloat(amount) > 0 && date;

  return (
    <div className="expense-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="expense-modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
            {expense ? "แก้ไขค่าใช้จ่าย" : "เพิ่มค่าใช้จ่าย"}
          </span>
          <button onClick={onClose} style={{ color: "var(--slate)", background: "none", border: "none",
                                              fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        {/* Motorcycle selector */}
        {!bikeId && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "var(--slate)", display: "block", marginBottom: 4 }}>
              รถมอเตอร์ไซค์
            </label>
            <select
              className="reminder-interval-input"
              style={{ width: "100%", padding: "8px 10px" }}
              value={selectedBike}
              onChange={(e) => setSelectedBike(Number(e.target.value))}
            >
              {bikes.map((b) => (
                <option key={b.id} value={b.id}>{b.nickname ?? `${b.make} ${b.model}`}</option>
              ))}
            </select>
          </div>
        )}

        {/* Category chips */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: "var(--slate)", display: "block", marginBottom: 6 }}>
            หมวดหมู่
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PRESET_CATS.map((p) => {
              const active = category === p.key;
              return (
                <button key={p.key}
                  onClick={() => setCategory(p.key)}
                  style={{
                    padding: "5px 10px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                    background: active ? "var(--purple-bg)" : "var(--surface)",
                    border: `1px solid ${active ? "var(--purple-border)" : "var(--glass-border)"}`,
                    color: active ? "var(--purple)" : "var(--slate)",
                  }}
                >{p.icon} {p.label}</button>
              );
            })}
            <button
              onClick={() => setCategory("__custom__")}
              style={{
                padding: "5px 10px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                background: isCustom ? "var(--purple-bg)" : "var(--surface)",
                border: `1px solid ${isCustom ? "var(--purple-border)" : "var(--glass-border)"}`,
                color: isCustom ? "var(--purple)" : "var(--slate)",
              }}
            >+ กำหนดเอง</button>
          </div>
          {isCustom && (
            <input
              placeholder="ชื่อหมวดหมู่"
              value={customCat}
              onChange={(e) => setCustomCat(e.target.value)}
              className="reminder-interval-input"
              style={{ width: "100%", marginTop: 8, padding: "8px 10px", boxSizing: "border-box" }}
            />
          )}
        </div>

        {/* Amount + Date */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: "var(--slate)", display: "block", marginBottom: 4 }}>
              จำนวนเงิน (฿)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="reminder-interval-input"
              style={{ width: "100%", padding: "8px 10px", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: "var(--slate)", display: "block", marginBottom: 4 }}>
              วันที่
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="reminder-interval-input"
              style={{ width: "100%", padding: "8px 10px", boxSizing: "border-box" }}
            />
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "var(--slate)", display: "block", marginBottom: 4 }}>
            หมายเหตุ (ไม่บังคับ)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="reminder-interval-input"
            style={{ width: "100%", padding: "8px 10px", resize: "none", boxSizing: "border-box" }}
          />
        </div>

        <button
          className="btn btn-primary"
          style={{ width: "100%" }}
          disabled={!canSave || saveMut.isPending}
          onClick={() => saveMut.mutate()}
        >
          {saveMut.isPending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike
git add frontend/src/components/expenses/ExpenseModal.tsx
git commit -m "feat: add ExpenseModal component"
```

---

## Task 6: ExpenseDashboardPage

**Files:**
- Create: `frontend/src/pages/ExpenseDashboardPage.tsx`

- [ ] **Step 1: Create `ExpenseDashboardPage.tsx`**

Create `frontend/src/pages/ExpenseDashboardPage.tsx`:

```typescript
import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { getExpenseSummary } from "../api/expenses";
import { getAllMotorcycles } from "../api/motorcycles";
import type { ExpenseSummary, MonthBucket, CategoryTotal } from "../types";
import ExpenseCategoryBreakdown from "../components/expenses/ExpenseCategoryBreakdown";
import ExpenseTrendChart from "../components/expenses/ExpenseTrendChart";
import ExpenseModal from "../components/expenses/ExpenseModal";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                     "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function mergeSummaries(summaries: ExpenseSummary[]): ExpenseSummary {
  const total = summaries.reduce((s, x) => s + x.total, 0);
  const catMap: Record<string, CategoryTotal> = {};
  for (const s of summaries) {
    for (const c of s.by_category) {
      if (!catMap[c.category]) {
        catMap[c.category] = { ...c, amount: 0, percent: 0 };
      }
      catMap[c.category].amount += c.amount;
    }
  }
  const by_category = Object.values(catMap)
    .map((c) => ({ ...c, amount: Math.round(c.amount * 100) / 100,
                   percent: total > 0 ? Math.round((c.amount / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.amount - a.amount);

  // Merge monthly_trend: sum same-month buckets
  const trendMap: Record<string, MonthBucket> = {};
  for (const s of summaries) {
    for (const b of s.monthly_trend) {
      if (!trendMap[b.month]) trendMap[b.month] = { month: b.month, fuel: 0, maintenance: 0, other: 0 };
      trendMap[b.month].fuel        += b.fuel;
      trendMap[b.month].maintenance += b.maintenance;
      trendMap[b.month].other       += b.other;
    }
  }
  const monthly_trend = Object.values(trendMap).sort((a, b) => a.month.localeCompare(b.month));

  const cost_per_km = null; // not meaningful when aggregated across bikes
  return { total: Math.round(total * 100) / 100, cost_per_km, by_category, monthly_trend };
}

export default function ExpenseDashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(now.getMonth() + 1);
  const [bikeFilter, setBikeFilter] = useState<number | "all">("all");
  const [showModal, setShowModal] = useState(false);

  const { data: bikes = [] } = useQuery({ queryKey: ["motorcycles"], queryFn: getAllMotorcycles });

  const targetBikes = bikeFilter === "all" ? bikes : bikes.filter((b) => b.id === bikeFilter);

  const summaryQueries = useQueries({
    queries: targetBikes.map((b) => ({
      queryKey: ["expense-summary", b.id, year, month],
      queryFn: () => getExpenseSummary(b.id, year, month ?? undefined),
      enabled: targetBikes.length > 0,
    })),
  });

  const allLoaded = summaryQueries.every((q) => !q.isLoading);
  const summaries = summaryQueries.map((q) => q.data).filter(Boolean) as ExpenseSummary[];
  const summary = summaries.length > 0 ? mergeSummaries(summaries) : null;

  const singleBikeSummary = bikeFilter !== "all" && summaries.length === 1 ? summaries[0] : null;

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: 0 }}>ค่าใช้จ่าย</h1>
        <button
          className="btn btn-sm"
          style={{ color: "var(--purple)", borderColor: "var(--purple-border)", background: "var(--purple-bg)" }}
          onClick={() => setShowModal(true)}
        >+ เพิ่ม</button>
      </div>

      {/* Bike filter */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
        {[{ id: "all" as const, label: "ทุกคัน" },
          ...bikes.map((b) => ({ id: b.id, label: b.nickname ?? `${b.make} ${b.model}` }))
        ].map(({ id, label }) => {
          const active = bikeFilter === id;
          return (
            <button key={String(id)} onClick={() => setBikeFilter(id)}
              style={{
                padding: "4px 12px", borderRadius: 20, fontSize: 12, whiteSpace: "nowrap",
                cursor: "pointer", flexShrink: 0,
                background: active ? "var(--purple-bg)" : "var(--surface)",
                border: `1px solid ${active ? "var(--purple-border)" : "var(--glass-border)"}`,
                color: active ? "var(--purple)" : "var(--slate)",
              }}
            >{label}</button>
          );
        })}
      </div>

      {/* Year selector + month chips */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, marginBottom: 14 }}>
        <button onClick={() => setYear((y) => y - 1)}
          style={{ padding: "3px 8px", fontSize: 11, background: "var(--surface)",
                   border: "1px solid var(--glass-border)", borderRadius: 4, color: "var(--slate)", cursor: "pointer" }}>
          ‹ {year - 1}
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", padding: "0 4px" }}>{year}</span>
        {year < now.getFullYear() && (
          <button onClick={() => setYear((y) => y + 1)}
            style={{ padding: "3px 8px", fontSize: 11, background: "var(--surface)",
                     border: "1px solid var(--glass-border)", borderRadius: 4, color: "var(--slate)", cursor: "pointer" }}>
            {year + 1} ›
          </button>
        )}
        <div style={{ width: 1, height: 16, background: "var(--hairline)", margin: "0 4px" }} />
        {THAI_MONTHS.map((label, i) => {
          const m = i + 1;
          const active = month === m;
          const isFuture = year === now.getFullYear() && m > now.getMonth() + 1;
          return (
            <button key={m} disabled={isFuture}
              onClick={() => setMonth(month === m ? null : m)}
              style={{
                padding: "3px 7px", fontSize: 11, borderRadius: 4, cursor: isFuture ? "default" : "pointer",
                background: active ? "var(--green-bg)" : "var(--surface)",
                border: `1px solid ${active ? "var(--green)" : "var(--glass-border)"}`,
                color: active ? "var(--green)" : isFuture ? "var(--hairline)" : "var(--slate)",
              }}
            >{label}</button>
          );
        })}
      </div>

      {!allLoaded && <p style={{ color: "var(--slate)", fontSize: 13 }}>กำลังโหลด…</p>}

      {allLoaded && summary && (
        <>
          {/* KPI */}
          <div className="expense-kpi-row" style={{ marginBottom: 12 }}>
            <div className="card" style={{ flex: 1, textAlign: "center", padding: "10px 8px" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--purple)" }}>
                ฿{summary.total.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: "var(--slate)", marginTop: 2 }}>
                {month ? `${THAI_MONTHS[month - 1]} ${year}` : `ปี ${year}`}
              </div>
            </div>
            {singleBikeSummary?.cost_per_km != null && (
              <div className="card" style={{ flex: 1, textAlign: "center", padding: "10px 8px" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--green)" }}>
                  ฿{singleBikeSummary.cost_per_km}
                </div>
                <div style={{ fontSize: 11, color: "var(--slate)", marginTop: 2 }}>บาท/กม.</div>
              </div>
            )}
          </div>

          {/* Trend chart */}
          <div className="card" style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: "var(--slate)", margin: "0 0 10px", textTransform: "uppercase" }}>
              แนวโน้ม 6 เดือน
            </p>
            <ExpenseTrendChart buckets={summary.monthly_trend} />
          </div>

          {/* Category breakdown */}
          <div className="card">
            <p style={{ fontSize: 12, color: "var(--slate)", margin: "0 0 10px", textTransform: "uppercase" }}>
              หมวดหมู่
            </p>
            <ExpenseCategoryBreakdown items={summary.by_category} />
          </div>
        </>
      )}

      {allLoaded && !summary && (
        <p style={{ color: "var(--slate)", fontSize: 13, textAlign: "center", marginTop: 40 }}>
          ยังไม่มีข้อมูลค่าใช้จ่าย
        </p>
      )}

      {showModal && <ExpenseModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike
git add frontend/src/pages/ExpenseDashboardPage.tsx
git commit -m "feat: add ExpenseDashboardPage"
```

---

## Task 7: BikePage Expense Card

**Files:**
- Modify: `frontend/src/pages/BikePage.tsx`

- [ ] **Step 1: Add expense query and imports to `BikePage.tsx`**

After the existing reminder imports at the top of `BikePage.tsx`, add:

```typescript
import { getExpenseSummary } from "../api/expenses";
import ExpenseModal from "../components/expenses/ExpenseModal";
```

After the `reminders` query in `BikePage.tsx` (around line 66), add:

```typescript
  const now = new Date();
  const { data: expenseSummary } = useQuery({
    queryKey: ["expense-summary", bid, now.getFullYear(), now.getMonth() + 1],
    queryFn: () => getExpenseSummary(bid, now.getFullYear(), now.getMonth() + 1),
    enabled: !!bid,
  });
  const [showExpenseModal, setShowExpenseModal] = useState(false);
```

- [ ] **Step 2: Add expense card in BikePage JSX**

Find this block in `BikePage.tsx` (just after `<ReminderAlertBar ... />`):

```tsx
          {/* Reminder alert bar */}
          <ReminderAlertBar bikeId={bid} reminders={reminders} />

          {/* Tab bar — segment control */}
```

Replace with:

```tsx
          {/* Reminder alert bar */}
          <ReminderAlertBar bikeId={bid} reminders={reminders} />

          {/* Expense summary card */}
          {expenseSummary && expenseSummary.total > 0 && (
            <div className="card" style={{ marginBottom: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                  💰 ค่าใช้จ่ายเดือนนี้
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-sm"
                    style={{ color: "var(--purple)", borderColor: "var(--purple-border)", background: "var(--purple-bg)", fontSize: 11 }}
                    onClick={() => setShowExpenseModal(true)}>+ เพิ่ม</button>
                  <button className="btn btn-sm" style={{ fontSize: 11, color: "var(--slate)" }}
                    onClick={() => navigate(`/expenses`, { state: { bikeId: bid }, viewTransition: true })}>
                    ดูทั้งหมด →
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ textAlign: "center", minWidth: 70 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--purple)" }}>
                    ฿{expenseSummary.total.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--slate)" }}>รวม</div>
                </div>
                <div style={{ width: 1, height: 36, background: "var(--hairline)" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
                  {expenseSummary.by_category.slice(0, 3).map((c) => (
                    <div key={c.category} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "var(--slate)" }}>{c.icon} {c.label}</span>
                      <span style={{ color: "var(--ink)", fontWeight: 500 }}>฿{c.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab bar — segment control */}
```

- [ ] **Step 3: Add modal render at bottom of BikePage return**

Find the closing `</>` of the `{bike && (<>...</>)}` block (near the bottom of the JSX) and add before it:

```tsx
          {showExpenseModal && (
            <ExpenseModal bikeId={bid} onClose={() => setShowExpenseModal(false)} />
          )}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike
git add frontend/src/pages/BikePage.tsx
git commit -m "feat: add expense summary card to BikePage"
```

---

## Task 8: Route + Nav + CSS + Deploy

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add route and nav link to `App.tsx`**

Add import after the existing page imports:

```typescript
import ExpenseDashboardPage from "./pages/ExpenseDashboardPage";
```

In `NavBar`, add a nav link after the "My Garage" NavLink:

```tsx
        <NavLink
          to="/expenses"
          className={({ isActive }) => `app-nav-link${isActive ? " is-active" : ""}`}
        >
          💰
        </NavLink>
```

In the `<Routes>` inside `AppShell`, add after the bikes route:

```tsx
                  <Route path="/expenses" element={<ExpenseDashboardPage />} />
```

- [ ] **Step 2: Add expense CSS to `index.css`**

Append at the end of `frontend/src/index.css`:

```css
/* ─── Expense Dashboard ─────────────────────────────────────────── */
.expense-kpi-row {
  display: flex;
  gap: 10px;
}
.expense-category-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.expense-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 200;
  padding: 0 0 env(safe-area-inset-bottom, 0);
}
.expense-modal {
  background: var(--surface);
  border-radius: var(--r-md) var(--r-md) 0 0;
  border: 1px solid var(--glass-border);
  padding: 20px 16px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4: Build and deploy**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike/frontend
npm run deploy 2>&1 | tail -10
```

Expected: `✓ built in ~250ms`

- [ ] **Step 5: Restart backend and smoke-test**

Kill existing backend, then:

```bash
cd /Users/mark/my-work-space/My-Project/My-bike && NO_BROWSER=1 python3 server.py &
sleep 2
```

Test summary endpoint directly:

```bash
DB_PATH=/Users/mark/my-work-space/My-Project/My-bike/data/moto.db AUTH_SECRET_KEY=dev \
  .venv/bin/python3 -c "
from app.routers.expenses import _fuel_total, _maint_total, _months_ending_at
from app.database import get_session
# Quick logic check
buckets = _months_ending_at(2026, 5, 6)
assert len(buckets) == 6
assert buckets[-1] == (2026, 5)
print('Backend smoke test: PASS')
"
```

Expected: `Backend smoke test: PASS`

- [ ] **Step 6: Browser acceptance test**

Open **http://localhost:8764**, log in, then:

1. Click 💰 nav icon → opens `/expenses` page
2. Click "+ เพิ่ม" → ExpenseModal opens with category chips, amount, date fields
3. Select "ประกันภัย", enter ฿2500, save → page refreshes with insurance in breakdown
4. Open any bike page → expense card shows "💰 ค่าใช้จ่ายเดือนนี้" with the amount
5. Click "+ เพิ่ม" on bike page card → ExpenseModal opens pre-filled with that bike

- [ ] **Step 7: Commit**

```bash
cd /Users/mark/my-work-space/My-Project/My-bike
git add frontend/src/App.tsx frontend/src/index.css
git commit -m "feat: add expense dashboard route, nav link, and CSS"
```
