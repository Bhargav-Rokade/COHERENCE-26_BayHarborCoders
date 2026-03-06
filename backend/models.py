from sqlalchemy import Column, Integer, String, Text, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from database import Base

class CompanySettings(Base):
    __tablename__ = "company_settings"

    id = Column(Integer, primary_key=True, index=True)
    knowledge_base_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, default="Untitled Workflow")
    # Stores the React Flow JSON (nodes + edges) as a text blob
    flow_definition = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Lead(Base):
    """
    Single flat table for all ingested leads.
    'email' is the unique deduplication key — duplicate emails are skipped on re-upload.
    """
    __tablename__ = "leads"

    id          = Column(Integer, primary_key=True, index=True)
    email       = Column(String(255), unique=True, nullable=False, index=True)  # dedup key
    first_name  = Column(String(100), nullable=True)
    last_name   = Column(String(100), nullable=True)
    company     = Column(String(200), nullable=True)
    job_title   = Column(String(200), nullable=True)
    industry    = Column(String(100), nullable=True)
    country     = Column(String(100), nullable=True)
    lead_source = Column(String(100), nullable=True)
    notes       = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
