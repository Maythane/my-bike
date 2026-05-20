from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text
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
    _migrate_images()


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
        ("Profender", "#e8251a", "#000000", '["P-Series","G30","G2R"]'),
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
