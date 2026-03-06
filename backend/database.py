from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# SQLite database file URL
SQLALCHEMY_DATABASE_URL = "sqlite:///./coherence.db"

# Create the SQLAlchemy engine
# connect_args={"check_same_thread": False} is needed only for SQLite 
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# Create a SessionLocal class where each instance will be a database session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create a Base class to inherit from for SQLAlchemy models
Base = declarative_base()

# Dependency to get a database session for FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
