import sqlite3
import os
import argparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BRANDS_DIR = os.path.join(SCRIPT_DIR, "static", "brands")
DB_PATH = os.getenv("DB_PATH", "/app/data/moto.db")

SEED_BRANDS = [
    ("Profender", "#e8251a", "#000000", '["P-Series","G30","G2R"]'),
    ("Öhlins",   "#f4a620", "#1a5fb4", '["STX 36","EC 460","TTX GP"]'),
    ("YSS",      "#e01010", "#000000", '["G-Series","Z-Series","ME302"]'),
    ("Stock",    "#a78bfa", "#09091a", "[]"),
]


def col_exists(conn: sqlite3.Connection, table: str, col: str) -> bool:
    return col in [r[1] for r in conn.execute(f"PRAGMA table_info({table})")]


def migrate(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    try:
        # ── shock_settings ──────────────────────────────────────────
        for col, definition in [
            ("motorcycle_id", "INTEGER REFERENCES motorcycles(id)"),
            ("shock_brand",   "TEXT"),
            ("shock_model",   "TEXT"),
        ]:
            if not col_exists(conn, "shock_settings", col):
                conn.execute(f"ALTER TABLE shock_settings ADD COLUMN {col} {definition}")

        # Assign motorcycle_id to existing rows (first bike of that user)
        conn.execute("""
            UPDATE shock_settings
            SET motorcycle_id = (
                SELECT motorcycles.id FROM motorcycles
                JOIN profiles ON profiles.id = motorcycles.profile_id
                WHERE profiles.user_id = shock_settings.user_id
                ORDER BY motorcycles.id ASC LIMIT 1
            )
            WHERE motorcycle_id IS NULL AND user_id IS NOT NULL
        """)

        # ── shock_presets ────────────────────────────────────────────
        for col, definition in [
            ("motorcycle_id", "INTEGER REFERENCES motorcycles(id)"),
            ("shock_brand",   "TEXT"),
            ("shock_model",   "TEXT"),
        ]:
            if not col_exists(conn, "shock_presets", col):
                conn.execute(f"ALTER TABLE shock_presets ADD COLUMN {col} {definition}")

        # Assign motorcycle_id to existing shock_presets rows (first bike of that user)
        conn.execute("""
            UPDATE shock_presets
            SET motorcycle_id = (
                SELECT motorcycles.id FROM motorcycles
                JOIN profiles ON profiles.id = motorcycles.profile_id
                WHERE profiles.user_id = shock_presets.user_id
                ORDER BY motorcycles.id ASC LIMIT 1
            )
            WHERE motorcycle_id IS NULL AND user_id IS NOT NULL
        """)

        # ── users ────────────────────────────────────────────────────
        if not col_exists(conn, "users", "is_admin"):
            conn.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")

        # ── shock_brands ─────────────────────────────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS shock_brands (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT UNIQUE NOT NULL,
                accent_color     TEXT NOT NULL DEFAULT '#a78bfa',
                banner_bg_color  TEXT NOT NULL DEFAULT '#09091a',
                header_image_path TEXT,
                shock_models TEXT
            )
        """)
        for name, accent, banner_bg, models in SEED_BRANDS:
            conn.execute(
                "INSERT OR IGNORE INTO shock_brands "
                "(name, accent_color, banner_bg_color, shock_models) VALUES (?,?,?,?)",
                (name, accent, banner_bg, models),
            )

        # ── static/brands directory ──────────────────────────────────
        os.makedirs(BRANDS_DIR, exist_ok=True)

        conn.commit()
        print("Migration complete.")
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=DB_PATH)
    args = parser.parse_args()
    migrate(args.db)
