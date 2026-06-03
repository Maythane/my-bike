# Expense Dashboard Design

**Goal:** Track all motorcycle-related expenses (fuel, maintenance, insurance, registration, custom) with a global dashboard showing monthly/yearly summaries, trends, and per-category breakdowns.

---

## Overview

Three data sources are combined into a unified expense view:
1. **Fuel costs** — pulled from `fuel_logs.cost` (existing)
2. **Maintenance costs** — pulled from `maintenance_logs.cost` (existing)
3. **Custom expenses** — new `expenses` table (insurance, registration, parts, parking, other)

---

## Data Model

### New table: `expenses`

```sql
CREATE TABLE expenses (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    motorcycle_id INTEGER NOT NULL REFERENCES motorcycles(id) ON DELETE CASCADE,
    category      TEXT NOT NULL,
    amount        REAL NOT NULL,
    date          DATE NOT NULL,
    notes         TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

`category` is free text. Preset values surfaced in UI:
- `insurance` — ประกันภัย 🛡️
- `registration` — ต่อทะเบียน 📋
- `parts` — อะไหล่ ⚙️
- `parking` — ค่าจอด 🅿️
- `other` — อื่นๆ 📌

Users may also type a custom category name freely.

---

## Backend

### New file: `backend/app/routers/expenses.py`

**Endpoints:**

```
GET    /api/motorcycles/{bike_id}/expense-summary
       Query params: year (int, required), month (int, optional)
       → ExpenseSummary

GET    /api/motorcycles/{bike_id}/expenses
       Query params: year (int, optional), month (int, optional)
       → List[ExpenseRead]

POST   /api/motorcycles/{bike_id}/expenses
       Body: ExpenseCreate
       → ExpenseRead

PUT    /api/motorcycles/{bike_id}/expenses/{expense_id}
       Body: ExpenseUpdate
       → ExpenseRead

DELETE /api/motorcycles/{bike_id}/expenses/{expense_id}
       → 204
```

**Response shapes:**

```python
class ExpenseRead(BaseModel):
    id: int
    category: str
    amount: float
    date: str       # ISO date "YYYY-MM-DD"
    notes: Optional[str]

class CategoryTotal(BaseModel):
    category: str   # "fuel" | "maintenance" | user-defined
    label: str      # Thai display name
    icon: str       # emoji
    amount: float
    percent: float  # 0-100

class MonthBucket(BaseModel):
    month: str      # "YYYY-MM"
    fuel: float
    maintenance: float
    other: float    # all custom expenses combined

class ExpenseSummary(BaseModel):
    total: float
    cost_per_km: Optional[float]   # None if no mileage data in period
    by_category: List[CategoryTotal]
    monthly_trend: List[MonthBucket]  # always 6 buckets ending at requested period
```

**Aggregate query pattern (summary endpoint):**

```sql
-- Fuel costs for period
SELECT 'fuel' AS src, SUM(cost) AS total
FROM fuel_logs
WHERE motorcycle_id = :bike_id
  AND cost IS NOT NULL
  AND strftime('%Y', date) = :year
  [AND strftime('%m', date) = :month]

UNION ALL

-- Maintenance costs for period
SELECT 'maintenance', SUM(ml.cost)
FROM maintenance_logs ml
JOIN maintenance_tasks mt ON mt.id = ml.task_id
WHERE mt.motorcycle_id = :bike_id
  AND ml.cost IS NOT NULL
  AND strftime('%Y', ml.date_performed) = :year
  [AND strftime('%m', ml.date_performed) = :month]

UNION ALL

-- Custom expenses for period
SELECT category, SUM(amount)
FROM expenses
WHERE motorcycle_id = :bike_id
  AND strftime('%Y', date) = :year
  [AND strftime('%m', date) = :month]
GROUP BY category
```

**`cost_per_km` calculation:** total expense ÷ km ridden in period.
- km ridden = `MAX(mileage_at_fillup) - MIN(mileage_at_fillup)` from `fuel_logs` in the period.
- If fewer than 2 fuel log entries in period, return `None`.

**Monthly trend:** always 6 consecutive month buckets ending at the requested period.
- Monthly mode `(year, month)`: buckets end at that month (e.g. May 2026 → Dec 2025 … May 2026).
- Yearly mode `(year, month=null)`: buckets end at December of that year, or the current month if year equals the current year (e.g. viewing 2026 in May → Dec 2025 … May 2026).

### Modify: `backend/app/database.py`

Add `_migrate_expenses()`:
```python
def _migrate_expenses():
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

Call it in `create_db()` after `_migrate_reminders()`.

### Modify: `backend/app/models.py`

Add `Expense` SQLModel:
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

### Modify: `backend/app/main.py`

Import and include `expenses.router`.

---

## Frontend

### New file: `frontend/src/api/expenses.ts`

```typescript
getExpenseSummary(bikeId, year, month?)  → ExpenseSummary
getExpenses(bikeId, year?, month?)       → ExpenseRead[]
createExpense(bikeId, data)              → ExpenseRead
updateExpense(bikeId, expenseId, data)   → ExpenseRead
deleteExpense(bikeId, expenseId)         → void
```

### New file: `frontend/src/pages/ExpenseDashboardPage.tsx`

**State:**
- `bikeFilter: number | "all"` — which bike to show (default "all")
- `year: number` — selected year (default current year)
- `month: number | null` — selected month (null = yearly view)

**Layout (top to bottom):**
1. Header — "ค่าใช้จ่าย" + "+ เพิ่ม" button
2. Bike filter tabs — "ทุกคัน" + one button per bike
3. Period selector — year picker + month chips (ม.ค.–ธ.ค., deselect = yearly)
4. KPI row — รวมเดือน/ปีนี้ | บาท/กม.
5. Stacked bar chart — 6-month trend (`ExpenseTrendChart`)
6. Category breakdown — (`ExpenseCategoryBreakdown`)

When `bikeFilter === "all"`: fetch summary for each bike and sum them client-side (avoids a new aggregate-all endpoint; acceptable at ≤10 bikes).

### New file: `frontend/src/components/expenses/ExpenseModal.tsx`

Modal for add/edit a custom expense. Fields:
- Motorcycle selector (dropdown, pre-filled if opened from BikePage)
- Category — dropdown of presets + free-text option
- Amount — number input (฿)
- Date — date input (default today)
- Notes — optional text

### New file: `frontend/src/components/expenses/ExpenseCategoryBreakdown.tsx`

Renders the per-category list with label, icon, progress bar, and amount. Accepts `by_category: CategoryTotal[]` as prop.

### New file: `frontend/src/components/expenses/ExpenseTrendChart.tsx`

Renders the stacked bar chart. Accepts `monthly_trend: MonthBucket[]` as prop. Pure CSS bars (no chart library).

### Modify: `frontend/src/App.tsx`

- Add `import ExpenseDashboardPage`
- Add route `/expenses`
- Add nav link "💰" or "ค่าใช้จ่าย" in `NavBar`

### Modify: `frontend/src/pages/BikePage.tsx`

Add a compact expense summary card above the tab bar (below the reminder alert bar):
- Shows this month's total + top 2 categories
- Tap → navigates to `/expenses` pre-filtered to this bike
- Has "+ เพิ่ม" button that opens `ExpenseModal`

### Modify: `frontend/src/index.css`

Add styles: `.expense-kpi-row`, `.expense-trend-bar`, `.expense-category-row`, `.expense-modal`.

---

## Types: `frontend/src/types/index.ts`

Append:
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
  month: string;
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

---

## Out of Scope

- Export to CSV/Excel
- Budget limits / alerts
- Recurring expense automation
- Sharing expenses across users
