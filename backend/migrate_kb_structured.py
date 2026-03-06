"""
migrate_kb_structured.py — Add structured KB columns to company_settings table.

Run once:
    python migrate_kb_structured.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "coherence.db")

COLUMNS_TO_ADD = [
    ("company_description", "TEXT DEFAULT ''"),
    ("product_offering",    "TEXT DEFAULT ''"),
    ("target_customers",    "TEXT DEFAULT ''"),
    ("value_proposition",   "TEXT DEFAULT ''"),
    ("messaging_tone",      "VARCHAR(200) DEFAULT ''"),
]

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get existing columns
    cursor.execute("PRAGMA table_info(company_settings)")
    existing = {row[1] for row in cursor.fetchall()}

    for col_name, col_type in COLUMNS_TO_ADD:
        if col_name not in existing:
            sql = f"ALTER TABLE company_settings ADD COLUMN {col_name} {col_type}"
            print(f"  Adding column: {col_name}")
            cursor.execute(sql)
        else:
            print(f"  Column already exists: {col_name}")

    conn.commit()
    conn.close()
    print("Migration complete!")


if __name__ == "__main__":
    migrate()
