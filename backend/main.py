"""
main.py — FastAPI Backend Entry Point

FastAPI server for the Coherence outreach platform.

To run:
  uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import engine, get_db, Base
from models import CompanySettings, Workflow
from workflow_runner import run_workflow
from leads_router import router as leads_router

# Create database tables
Base.metadata.create_all(bind=engine)

# Pydantic schemas
class KnowledgeBaseUpdate(BaseModel):
    content: str

class WorkflowCreate(BaseModel):
    name: str
    flow_definition: Optional[str] = None

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    flow_definition: Optional[str] = None

class WorkflowRunRequest(BaseModel):
    openai_api_key: str
    lead_override: Optional[dict] = None  # optional: override lead fields at run time

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

# ---------------------
# Knowledge Base API
# ---------------------
@app.get("/api/v1/knowledge-base")
def get_knowledge_base(db: Session = Depends(get_db)):
    """Fetch the company knowledge base."""
    # For MVP, we'll just use the first settings row
    settings = db.query(CompanySettings).first()
    if not settings:
        return {"content": ""}
    return {"content": settings.knowledge_base_text or ""}

@app.post("/api/v1/knowledge-base")
def update_knowledge_base(data: KnowledgeBaseUpdate, db: Session = Depends(get_db)):
    """Update the company knowledge base."""
    settings = db.query(CompanySettings).first()
    
    if not settings:
        # Create new if it doesn't exist
        settings = CompanySettings(knowledge_base_text=data.content)
        db.add(settings)
    else:
        # Update existing
        settings.knowledge_base_text = data.content
        
    db.commit()
    db.refresh(settings)
    return {"status": "success", "content": settings.knowledge_base_text}

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

    # Fetch the company knowledge base for AI context
    settings = db.query(CompanySettings).first()
    knowledge_base = settings.knowledge_base_text if settings else ""

    result = run_workflow(
        flow_definition=wf.flow_definition,
        api_key=body.openai_api_key,
        knowledge_base=knowledge_base or "",
    )
    return result
