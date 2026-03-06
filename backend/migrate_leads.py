"""Fix: drop and recreate the leads table with correct schema."""
from database import engine
from sqlalchemy import text
from models import Base, Lead

with engine.connect() as conn:
    conn.execute(text("DROP TABLE IF EXISTS leads"))
    conn.commit()
    print("Dropped leads table")

Base.metadata.create_all(bind=engine)
print("Recreated all tables successfully")
