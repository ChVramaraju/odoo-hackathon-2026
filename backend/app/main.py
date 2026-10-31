"""
Brightloop — ASGI entry point.

Run locally:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

The `app` object is what uvicorn (and test clients) import.
"""

from app.factory import create_app

app = create_app()

