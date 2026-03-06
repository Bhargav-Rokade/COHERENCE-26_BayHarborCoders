"""
leads_router.py — Lead Intelligence Module API

Handles:
  - CSV/Excel upload → SQLite upsert (idempotent on email)
  - Fetching all leads
  - Pandas-powered analytics
  - AI-generated campaign idea suggestions via OpenAI
"""

import io
import json
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models import Lead

router = APIRouter(prefix="/api/v1/leads", tags=["leads"])

# ---------------------
# Pydantic Schemas
# ---------------------

class CampaignRequest(BaseModel):
    openai_api_key: str
    context: Optional[str] = None  # optional extra instructions from the user


# ---------------------
# Helper: parse upload file → DataFrame
# ---------------------

EXPECTED_COLUMNS = {
    "email", "first_name", "last_name", "company",
    "job_title", "industry", "country", "lead_source", "notes"
}

def _parse_file(file: UploadFile) -> pd.DataFrame:
    """Parse a CSV or XLSX UploadFile into a normalised DataFrame."""
    content = file.file.read()
    filename = (file.filename or "").lower()

    if filename.endswith(".xlsx") or filename.endswith(".xls"):
        df = pd.read_excel(io.BytesIO(content), dtype=str)
    elif filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content), dtype=str)
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a .csv or .xlsx file."
        )

    # Normalise column names: lowercase + strip whitespace
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    if "email" not in df.columns:
        raise HTTPException(
            status_code=422,
            detail="File must contain an 'email' column (used as deduplication key)."
        )

    # Fill missing optional columns with None
    for col in EXPECTED_COLUMNS - {"email"}:
        if col not in df.columns:
            df[col] = None

    # Drop rows with no email
    df = df.dropna(subset=["email"])
    df["email"] = df["email"].str.strip().str.lower()
    df = df.replace({float("nan"): None})  # pandas NaN → None for SQLAlchemy

    return df


# ---------------------
# Endpoints
# ---------------------

@router.post("/upload")
async def upload_leads(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a CSV or Excel file of leads.
    Idempotent: rows whose email already exists in the DB are skipped.
    Returns inserted, skipped, and total counts.
    """
    df = _parse_file(file)

    inserted = 0
    skipped = 0

    for _, row in df.iterrows():
        lead = Lead(
            email=row.get("email"),
            first_name=row.get("first_name"),
            last_name=row.get("last_name"),
            company=row.get("company"),
            job_title=row.get("job_title"),
            industry=row.get("industry"),
            country=row.get("country"),
            lead_source=row.get("lead_source"),
            notes=row.get("notes"),
        )
        try:
            db.add(lead)
            db.flush()   # flush to catch IntegrityError per-row
            inserted += 1
        except IntegrityError:
            db.rollback()
            skipped += 1

    db.commit()

    return {
        "status": "success",
        "inserted": inserted,
        "skipped": skipped,
        "total_in_file": inserted + skipped,
    }


@router.get("")
def list_leads(db: Session = Depends(get_db)):
    """Return all leads as a JSON array."""
    leads = db.query(Lead).order_by(Lead.created_at.desc()).all()
    return [
        {
            "id": l.id,
            "email": l.email,
            "first_name": l.first_name,
            "last_name": l.last_name,
            "company": l.company,
            "job_title": l.job_title,
            "industry": l.industry,
            "country": l.country,
            "lead_source": l.lead_source,
            "notes": l.notes,
            "created_at": str(l.created_at) if l.created_at else None,
        }
        for l in leads
    ]


@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    """
    Compute key demographic metrics on the leads table using Pandas.
    Returns aggregated counts useful for the dashboard.
    """
    leads = db.query(Lead).all()

    if not leads:
        return {
            "total_leads": 0,
            "by_industry": [],
            "by_country": [],
            "by_job_title": [],
            "by_lead_source": [],
        }

    # Build DataFrame from ORM results
    df = pd.DataFrame([
        {
            "industry": l.industry,
            "country": l.country,
            "job_title": l.job_title,
            "lead_source": l.lead_source,
        }
        for l in leads
    ])

    def top_counts(series: pd.Series, n: int = 5) -> list:
        """Return top-n value counts as [{label, count}]."""
        vc = series.dropna().value_counts().head(n)
        return [{"label": str(k), "count": int(v)} for k, v in vc.items()]

    return {
        "total_leads": len(df),
        "by_industry": top_counts(df["industry"]),
        "by_country": top_counts(df["country"]),
        "by_job_title": top_counts(df["job_title"]),
        "by_lead_source": top_counts(df["lead_source"]),
    }


@router.delete("/{lead_id}")
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    """Delete a single lead by ID."""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db.delete(lead)
    db.commit()
    return {"deleted": True, "id": lead_id}


@router.post("/campaign-ideas")
async def generate_campaign_ideas(
    body: CampaignRequest,
    db: Session = Depends(get_db),
):
    """
    Analyse all leads in the DB and use OpenAI to suggest a cold outreach campaign.
    The analytics data is summarised and sent as context to GPT-4o.
    """
    try:
        from openai import OpenAI
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="openai package not installed. Run: pip install openai"
        )

    # Build analytics summary to pass to the model
    leads = db.query(Lead).all()
    total = len(leads)
    if total == 0:
        raise HTTPException(
            status_code=400,
            detail="No leads in the database. Upload leads first before generating campaign ideas."
        )

    df = pd.DataFrame([
        {
            "industry": l.industry,
            "country": l.country,
            "job_title": l.job_title,
            "lead_source": l.lead_source,
            "company": l.company,
        }
        for l in leads
    ])

    def top_str(series: pd.Series, n: int = 5) -> str:
        vc = series.dropna().value_counts().head(n)
        return ", ".join([f"{k} ({v})" for k, v in vc.items()])

    summary = f"""
Total leads: {total}
Top industries: {top_str(df['industry'])}
Top countries: {top_str(df['country'])}
Top job titles: {top_str(df['job_title'])}
Lead sources: {top_str(df['lead_source'])}
Top companies: {top_str(df['company'])}
""".strip()

    user_context = f"\n\nAdditional context from user: {body.context}" if body.context else ""

    prompt = f"""You are an expert B2B outreach strategist.
Based on the following lead database summary, design a personalized cold email outreach campaign plan.

Lead Summary:
{summary}{user_context}

Please provide:
1. A short analysis of who these leads are (persona + segment description)
2. A recommended campaign sequence (e.g., 3-step email drip) with subject lines and key message angles for each step
3. The best timing and cadence (days between emails)
4. Any segment-specific personalisation tips (based on industry or job title)
5. One example email for the first touch

Be specific, actionable, and professional."""

    client = OpenAI(api_key=body.openai_api_key)
    response = client.chat.completions.create(
        model="gpt-5-nano",
        messages=[{"role": "user", "content": prompt}]
    )

    idea_text = response.choices[0].message.content

    return {
        "status": "success",
        "lead_summary": summary,
        "campaign_ideas": idea_text,
    }
