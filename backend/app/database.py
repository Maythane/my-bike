from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text
import json
import os

DB_PATH = os.getenv("DB_PATH", "/app/data/moto.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def get_session():
    with Session(engine) as session:
        yield session


def create_db():
    SQLModel.metadata.create_all(engine)
    _migrate()
    _migrate_shock_per_bike()
    _migrate_shock_charts()
    _migrate_images()
    _migrate_reminders()
    _migrate_expenses()
    _migrate_user_profile()


def _migrate_user_profile():
    with engine.connect() as conn:
        for col, col_type in [("display_name", "TEXT"), ("avatar_url", "TEXT")]:
            existing = [r[1] for r in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
            if col not in existing:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))
        conn.commit()


def _migrate():
    new_columns = [
        ("motorcycles", "color", "TEXT"),
        ("motorcycles", "registration_year", "INTEGER"),
        ("motorcycles", "engine_cc", "INTEGER"),
        ("motorcycles", "tank_capacity", "REAL"),
        ("task_templates", "model", "TEXT"),
        ("maintenance_logs", "image_path", "TEXT"),
        ("motorcycles", "image_path", "TEXT"),
        ("maintenance_logs", "location", "TEXT"),
        ("fuel_logs", "location", "TEXT"),
    ]
    with engine.connect() as conn:
        for table, col, col_type in new_columns:
            existing = [
                row[1]
                for row in conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            ]
            if col not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
        conn.commit()


def _migrate_shock_per_bike():
    """Add shock-per-bike columns and shock_brands table at startup (idempotent)."""
    SEED_BRANDS = [
        ("Profender", "#e8251a", "#000000", '["X-Series+","X-Series","Flash"]'),
        ("Öhlins",   "#f4a620", "#1a5fb4", '["STX 36","EC 460","TTX GP"]'),
        ("YSS",      "#e01010", "#000000", '["G-Series","Z-Series","ME302"]'),
        ("Stock",    "#a78bfa", "#09091a", "[]"),
    ]
    new_columns = [
        ("shock_settings", "motorcycle_id", "INTEGER REFERENCES motorcycles(id)"),
        ("shock_settings", "shock_brand",   "TEXT"),
        ("shock_settings", "shock_model",   "TEXT"),
        ("shock_presets",  "motorcycle_id", "INTEGER REFERENCES motorcycles(id)"),
        ("shock_presets",  "shock_brand",   "TEXT"),
        ("shock_presets",  "shock_model",   "TEXT"),
        ("users",          "is_admin",      "INTEGER NOT NULL DEFAULT 0"),
        ("users",          "username",      "TEXT UNIQUE DEFAULT NULL"),
        ("users",          "phone",         "TEXT UNIQUE DEFAULT NULL"),
        ("users",          "phone_verified", "INTEGER NOT NULL DEFAULT 0"),
    ]
    with engine.connect() as conn:
        for table, col, col_type in new_columns:
            existing = [
                row[1]
                for row in conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            ]
            if col not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS shock_brands (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                name             TEXT UNIQUE NOT NULL,
                accent_color     TEXT NOT NULL DEFAULT '#a78bfa',
                banner_bg_color  TEXT NOT NULL DEFAULT '#09091a',
                header_image_path TEXT,
                shock_models     TEXT
            )
        """))
        for name, accent, banner_bg, models in SEED_BRANDS:
            conn.execute(
                text("INSERT OR IGNORE INTO shock_brands "
                     "(name, accent_color, banner_bg_color, shock_models) VALUES (:n,:a,:b,:m)"),
                {"n": name, "a": accent, "b": banner_bg, "m": models},
            )

        # Backfill motorcycle_id for existing shock_settings rows
        conn.execute(text("""
            UPDATE shock_settings
            SET motorcycle_id = (
                SELECT motorcycles.id FROM motorcycles
                JOIN profiles ON profiles.id = motorcycles.profile_id
                WHERE profiles.user_id = shock_settings.user_id
                ORDER BY motorcycles.id ASC LIMIT 1
            )
            WHERE motorcycle_id IS NULL AND user_id IS NOT NULL
        """))

        # Backfill motorcycle_id for existing shock_presets rows
        conn.execute(text("""
            UPDATE shock_presets
            SET motorcycle_id = (
                SELECT motorcycles.id FROM motorcycles
                JOIN profiles ON profiles.id = motorcycles.profile_id
                WHERE profiles.user_id = shock_presets.user_id
                ORDER BY motorcycles.id ASC LIMIT 1
            )
            WHERE motorcycle_id IS NULL AND user_id IS NOT NULL
        """))

        # Ensure Profender model list is up to date
        row = conn.execute(text("SELECT shock_models FROM shock_brands WHERE name = 'Profender'")).fetchone()
        if row:
            models = json.loads(row[0] or "[]")
            changed = False
            models = [m for m in models if m not in ("P-Series", "G30", "G2R")]
            for m in ["X-Series+", "X-Series", "Flash"]:
                if m not in models:
                    models.append(m)
                    changed = True
            if changed:
                conn.execute(
                    text("UPDATE shock_brands SET shock_models = :m WHERE name = 'Profender'"),
                    {"m": json.dumps(models)},
                )

        conn.commit()


PROFENDER_X_SERIES_PLUS = json.dumps([
    {"label": "< 50",      "min": 0,   "max": 50,  "preloadMin": 1,  "preloadMax": 3,  "streetCompMin": 3,  "streetCompMax": 9,  "streetRebMin": 3,  "streetRebMax": 9,  "heavyCompMin": 5,  "heavyCompMax": 11, "heavyRebMin": 5,  "heavyRebMax": 11},
    {"label": "50 - 70",   "min": 50,  "max": 70,  "preloadMin": 3,  "preloadMax": 3,  "streetCompMin": 4,  "streetCompMax": 10, "streetRebMin": 4,  "streetRebMax": 10, "heavyCompMin": 6,  "heavyCompMax": 12, "heavyRebMin": 6,  "heavyRebMax": 12},
    {"label": "70 - 90",   "min": 70,  "max": 90,  "preloadMin": 3,  "preloadMax": 5,  "streetCompMin": 5,  "streetCompMax": 11, "streetRebMin": 5,  "streetRebMax": 11, "heavyCompMin": 7,  "heavyCompMax": 13, "heavyRebMin": 7,  "heavyRebMax": 13},
    {"label": "90 - 110",  "min": 90,  "max": 110, "preloadMin": 8,  "preloadMax": 10, "streetCompMin": 6,  "streetCompMax": 12, "streetRebMin": 6,  "streetRebMax": 12, "heavyCompMin": 8,  "heavyCompMax": 14, "heavyRebMin": 8,  "heavyRebMax": 14},
    {"label": "110 - 130", "min": 110, "max": 130, "preloadMin": 10, "preloadMax": 13, "streetCompMin": 7,  "streetCompMax": 13, "streetRebMin": 7,  "streetRebMax": 13, "heavyCompMin": 9,  "heavyCompMax": 15, "heavyRebMin": 9,  "heavyRebMax": 15},
    {"label": "130 - 150", "min": 130, "max": 151, "preloadMin": 20, "preloadMax": 22, "streetCompMin": 8,  "streetCompMax": 14, "streetRebMin": 8,  "streetRebMax": 14, "heavyCompMin": 10, "heavyCompMax": 16, "heavyRebMin": 10, "heavyRebMax": 16},
])


def _migrate_shock_charts():
    """Create shock_charts table and seed known charts (idempotent)."""
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS shock_charts (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                shock_brand TEXT NOT NULL,
                shock_model TEXT,
                chart_data  TEXT NOT NULL,
                UNIQUE(shock_brand, shock_model)
            )
        """))
        # Add moto metadata columns if missing
        existing = [r[1] for r in conn.execute(text("PRAGMA table_info(shock_charts)")).fetchall()]
        for col, col_type in [("moto_make", "TEXT"), ("moto_model", "TEXT"), ("model_year_range", "TEXT")]:
            if col not in existing:
                conn.execute(text(f"ALTER TABLE shock_charts ADD COLUMN {col} {col_type}"))
        # Seed Profender X-Series+ with moto metadata
        conn.execute(
            text("INSERT OR IGNORE INTO shock_charts (shock_brand, shock_model, chart_data) VALUES (:b, :m, :d)"),
            {"b": "Profender", "m": "X-Series+", "d": PROFENDER_X_SERIES_PLUS},
        )
        conn.execute(text("""
            UPDATE shock_charts
            SET moto_make = 'Yamaha', moto_model = 'Grand Filano Hybrid (2018-2022)', model_year_range = '2018-2022'
            WHERE shock_brand = 'Profender' AND shock_model = 'X-Series+' AND moto_make IS NULL
        """))
        conn.commit()


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
                motorcycle_id INTEGER NOT NULL REFERENCES motorcycles(id) ON DELETE CASCADE,
                item_key      TEXT NOT NULL,
                item_name     TEXT NOT NULL,
                interval_km   INTEGER NOT NULL DEFAULT 3000,
                last_done_mileage INTEGER,
                enabled       INTEGER NOT NULL DEFAULT 1,
                UNIQUE(motorcycle_id, item_key)
            )
        """))
        conn.commit()


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


def _migrate_images():
    with engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO maintenance_log_images (log_id, image_path, created_at)
            SELECT id, image_path, created_at FROM maintenance_logs
            WHERE image_path IS NOT NULL
              AND id NOT IN (SELECT DISTINCT log_id FROM maintenance_log_images)
        """))
        conn.execute(text("""
            INSERT INTO fuel_log_images (log_id, image_path, created_at)
            SELECT id, image_path, created_at FROM fuel_logs
            WHERE image_path IS NOT NULL
              AND id NOT IN (SELECT DISTINCT log_id FROM fuel_log_images)
        """))
        conn.commit()
