#!/usr/bin/env python3
"""
migrate_add_users.py
เพิ่ม user_id columns และสร้าง/ใช้ user ที่ระบุเป็นเจ้าของข้อมูลเดิม

รัน (default owner@local / changeme):
  cd backend && DB_PATH=../data/moto.db .venv/bin/python migrate_add_users.py

รัน (กำหนด user เอง):
  cd backend && DB_PATH=../data/moto.db .venv/bin/python migrate_add_users.py \
      --email you@example.com --password yourpassword
"""
import argparse
import os
import sqlite3

DB_PATH = os.environ.get("DB_PATH", "../data/moto.db")

DEFAULT_EMAIL = "owner@local"
DEFAULT_PASSWORD = "changeme"


def migrate(db_path: str, email: str, password: str) -> None:
    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # เพิ่ม users table ถ้ายังไม่มี
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            hashed_password TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)

    # สร้าง user ถ้ายังไม่มี (ถ้ามีอยู่แล้วใช้ id เดิม)
    cur.execute("SELECT id FROM users WHERE email = ?", (email,))
    row = cur.fetchone()
    if not row:
        hashed = pwd_ctx.hash(password)
        cur.execute(
            "INSERT INTO users (email, hashed_password, is_active, created_at) VALUES (?, ?, 1, datetime('now'))",
            (email, hashed),
        )
        cur.execute("SELECT id FROM users WHERE email = ?", (email,))
        row = cur.fetchone()
        print(f"Created user: email={email}")
    else:
        print(f"User already exists: email={email}")

    owner_id = row[0]
    print(f"Owner user id={owner_id}")

    # เพิ่ม user_id column ถ้ายังไม่มี และ assign ข้อมูลเดิม
    for table, col in [
        ("profiles", "user_id"),
        ("settings", "user_id"),
        ("shock_settings", "user_id"),
        ("shock_presets", "user_id"),
    ]:
        cur.execute(f"PRAGMA table_info({table})")
        cols = [r[1] for r in cur.fetchall()]
        if col not in cols:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} INTEGER REFERENCES users(id)")
            print(f"Added {table}.{col}")
        cur.execute(f"UPDATE {table} SET {col} = ? WHERE {col} IS NULL", (owner_id,))
        updated = cur.rowcount
        if updated:
            print(f"Assigned {updated} rows in {table} → user_id={owner_id}")

    conn.commit()
    conn.close()
    print("Migration complete.")
    print(f"Login with: email={email}  password={'(existing)' if row else password}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate My-bike DB to multi-user schema")
    parser.add_argument("--email", default=DEFAULT_EMAIL, help=f"Email for the data owner (default: {DEFAULT_EMAIL})")
    parser.add_argument("--password", default=DEFAULT_PASSWORD, help="Password for new user (ignored if user already exists)")
    parser.add_argument("--db", default=DB_PATH, help=f"Path to SQLite DB (default: {DB_PATH})")
    args = parser.parse_args()

    migrate(args.db, args.email, args.password)
