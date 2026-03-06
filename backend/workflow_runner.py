"""
workflow_runner.py — Workflow Execution Engine

Executes a saved React Flow workflow definition step by step.
Each node type has a handler that reads/writes a shared state dict.
AI nodes call OpenAI gpt-4o-mini.

Usage:
    from workflow_runner import run_workflow
    result = run_workflow(flow_definition_json, api_key, knowledge_base, leads)
"""

import json
import random
import time
import os
from datetime import datetime
from typing import Any


# ---------------------------------------------------------------------------
# Topology helpers
# ---------------------------------------------------------------------------

def _build_graph(nodes: list, edges: list) -> dict:
    graph: dict[str, list] = {n["id"]: [] for n in nodes}
    for e in edges:
        src = e.get("source")
        tgt = e.get("target")
        label = e.get("label") or e.get("sourceHandle") or "default"
        if src in graph:
            graph[src].append((tgt, label))
    return graph


def _topological_order(nodes: list, edges: list) -> list[str]:
    in_degree: dict[str, int] = {n["id"]: 0 for n in nodes}
    graph = _build_graph(nodes, edges)
    for src, targets in graph.items():
        for tgt, _ in targets:
            if tgt in in_degree:
                in_degree[tgt] += 1

    queue = [nid for nid, deg in in_degree.items() if deg == 0]
    order = []
    while queue:
        nid = queue.pop(0)
        order.append(nid)
        for tgt, _ in graph.get(nid, []):
            in_degree[tgt] -= 1
            if in_degree[tgt] == 0:
                queue.append(tgt)
    return order


# ---------------------------------------------------------------------------
# Node handlers
# ---------------------------------------------------------------------------

def _call_openai(prompt: str, api_key: str, system: str = "You are an expert AI sales assistant.") -> str:
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            max_tokens=500,
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"[OpenAI error: {e}]"


def handle_trigger(cfg: dict, state: dict, **_) -> dict:
    state["workflow_started"] = True
    state["trigger_type"] = cfg.get("trigger_type", "manual")
    return {"workflow_started": True, "trigger_type": state["trigger_type"]}


def handle_load_lead(cfg: dict, state: dict, leads: list[dict], **_) -> dict:
    """
    Pull a real lead from the DB leads list if available.
    Falls back to config defaults if no leads in the DB.
    """
    lead_index = int(cfg.get("lead_index", 0))

    if leads and lead_index < len(leads):
        raw = leads[lead_index]
        lead = {
            "name": f"{raw.get('first_name', '')} {raw.get('last_name', '')}".strip() or "Lead",
            "first_name": raw.get("first_name", ""),
            "last_name": raw.get("last_name", ""),
            "company": raw.get("company", "Unknown Company"),
            "title": raw.get("job_title", "Professional"),
            "industry": raw.get("industry", "Technology"),
            "email": raw.get("email", ""),
            "country": raw.get("country", ""),
            "lead_source": raw.get("lead_source", ""),
        }
    else:
        # Fallback defaults when no real leads are uploaded yet
        lead = {
            "name": cfg.get("name", "Alex Johnson"),
            "first_name": cfg.get("name", "Alex").split()[0],
            "company": cfg.get("company", "Acme Corp"),
            "title": cfg.get("title", "CTO"),
            "industry": cfg.get("industry", "SaaS"),
            "email": cfg.get("email", "alex@acme.com"),
        }

    state["lead"] = lead
    return {"lead": lead, "source": "database" if leads else "config_defaults"}


def handle_ai_compose(cfg: dict, state: dict, api_key: str, kb: dict, **_) -> dict:
    lead = state.get("lead", {})
    goal = cfg.get("goal", "intro")
    tone = cfg.get("tone", "professional")
    length = cfg.get("length", "short")

    # Use rich structured KB fields for sharper prompts
    company_desc = kb.get("company_description", "") or kb.get("raw", "")
    product = kb.get("product_offering", "")
    value_prop = kb.get("value_proposition", "")
    target_customers = kb.get("target_customers", "")

    context_block = ""
    if company_desc:
        context_block += f"\nCompany: {company_desc}"
    if product:
        context_block += f"\nProduct: {product}"
    if value_prop:
        context_block += f"\nValue Proposition: {value_prop}"
    if target_customers:
        context_block += f"\nIdeal Customer: {target_customers}"

    prompt = (
        f"Write a {length} cold outreach email for goal: '{goal}'. Tone: {tone}.\n"
        f"Lead: {lead.get('name','the lead')} — {lead.get('title','')} at {lead.get('company','')} "
        f"(Industry: {lead.get('industry','')}).\n"
        f"Sender context:{context_block if context_block else ' Not provided.'}\n\n"
        "Write ONLY the email body. No subject line. Start directly."
    )

    message = _call_openai(prompt, api_key)
    state["message"] = message
    return {"message": message}


def handle_personalize(cfg: dict, state: dict, api_key: str, **_) -> dict:
    lead = state.get("lead", {})
    msg = state.get("message", "")
    raw_fields = cfg.get("personalization_fields", "company, industry, role")
    fields = [f.strip() for f in raw_fields.split(",")]

    prompt = (
        f"Personalize the following outreach message. Use these lead fields: {fields}.\n"
        f"Lead info: {json.dumps(lead)}\n\n"
        f"Original message:\n{msg}\n\n"
        "Return ONLY the improved personalized message. Keep it natural and concise."
    )

    personalized = _call_openai(prompt, api_key)
    state["personalized_message"] = personalized
    return {"personalized_message": personalized}


def handle_send_message(cfg: dict, state: dict, **_) -> dict:
    channel = cfg.get("channel", "email")
    msg_field = cfg.get("message_field", "personalized_message")
    message = state.get(msg_field) or state.get("personalized_message") or state.get("message", "(no message)")
    ts = datetime.now().isoformat(timespec="seconds")
    lead = state.get("lead", {})
    state["sent"] = True
    state["sent_at"] = ts
    return {
        "sent": True,
        "channel": channel,
        "timestamp": ts,
        "recipient": lead.get("email") or lead.get("name", "lead"),
        "message_preview": message[:160] + ("…" if len(message) > 160 else ""),
    }


def handle_delay(cfg: dict, state: dict, **_) -> dict:
    delay_type = cfg.get("delay_type", "fixed")
    min_s = int(cfg.get("min_seconds", 1))
    max_s = int(cfg.get("max_seconds", 3))
    wait = random.randint(min_s, max_s) if delay_type == "random" else min_s
    # Cap actual sleep to 3s in simulation so the demo doesn't freeze
    time.sleep(min(wait, 3))
    state["delay_completed"] = True
    return {"delay_completed": True, "simulated_wait_seconds": wait}


def handle_check_reply(cfg: dict, state: dict, **_) -> dict:
    received = random.random() > 0.4
    reply_text = "Thanks for reaching out! I'd like to learn more about this." if received else ""
    state["reply_received"] = received
    state["reply_text"] = reply_text
    return {"reply_received": received, "reply_text": reply_text}


def handle_persona_sim(cfg: dict, state: dict, api_key: str, **_) -> dict:
    persona = cfg.get("persona", "skeptical_cto")
    message = state.get("personalized_message") or state.get("message", "")
    persona_descriptions = {
        "skeptical_cto":    "You are a skeptical CTO. You've seen hundreds of sales pitches. You are direct, busy, and hard to impress. You ask hard technical or business-case questions.",
        "busy_founder":     "You are a startup founder stretched thin. You respond very briefly and only if something directly saves you time or money.",
        "curious_engineer": "You are a curious engineer. You're interested in the tech but need more details before committing to a call.",
    }
    system = persona_descriptions.get(persona, "You are a professional receiving a sales email.")
    prompt = f"You just received this outreach message. Reply as this persona (keep it realistic and short):\n\n{message}"
    reply = _call_openai(prompt, api_key, system=system)
    state["reply"] = reply
    state["reply_text"] = reply
    state["reply_received"] = True
    return {"persona": persona, "simulated_reply": reply}


def handle_ai_analyze(cfg: dict, state: dict, api_key: str, **_) -> dict:
    reply_text = state.get("reply_text") or state.get("reply", "")
    analysis_type = cfg.get("analysis_type", "intent")
    prompt = (
        f"Analyze this reply for {analysis_type}.\n"
        f'Reply: "{reply_text}"\n\n'
        'Respond with ONLY valid JSON: {"intent": "interested|neutral|reject", "confidence": 0.0-1.0, "summary": "one sentence"}'
    )
    raw = _call_openai(prompt, api_key)
    try:
        import re
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        analysis = json.loads(match.group()) if match else {"intent": "neutral", "confidence": 0.5, "summary": raw}
    except Exception:
        analysis = {"intent": "neutral", "confidence": 0.5, "summary": raw}

    state["intent"] = analysis.get("intent", "neutral")
    state["analysis"] = analysis
    return {"analysis": analysis, "intent": state["intent"]}


def handle_condition(cfg: dict, state: dict, **_) -> dict:
    field = cfg.get("condition_field", "intent")
    equals = cfg.get("equals", "interested")
    value = state.get(field, "")
    result = str(value).lower() == str(equals).lower()
    state["branch"] = "true" if result else "false"
    return {
        "condition_field": field,
        "expected": equals,
        "actual": value,
        "branch": state["branch"],
        "result": result,
    }


def handle_lead_score(cfg: dict, state: dict, **_) -> dict:
    score = 0
    breakdown = []
    intent = state.get("intent", "")
    if intent == "interested":
        pts = int(cfg.get("reply_positive", 20))
        score += pts
        breakdown.append(f"Positive reply: +{pts}")
    if state.get("sent"):
        pts = int(cfg.get("message_sent", 5))
        score += pts
        breakdown.append(f"Message sent: +{pts}")
    state["lead_score"] = score
    return {"lead_score": score, "breakdown": breakdown}


def handle_update_status(cfg: dict, state: dict, **_) -> dict:
    status = cfg.get("status", "contacted")
    lead = state.get("lead", {})
    state["lead_status"] = status
    return {
        "lead_status_updated": True,
        "status": status,
        "lead_name": lead.get("name", "Lead"),
    }


# ---------------------------------------------------------------------------
# Node type router
# ---------------------------------------------------------------------------

NODE_HANDLERS = {
    "trigger":       handle_trigger,
    "load_lead":     handle_load_lead,
    "ai_compose":    handle_ai_compose,
    "personalize":   handle_personalize,
    "send_message":  handle_send_message,
    "delay":         handle_delay,
    "check_reply":   handle_check_reply,
    "persona_sim":   handle_persona_sim,
    "ai_analyze":    handle_ai_analyze,
    "condition":     handle_condition,
    "lead_score":    handle_lead_score,
    "update_status": handle_update_status,
    # Legacy aliases
    "ai_generate":   handle_ai_compose,
    "action":        handle_send_message,
    "wait":          handle_delay,
    "end":           handle_update_status,
}


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run_workflow(
    flow_definition: str,
    api_key: str | None = None,
    knowledge_base: str = "",
    kb_structured: dict | None = None,
    leads: list[dict] | None = None,
) -> dict:
    """
    Execute a workflow from its JSON definition string.

    Args:
        flow_definition: JSON string of {nodes, edges}
        api_key:         OpenAI API key (falls back to OPENAI_API_KEY env var)
        knowledge_base:  Raw KB text for backward compat
        kb_structured:   Structured KB dict {company_description, product_offering, ...}
        leads:           List of real lead dicts from the DB

    Returns:
        {"success": bool, "log": [...], "final_state": {...}}
    """
    if not api_key:
        api_key = os.getenv("OPENAI_API_KEY", "")

    # Merge KB: structured fields take priority; fall back to raw text under 'raw' key
    kb: dict = kb_structured or {}
    if knowledge_base and not kb.get("company_description"):
        kb["raw"] = knowledge_base

    leads = leads or []

    try:
        flow = json.loads(flow_definition)
    except json.JSONDecodeError as e:
        return {
            "success": False,
            "log": [{"node_id": "parse", "node_type": "error", "label": "Parse Error", "output": {}, "error": str(e)}],
            "final_state": {},
        }

    nodes: list = flow.get("nodes", [])
    edges: list = flow.get("edges", [])

    if not nodes:
        return {"success": False, "log": [], "final_state": {}, "error": "No nodes in workflow"}

    node_map = {n["id"]: n for n in nodes}
    order = _topological_order(nodes, edges)
    state: dict[str, Any] = {}
    log = []

    for node_id in order:
        node = node_map.get(node_id)
        if not node:
            continue

        data = node.get("data", {})
        node_type = data.get("type", "trigger")
        label = data.get("label", node_type)
        cfg = data.get("config", {})

        handler = NODE_HANDLERS.get(node_type)
        if not handler:
            log.append({
                "node_id": node_id, "node_type": node_type, "label": label,
                "output": {}, "error": f"Unknown node type: {node_type}",
            })
            continue

        try:
            output = handler(cfg=cfg, state=state, api_key=api_key, kb=kb, leads=leads)
            log.append({"node_id": node_id, "node_type": node_type, "label": label, "output": output, "error": None})
        except Exception as e:
            log.append({"node_id": node_id, "node_type": node_type, "label": label, "output": {}, "error": str(e)})
            return {"success": False, "log": log, "final_state": state}

    return {"success": True, "log": log, "final_state": state}
