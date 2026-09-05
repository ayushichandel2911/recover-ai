"""
RecoverAI FastAPI application entrypoint.
"""

from fastapi import FastAPI

from app.config import settings

app = FastAPI(
    title=settings.app_name,
    description="AI-assisted failed payment recovery engine",
    version="0.1.0",
)


@app.get("/health")
def health_check():
    """Basic liveness check."""
    return {
        "status": "ok",
        "app_name": settings.app_name,
        "environment": settings.app_env,
    }