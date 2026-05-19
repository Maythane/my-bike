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
