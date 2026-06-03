from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy import text
from typing import Optional, List
from pydantic import BaseModel, Field
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
    amount: float = Field(gt=0)
    date: date_cls
    notes: Optional[str] = None


class ExpenseUpdate(BaseModel):
    category: Optional[str] = None
    amount: Optional[float] = Field(default=None, gt=0)
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
        date=data.date,
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
            try:
                value = date_cls.fromisoformat(value)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
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
