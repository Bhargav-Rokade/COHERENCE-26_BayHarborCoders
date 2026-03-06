"""
main.py — FastAPI Backend Entry Point

A minimal FastAPI server for the Coherence outreach platform.
For the MVP phase, this provides:
  - A health check endpoint
  - CORS configuration for the Vite dev server
  - Placeholder for future API routes

To run:
  uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
        },
    }
