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

class WorkflowGenerateRequest(BaseModel):
    prompt: str                             # e.g. "Build a follow-up sequence for a startup founder"
    openai_api_key: Optional[str] = None

class WorkflowABTestRequest(BaseModel):
    prompt_a: str
    prompt_b: str
    openai_api_key: Optional[str] = None

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


# ---------------------------------------------------------------------------
# Workflow Generator — Tab B
# ---------------------------------------------------------------------------
WORKFLOW_SCHEMA = """You generate React Flow workflow JSON for an AI outreach automation platform.

Available node types and their config fields:
- trigger: {trigger_type: "manual|new_lead|test_run"}
- load_lead: {lead_index: "0"}
- ai_compose: {goal: "intro|followup|meeting_request|demo_invite", tone: "friendly|professional|technical|casual", length: "short|medium|long"}
- personalize: {personalization_fields: "company, industry, role"}
- send_message: {channel: "email|linkedin|sms", message_field: "message"}
- delay: {delay_type: "fixed|random", min_seconds: "1", max_seconds: "5"}
- check_reply: {check_window_hours: "48"}
- persona_sim: {persona: "skeptical_cto|busy_founder|curious_engineer"}
- ai_analyze: {analysis_type: "intent|sentiment|urgency"}
- condition: {condition_field: "intent", equals: "interested"}
- lead_score: {reply_positive: "20", message_sent: "5"}
- update_status: {status: "contacted|interested|meeting_booked|rejected|nurturing"}

Return ONLY valid JSON with this exact structure:
{
  "nodes": [
    {"id": "n1", "type": "custom", "position": {"x": 60, "y": 200},
     "data": {"type": "trigger", "label": "Trigger", "description": "Start the workflow",
              "iconName": "Zap", "color": "#10b981", "config": {"trigger_type": "manual"}}}
  ],
  "edges": [
    {"id": "e1", "source": "n1", "target": "n2", "animated": true,
     "style": {"stroke": "#6366f1", "strokeWidth": 2}}
  ]
}

Icon names: Zap=trigger, Database=load_lead, Brain=ai_compose, Wand2=personalize,
BarChart2=ai_analyze, Send=send_message, Timer=delay, Eye=check_reply,
Bot=persona_sim, GitBranch=condition, TrendingUp=lead_score, CheckSquare=update_status

Colors: #10b981=trigger, #14b8a6=load_lead, #6366f1=ai_compose, #8b5cf6=personalize,
#a855f7=ai_analyze, #3b82f6=send_message, #f59e0b=delay, #0ea5e9=check_reply,
#ec4899=persona_sim, #f97316=condition, #84cc16=lead_score, #ef4444=update_status

Space nodes 250px apart horizontally starting at x=60. Always start with a trigger node.
Return ONLY the JSON. No markdown, no explanation."""


@app.post("/api/v1/workflows/generate")
def generate_workflow_from_prompt(body: WorkflowGenerateRequest):
    """
    Use GPT-4o-mini to generate a workflow from a plain-language description.
    Returns {nodes, edges} ready to load into React Flow.
    """
    api_key = (body.openai_api_key or "").strip() or os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="No OpenAI API key available.")

    from openai import OpenAI
    import re as _re, json as _json
    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": WORKFLOW_SCHEMA},
            {"role": "user", "content": f"Build a workflow for: {body.prompt}"},
        ],
        max_tokens=1500,
        temperature=0.4,
    )
    raw = response.choices[0].message.content.strip()
    # Strip markdown code fences if present
    raw = _re.sub(r'^```[a-z]*\n?', '', raw, flags=_re.MULTILINE)
    raw = _re.sub(r'```$', '', raw, flags=_re.MULTILINE).strip()
    try:
        flow = _json.loads(raw)
        return {"success": True, "flow": flow}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI returned invalid JSON: {e}. Raw: {raw[:500]}")


# ---------------------------------------------------------------------------
# A/B Test — Tab C
# ---------------------------------------------------------------------------

@app.post("/api/v1/workflows/{workflow_id}/ab-test")
def ab_test_workflow(
    workflow_id: int,
    body: WorkflowABTestRequest,
    db: Session = Depends(get_db),
):
    """
    Run the same saved workflow twice — once with prompt_a injected into the
    ai_compose node, once with prompt_b — and return a GPT verdict on which
    outreach is more effective.
    """
    import json as _json
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not wf.flow_definition:
        raise HTTPException(status_code=400, detail="Workflow has no flow definition")

    api_key = (body.openai_api_key or "").strip() or os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="No OpenAI API key available.")

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

    db_leads = db.query(Lead).order_by(Lead.created_at.desc()).all()
    leads = [
        {"id": l.id, "email": l.email, "first_name": l.first_name,
         "last_name": l.last_name, "company": l.company,
         "job_title": l.job_title, "industry": l.industry,
         "country": l.country, "lead_source": l.lead_source}
        for l in db_leads
    ]

    def _inject_prompt(flow_def: str, custom_prompt: str) -> str:
        """Override the goal in every ai_compose node with the custom prompt text."""
        flow = _json.loads(flow_def)
        for node in flow.get("nodes", []):
            if node.get("data", {}).get("type") == "ai_compose":
                node["data"]["config"]["custom_prompt"] = custom_prompt
        return _json.dumps(flow)

    flow_a = _inject_prompt(wf.flow_definition, body.prompt_a)
    flow_b = _inject_prompt(wf.flow_definition, body.prompt_b)

    result_a = run_workflow(flow_a, api_key, knowledge_base, kb_structured, leads)
    result_b = run_workflow(flow_b, api_key, knowledge_base, kb_structured, leads)

    # Extract the generated messages for comparison
    def _get_message(result: dict) -> str:
        for entry in result.get("log", []):
            if entry.get("node_type") == "ai_compose":
                return entry.get("output", {}).get("message", "")
        return ""

    msg_a = _get_message(result_a)
    msg_b = _get_message(result_b)

    # Ask GPT to judge
    verdict = "Unable to generate verdict."
    if msg_a and msg_b:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        judge_prompt = f"""You are a B2B sales expert evaluating two outreach emails.

=== EMAIL A (Prompt: "{body.prompt_a}") ===
{msg_a}

=== EMAIL B (Prompt: "{body.prompt_b}") ===
{msg_b}

Which email is more likely to get a response? Analyze:
1. Clarity and personalization
2. Value proposition strength
3. Call-to-action effectiveness
4. Overall tone and professionalism

End with a clear verdict: "Winner: Email A" or "Winner: Email B" and explain why in 2-3 sentences."""

        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": judge_prompt}],
            max_tokens=500,
        )
        verdict = resp.choices[0].message.content.strip()

    return {
        "run_a": result_a,
        "run_b": result_b,
        "message_a": msg_a,
        "message_b": msg_b,
        "verdict": verdict,
    }
