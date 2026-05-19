#!/usr/bin/env python3
"""
migrate_add_users.py
เพิ่ม user_id columns และสร้าง default user สำหรับข้อมูลเดิม
รัน: cd backend && DB_PATH=../data/moto.db .venv/bin/python migrate_add_users.py
"""
import os
import sqlite3

DB_PATH = os.environ.get("DB_PATH", "../data/moto.db")


def migrate(db_path: str) -> None:
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

    # สร้าง default user (owner ของข้อมูลเดิม) ถ้ายังไม่มี
    cur.execute("SELECT id FROM users WHERE email = 'owner@local'")
    row = cur.fetchone()
    if not row:
        from passlib.context import CryptContext
        hashed = CryptContext(schemes=["bcrypt"], deprecated="auto").hash("changeme")
        cur.execute(
            "INSERT INTO users (email, hashed_password, is_active, created_at) VALUES (?, ?, 1, datetime('now'))",
            ("owner@local", hashed),
        )
    cur.execute("SELECT id FROM users WHERE email = 'owner@local'")
    owner_id = cur.fetchone()[0]
    print(f"Default owner user id={owner_id}")

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
            print(f"Assigned {updated} rows in {table} to owner_id={owner_id}")

    conn.commit()
    conn.close()
    print("Migration complete.")
    print(f"Login with: email=owner@local  password=changeme")
    print("เปลี่ยน password หลัง login ครั้งแรกด้วย")


if __name__ == "__main__":
    migrate(DB_PATH)
