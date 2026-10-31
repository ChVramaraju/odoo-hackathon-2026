# Brightloop — Backend API (FastAPI)

FastAPI business logic and REST API service for Brightloop Subscription Management.

## Prerequisites
- Python 3.12+ (tested on Python 3.13.15, Windows x64)
- Git

## Local Development Setup

1. **Open the backend directory:**
   ```powershell
   Set-Location D:\OdooHackathon\odoo-hackathon-2026\backend
   ```

2. **Create and activate the virtual environment:**
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

3. **Install pinned dependencies:**
   ```powershell
   pip install -r requirements.txt
   ```

4. **Run the automated test suite:**
   ```powershell
   pytest
   ```

5. **Start the local API development server:**
   ```powershell
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

## API Documentation & Endpoints
Once the server is running:
- **Interactive OpenAPI Docs:** [http://localhost:8000/api/docs](http://localhost:8000/api/docs)
- **ReDoc Documentation:** [http://localhost:8000/api/redoc](http://localhost:8000/api/redoc)
- **OpenAPI Schema JSON:** [http://localhost:8000/api/openapi.json](http://localhost:8000/api/openapi.json)
- **Liveness Health Check:** `GET http://localhost:8000/api/v1/health`

