"""
seed_workflows.py — Seeds 3 pre-built demo workflows into the database.

Called once at server startup. Skips insertion if any named workflow already exists.
Each workflow node carries a pre-filled 'config' dict so they run instantly.
"""

import json
from sqlalchemy.orm import Session
from models import Workflow

# ── helpers ──────────────────────────────────────────────────────────────────

def _node(nid: str, ntype: str, label: str, desc: str, icon: str, color: str, x: float, y: float, cfg: dict) -> dict:
    return {
        "id": nid,
        "type": "custom",
        "position": {"x": x, "y": y},
        "data": {
            "type": ntype,
            "label": label,
            "description": desc,
            "iconName": icon,
            "color": color,
            "config": cfg,
        },
    }

def _edge(eid: str, src: str, tgt: str, src_handle: str | None = None) -> dict:
    e = {
        "id": eid,
        "source": src,
        "target": tgt,
        "animated": True,
        "style": {"stroke": "#6366f1", "strokeWidth": 2},
    }
    if src_handle:
        e["sourceHandle"] = src_handle
    return e


# ── Workflow 1: Cold Start — Simple Outreach (5 nodes, linear) ───────────────

def _wf1_flow() -> str:
    nodes = [
        _node("n1", "trigger",       "Trigger",               "Start the workflow",        "Zap",         "#10b981", 60,   80,  {"trigger_type": "manual"}),
        _node("n2", "load_lead",     "Load Lead Context",     "Fetch lead from dataset",   "Database",    "#14b8a6", 320,  80,  {"lead_index": "0"}),
        _node("n3", "ai_compose",    "AI Outreach Composer",  "Generate outreach with AI", "Brain",       "#6366f1", 580,  80,  {"goal": "intro", "tone": "professional", "length": "short"}),
        _node("n4", "send_message",  "Outreach Sender",       "Send via email / LinkedIn", "Send",        "#3b82f6", 840,  80,  {"channel": "email", "message_field": "message"}),
        _node("n5", "update_status", "Update Lead Status",    "Set pipeline state",        "CheckSquare", "#ef4444", 1100, 80,  {"status": "contacted"}),
    ]
    edges = [
        _edge("e1", "n1", "n2"),
        _edge("e2", "n2", "n3"),
        _edge("e3", "n3", "n4"),
        _edge("e4", "n4", "n5"),
    ]
    return json.dumps({"nodes": nodes, "edges": edges})


# ── Workflow 2: Hyper-Personalized Pacer (6 nodes, delay + personalization) ──

def _wf2_flow() -> str:
    nodes = [
        _node("n1", "trigger",       "Trigger",               "Start the workflow",        "Zap",         "#10b981", 60,   120, {"trigger_type": "manual"}),
        _node("n2", "load_lead",     "Load Lead Context",     "Fetch lead from dataset",   "Database",    "#14b8a6", 300,  120, {"lead_index": "0"}),
        _node("n3", "ai_compose",    "AI Outreach Composer",  "Generate outreach with AI", "Brain",       "#6366f1", 540,  120, {"goal": "meeting_request", "tone": "friendly", "length": "medium"}),
        _node("n4", "personalize",   "Personalization Engine","Tailor message to lead",    "Wand2",       "#8b5cf6", 780,  120, {"personalization_fields": "company, industry, role"}),
        _node("n5", "delay",         "Delay / Pacing",        "Add human-like delay",      "Timer",       "#f59e0b", 1020, 120, {"delay_type": "random", "min_seconds": "1", "max_seconds": "3"}),
        _node("n6", "send_message",  "Outreach Sender",       "Send via email / LinkedIn", "Send",        "#3b82f6", 1260, 120, {"channel": "linkedin", "message_field": "personalized_message"}),
    ]
    edges = [
        _edge("e1", "n1", "n2"),
        _edge("e2", "n2", "n3"),
        _edge("e3", "n3", "n4"),
        _edge("e4", "n4", "n5"),
        _edge("e5", "n5", "n6"),
    ]
    return json.dumps({"nodes": nodes, "edges": edges})


# ── Workflow 3: Agentic Sales Rep (9 nodes, AI branch logic) ─────────────────

def _wf3_flow() -> str:
    nodes = [
        _node("n1", "trigger",       "Trigger",               "Start the workflow",        "Zap",         "#10b981", 60,   200, {"trigger_type": "manual"}),
        _node("n2", "load_lead",     "Load Lead Context",     "Fetch lead from dataset",   "Database",    "#14b8a6", 300,  200, {"lead_index": "0"}),
        _node("n3", "ai_compose",    "AI Outreach Composer",  "Generate outreach with AI", "Brain",       "#6366f1", 540,  200, {"goal": "intro", "tone": "professional", "length": "short"}),
        _node("n4", "send_message",  "Outreach Sender",       "Simulate email send",       "Send",        "#3b82f6", 780,  200, {"channel": "email", "message_field": "message"}),
        _node("n5", "persona_sim",   "Persona Simulator",     "Simulate lead persona reply","Bot",        "#ec4899", 1020, 200, {"persona": "skeptical_cto"}),
        _node("n6", "ai_analyze",    "AI Reply Analyzer",     "Analyze reply sentiment",   "BarChart2",   "#a855f7", 1260, 200, {"analysis_type": "intent"}),
        _node("n7", "condition",     "Conditional Branch",    "Route on condition",        "GitBranch",   "#f97316", 1500, 200, {"condition_field": "intent", "equals": "interested"}),
        _node("n8", "lead_score",    "Lead Scoring",          "Score lead engagement",     "TrendingUp",  "#84cc16", 1740, 80,  {"reply_positive": "30", "message_sent": "5"}),
        _node("n9", "update_status", "Update Lead Status",    "Mark as rejected",          "CheckSquare", "#ef4444", 1740, 320, {"status": "rejected"}),
    ]
    edges = [
        _edge("e1", "n1", "n2"),
        _edge("e2", "n2", "n3"),
        _edge("e3", "n3", "n4"),
        _edge("e4", "n4", "n5"),
        _edge("e5", "n5", "n6"),
        _edge("e6", "n6", "n7"),
        _edge("e7-true",  "n7", "n8", "true"),
        _edge("e7-false", "n7", "n9", "false"),
    ]
    return json.dumps({"nodes": nodes, "edges": edges})


# ── Public entry point ────────────────────────────────────────────────────────

DEMO_WORKFLOWS = [
    ("🚀 Cold Start — Simple Outreach",    _wf1_flow),
    ("✨ Hyper-Personalized Pacer",         _wf2_flow),
    ("🤖 Agentic Sales Rep (AI Branching)", _wf3_flow),
]

def seed_demo_workflows(db: Session) -> None:
    """
    Insert the 3 demo workflows if they don't already exist.
    Idempotent — safe to call on every startup.
    """
    existing_names = {wf.name for wf in db.query(Workflow.name).all()}

    for name, flow_fn in DEMO_WORKFLOWS:
        if name not in existing_names:
            wf = Workflow(name=name, flow_definition=flow_fn())
            db.add(wf)

    db.commit()
