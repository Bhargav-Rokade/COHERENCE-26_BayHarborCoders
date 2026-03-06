"""
workflow_runner.py — Workflow Execution Engine

Executes a saved React Flow workflow definition step by step.
Each node type has a handler that reads/writes a shared state dict.
AI nodes call OpenAI GPT-4o-mini.

Usage:
    from workflow_runner import run_workflow
    result = run_workflow(flow_definition_json_string, openai_api_key)
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
    """Return adjacency list: node_id -> list of (target_id, edge_label)."""
    graph: dict[str, list] = {n["id"]: [] for n in nodes}
    for e in edges:
        src = e.get("source")
        tgt = e.get("target")
        label = e.get("label", "default")
        if src in graph:
            graph[src].append((tgt, label))
    return graph


def _topological_order(nodes: list, edges: list) -> list[str]:
    """Kahn's algorithm — returns node IDs in execution order."""
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

def _call_openai(prompt: str, api_key: str, system: str = "You are an AI sales assistant.") -> str:
    """Call OpenAI chat completion and return the text response."""
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            max_tokens=400,
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"[OpenAI error: {e}]"


def handle_trigger(cfg: dict, state: dict, **_) -> dict:
    state["workflow_started"] = True
    state["trigger_type"] = cfg.get("trigger_type", "manual")
    return {"workflow_started": True, "trigger_type": state["trigger_type"]}


def handle_load_lead(cfg: dict, state: dict, **_) -> dict:
    lead = {
        "name": cfg.get("name", "Alex Johnson"),
        "company": cfg.get("company", "Acme Corp"),
        "title": cfg.get("title", "CTO"),
        "industry": cfg.get("industry", "SaaS"),
        "email": cfg.get("email", "alex@acme.com"),
    }
    state["lead"] = lead
    return {"lead": lead}


def handle_ai_compose(cfg: dict, state: dict, api_key: str, kb: str, **_) -> dict:
    lead = state.get("lead", {})
    goal = cfg.get("goal", "intro")
    tone = cfg.get("tone", "friendly")
    length = cfg.get("length", "short")
    prompt = (
        f"Write a {length} {tone} cold outreach email for the goal: '{goal}'.\n"
        f"Lead: {lead.get('name','the lead')} — {lead.get('title','')} at {lead.get('company','')} ({lead.get('industry','')}).\n"
        f"Company context: {kb[:600] if kb else 'N/A'}\n"
        "Output ONLY the email body, no subject line."
    )
    message = _call_openai(prompt, api_key)
    state["message"] = message
    return {"message": message}


def handle_personalize(cfg: dict, state: dict, api_key: str, **_) -> dict:
    lead = state.get("lead", {})
    msg = state.get("message", "")
    fields = cfg.get("personalization_fields", ["company", "industry", "role"])
    prompt = (
        f"Personalize the following outreach message for the recipient.\n"
        f"Fields to use: {fields}\n"
        f"Lead info: {json.dumps(lead)}\n"
        f"Original message:\n{msg}\n\n"
        "Return ONLY the improved personalized message."
    )
    personalized = _call_openai(prompt, api_key)
    state["personalized_message"] = personalized
    return {"personalized_message": personalized}


def handle_send_message(cfg: dict, state: dict, **_) -> dict:
    channel = cfg.get("channel", "email")
    msg_field = cfg.get("message_field", "personalized_message")
    message = state.get(msg_field) or state.get("message", "(no message)")
    ts = datetime.now().isoformat(timespec="seconds")
    state["sent"] = True
    state["sent_at"] = ts
    return {"sent": True, "channel": channel, "timestamp": ts, "message_preview": message[:120] + "…"}


def handle_delay(cfg: dict, state: dict, **_) -> dict:
    delay_type = cfg.get("delay_type", "fixed")
    min_s = int(cfg.get("min_seconds", 2))
    max_s = int(cfg.get("max_seconds", 5))
    wait = random.randint(min_s, max_s) if delay_type == "random" else min_s
    # In simulation we just record, not actually sleep long
    time.sleep(min(wait, 2))
    state["delay_completed"] = True
    return {"delay_completed": True, "simulated_wait_seconds": wait}


def handle_check_reply(cfg: dict, state: dict, **_) -> dict:
    # Simulate a reply with 60% probability in demo mode
    received = random.random() > 0.4
    reply_text = "Thanks for reaching out! I'm interested in learning more." if received else ""
    state["reply_received"] = received
    state["reply_text"] = reply_text
    return {"reply_received": received, "reply_text": reply_text}


def handle_persona_sim(cfg: dict, state: dict, api_key: str, **_) -> dict:
    persona = cfg.get("persona", "skeptical_cto")
    message = state.get("personalized_message") or state.get("message", "")
    persona_descriptions = {
        "skeptical_cto": "You are a skeptical CTO who has seen many sales pitches. You are busy, direct, and hard to impress.",
        "busy_founder": "You are a busy startup founder who barely has time for emails. You respond briefly.",
        "curious_engineer": "You are a curious engineer interested in tech solutions but need technical details.",
    }
    system = persona_descriptions.get(persona, "You are a busy professional receiving a sales email.")
    prompt = f"You just received this outreach message. Reply as this persona:\n\n{message}"
    reply = _call_openai(prompt, api_key, system=system)
    state["reply"] = reply
    state["reply_text"] = reply
    state["reply_received"] = True
    return {"persona": persona, "reply": reply}


def handle_ai_analyze(cfg: dict, state: dict, api_key: str, **_) -> dict:
    reply_text = state.get("reply_text") or state.get("reply", "")
    analysis_type = cfg.get("analysis_type", "intent")
    prompt = (
        f"Analyze this reply for {analysis_type}.\n"
        f"Reply: \"{reply_text}\"\n\n"
        "Respond with JSON only: {\"intent\": \"interested|neutral|reject\", \"confidence\": 0.0-1.0, \"summary\": \"one sentence\"}"
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
    return {"condition_field": field, "expected": equals, "actual": value, "branch": state["branch"]}


def handle_lead_score(cfg: dict, state: dict, **_) -> dict:
    rules = cfg.get("score_rules", {"reply_positive": 20, "clicked_link": 10})
    score = 0
    breakdown = []
    intent = state.get("intent", "")
    if intent == "interested":
        pts = rules.get("reply_positive", 20)
        score += pts
        breakdown.append(f"Positive reply: +{pts}")
    if state.get("sent"):
        pts = rules.get("message_sent", 5)
        score += pts
        breakdown.append(f"Message sent: +{pts}")
    state["lead_score"] = score
    return {"lead_score": score, "breakdown": breakdown}


def handle_update_status(cfg: dict, state: dict, **_) -> dict:
    status = cfg.get("status", "contacted")
    state["lead_status"] = status
    return {"lead_status_updated": True, "status": status}


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
    # Legacy aliases from old 6-node palette
    "ai_generate":   handle_ai_compose,
    "action":        handle_send_message,
    "wait":          handle_delay,
    "end":           handle_update_status,
}


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run_workflow(flow_definition: str, api_key: str | None = None, knowledge_base: str = "") -> dict:
    """
    Execute a workflow from its JSON definition string.

    Returns:
        {
            "success": bool,
            "log": [
                {"node_id": ..., "node_type": ..., "label": ..., "output": {...}, "error": None},
                ...
            ],
            "final_state": {...}
        }
    """
    if not api_key:
        api_key = os.getenv("OPENAI_API_KEY", "")

    try:
        flow = json.loads(flow_definition)
    except json.JSONDecodeError as e:
        return {"success": False, "log": [{"node_id": "parse", "node_type": "error", "label": "Parse Error", "output": {}, "error": str(e)}], "final_state": {}}

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
            log.append({"node_id": node_id, "node_type": node_type, "label": label, "output": {}, "error": f"Unknown node type: {node_type}"})
            continue

        try:
            output = handler(cfg=cfg, state=state, api_key=api_key, kb=knowledge_base)
            log.append({"node_id": node_id, "node_type": node_type, "label": label, "output": output, "error": None})
        except Exception as e:
            log.append({"node_id": node_id, "node_type": node_type, "label": label, "output": {}, "error": str(e)})
            # Stop execution on unhandled error
            return {"success": False, "log": log, "final_state": state}

    return {"success": True, "log": log, "final_state": state}
