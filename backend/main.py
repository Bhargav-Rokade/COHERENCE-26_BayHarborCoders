"""
main.py — FastAPI Backend Entry Point

FastAPI server for the Coherence outreach platform.

To run:
  uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import engine, get_db, Base
from models import CompanySettings, Workflow, Lead
from workflow_runner import run_workflow
from leads_router import router as leads_router
from knowledge_base_router import router as kb_router
from seed_workflows import seed_demo_workflows

# Create database tables
Base.metadata.create_all(bind=engine)

# Seed 3 demo workflows on first boot (idempotent)
from database import SessionLocal
_seed_db = SessionLocal()
try:
    seed_demo_workflows(_seed_db)
finally:
    _seed_db.close()

# Pydantic schemas

class WorkflowCreate(BaseModel):
    name: str
    flow_definition: Optional[str] = None

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    flow_definition: Optional[str] = None

class WorkflowRunRequest(BaseModel):
    openai_api_key: Optional[str] = None   # Falls back to OPENAI_API_KEY env var if omitted
    lead_override: Optional[dict] = None

# Create the FastAPI application instance
app = FastAPI(
    title="Coherence API",
    description="AI-powered outreach workflow automation platform",
    version="0.1.0",
)

# ---------------------
# CORS Configuration
# ---------------------
# Allow the Vite dev server (localhost:5173) to make requests to this API.
# Without this, the browser would block frontend → backend requests.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)

# Register routers
app.include_router(leads_router)
app.include_router(kb_router)


# ---------------------
# Health Check
# ---------------------
@app.get("/health")
def health_check():
    """Simple endpoint to verify the server is running."""
    return {"status": "ok"}


@app.get("/api/v1/status")
def api_status():
    """Returns basic API status information."""
    return {
        "status": "ok",
        "version": "0.1.0",
        "modules": {
            "knowledge_base": "initialized",
            "workflow_builder": "initialized",
            "dashboard": "initialized",
            "leads_intelligence": "initialized",
        },
    }

# Knowledge Base API — now handled by knowledge_base_router.py

# ---------------------
# Workflows API
# ---------------------
@app.get("/api/v1/workflows")
def list_workflows(db: Session = Depends(get_db)):
    """List all saved workflows."""
    workflows = db.query(Workflow).all()
    return [
        {"id": w.id, "name": w.name, "updated_at": str(w.updated_at or w.created_at)}
        for w in workflows
    ]

@app.post("/api/v1/workflows")
def create_workflow(data: WorkflowCreate, db: Session = Depends(get_db)):
    """Create a new workflow."""
    wf = Workflow(name=data.name, flow_definition=data.flow_definition)
    db.add(wf)
    db.commit()
    db.refresh(wf)
    return {"id": wf.id, "name": wf.name, "flow_definition": wf.flow_definition}

@app.get("/api/v1/workflows/{workflow_id}")
def get_workflow(workflow_id: int, db: Session = Depends(get_db)):
    """Fetch a single workflow by ID."""
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"id": wf.id, "name": wf.name, "flow_definition": wf.flow_definition}

@app.put("/api/v1/workflows/{workflow_id}")
def update_workflow(workflow_id: int, data: WorkflowUpdate, db: Session = Depends(get_db)):
    """Update an existing workflow's name and/or flow definition."""
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if data.name is not None:
        wf.name = data.name
    if data.flow_definition is not None:
        wf.flow_definition = data.flow_definition
    db.commit()
    db.refresh(wf)
    return {"id": wf.id, "name": wf.name, "flow_definition": wf.flow_definition}

@app.delete("/api/v1/workflows/{workflow_id}")
def delete_workflow(workflow_id: int, db: Session = Depends(get_db)):
    """Delete a workflow by ID."""
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    db.delete(wf)
    db.commit()
    return {"deleted": True}

@app.post("/api/v1/workflows/{workflow_id}/run")
def run_workflow_endpoint(workflow_id: int, body: WorkflowRunRequest, db: Session = Depends(get_db)):
    """
    Execute a saved workflow step by step.
    Returns a structured execution log with each node's output.
    """
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not wf.flow_definition:
        raise HTTPException(status_code=400, detail="Workflow has no flow definition")

    # Resolve API key: body > env var
    api_key = (body.openai_api_key or "").strip() or os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="No OpenAI API key available. Set OPENAI_API_KEY in .env or pass openai_api_key in the request body.")

    # Fetch the company knowledge base (both raw + structured)
    settings = db.query(CompanySettings).first()
    knowledge_base = ""
    kb_structured = {}
    if settings:
        knowledge_base = settings.knowledge_base_text or ""
        kb_structured = {
            "company_description": settings.company_description or "",
            "product_offering":    settings.product_offering or "",
            "target_customers":    settings.target_customers or "",
            "value_proposition":   settings.value_proposition or "",
            "messaging_tone":      settings.messaging_tone or "",
        }

    # Fetch all real leads from the DB
    db_leads = db.query(Lead).order_by(Lead.created_at.desc()).all()
    leads = [
        {
            "id":          l.id,
            "email":       l.email,
            "first_name":  l.first_name,
            "last_name":   l.last_name,
            "company":     l.company,
            "job_title":   l.job_title,
            "industry":    l.industry,
            "country":     l.country,
            "lead_source": l.lead_source,
        }
        for l in db_leads
    ]

    result = run_workflow(
        flow_definition=wf.flow_definition,
        api_key=api_key,
        knowledge_base=knowledge_base,
        kb_structured=kb_structured,
        leads=leads,
    )
    return result
