from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime, date, timezone
from enum import Enum


class UnitEnum(str, Enum):
    km = "km"
    miles = "miles"


class PriorityEnum(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class AppSettings(SQLModel, table=True):
    __tablename__ = "settings"
    id: Optional[int] = Field(default=None, primary_key=True)
    default_unit: UnitEnum = Field(default=UnitEnum.km)
    timezone: str = Field(default="Asia/Bangkok")
    app_version: str = Field(default="1.0.0")
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)


class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    email: Optional[str] = Field(default=None, unique=True, index=True)
    hashed_password: str
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)
    username: Optional[str] = Field(default=None, unique=True, index=True)
    phone: Optional[str] = Field(default=None, unique=True, index=True)
    phone_verified: bool = Field(default=False)
    display_name: Optional[str] = Field(default=None)
    avatar_url: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    profiles: List["Profile"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class Profile(SQLModel, table=True):
    __tablename__ = "profiles"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    icon: str = Field(default="🏍️")
    color_accent: str = Field(default="#39FF14")
    unit: Optional[UnitEnum] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)

    user: Optional["User"] = Relationship(back_populates="profiles")
    motorcycles: List["Motorcycle"] = Relationship(
        back_populates="profile",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class Motorcycle(SQLModel, table=True):
    __tablename__ = "motorcycles"
    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profiles.id")
    make: str
    model: str
    year: int
    nickname: Optional[str] = Field(default=None)
    color: Optional[str] = Field(default=None)
    license_plate: Optional[str] = Field(default=None)
    registration_year: Optional[int] = Field(default=None)
    engine_cc: Optional[int] = Field(default=None)
    tank_capacity: Optional[float] = Field(default=None)
    current_mileage: int = Field(default=0)
    mileage_unit: Optional[UnitEnum] = Field(default=None)
    image_path: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    profile: Optional[Profile] = Relationship(back_populates="motorcycles")
    tasks: List["MaintenanceTask"] = Relationship(
        back_populates="motorcycle",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class MaintenanceTask(SQLModel, table=True):
    __tablename__ = "maintenance_tasks"
    id: Optional[int] = Field(default=None, primary_key=True)
    motorcycle_id: int = Field(foreign_key="motorcycles.id")
    name: str
    interval_km: Optional[int] = Field(default=None)
    interval_months: Optional[int] = Field(default=None)
    priority: PriorityEnum = Field(default=PriorityEnum.medium)
    is_active: bool = Field(default=True)
    notes: Optional[str] = Field(default=None)

    motorcycle: Optional[Motorcycle] = Relationship(back_populates="tasks")
    logs: List["MaintenanceLog"] = Relationship(
        back_populates="task",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class MaintenanceLog(SQLModel, table=True):
    __tablename__ = "maintenance_logs"
    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: int = Field(foreign_key="maintenance_tasks.id")
    date_performed: date
    mileage_at_service: int
    cost: Optional[float] = Field(default=None)
    location: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    image_path: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    task: Optional[MaintenanceTask] = Relationship(back_populates="logs")


class FuelLog(SQLModel, table=True):
    __tablename__ = "fuel_logs"
    id: Optional[int] = Field(default=None, primary_key=True)
    motorcycle_id: int = Field(foreign_key="motorcycles.id")
    date: date
    mileage_at_fillup: int
    fuel_amount: float
    fuel_type: str = Field(default="E20")
    is_full_tank: bool = Field(default=True)
    cost: Optional[float] = Field(default=None)
    location: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    image_path: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MaintenanceLogImage(SQLModel, table=True):
    __tablename__ = "maintenance_log_images"
    id: Optional[int] = Field(default=None, primary_key=True)
    log_id: int = Field(foreign_key="maintenance_logs.id")
    image_path: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FuelLogImage(SQLModel, table=True):
    __tablename__ = "fuel_log_images"
    id: Optional[int] = Field(default=None, primary_key=True)
    log_id: int = Field(foreign_key="fuel_logs.id")
    image_path: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TaskTemplate(SQLModel, table=True):
    __tablename__ = "task_templates"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    model: Optional[str] = Field(default=None)
    default_interval_km: Optional[int] = Field(default=None)
    default_interval_months: Optional[int] = Field(default=None)
    category: str


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


class ShockBrand(SQLModel, table=True):
    __tablename__ = "shock_brands"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    accent_color: str = Field(default="#a78bfa")
    banner_bg_color: str = Field(default="#09091a")
    header_image_path: Optional[str] = Field(default=None)
    shock_models: Optional[str] = Field(default=None)  # JSON array string e.g. '["P-Series","G30"]'


class ServiceReminder(SQLModel, table=True):
    __tablename__ = "service_reminders"
    id: Optional[int] = Field(default=None, primary_key=True)
    motorcycle_id: int = Field(foreign_key="motorcycles.id", index=True)
    item_key: str        # "engine_oil" | "gear_oil" | "spark_plug" | "air_filter" | "oil_filter"
    item_name: str
    interval_km: int = Field(default=3000)
    last_done_mileage: Optional[int] = Field(default=None)
    enabled: bool = Field(default=True)


class Expense(SQLModel, table=True):
    __tablename__ = "expenses"
    id: Optional[int] = Field(default=None, primary_key=True)
    motorcycle_id: int = Field(foreign_key="motorcycles.id", index=True)
    category: str
    amount: float
    date: date
    notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
