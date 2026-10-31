# Local Setup Guide (Windows-first)

This is the target setup for the approved stack. Commands should be verified against the manifests and source as they are added; documentation alone is not proof that the app is runnable.

## Prerequisites

- Git and repository access
- Node.js LTS and npm
- Python 3.12+ recommended for the new backend (use the exact version pinned by the project once chosen)
- Access to the team's Supabase project
- An editor such as VS Code or Antigravity

## Target repository layout

```text
frontend/
  src/
    components/
    pages/
    features/
    api/
    hooks/
    types/
backend/
  app/
    api/v1/
    core/
    schemas/
    models/
    repositories/
    services/
    workers/
    main.py
  tests/
supabase/
  migrations/
  seed.sql
docs/
.env.example
README.md
PROJECT_STANDARD.md
```

Keep the existing repository history and files. Add directories as implementation begins; do not move or delete existing files without checking dependencies and ownership.

## Environment

1. Copy `.env.example` to a local ignored environment file only when the corresponding code reads those variables.
2. Use the actual variable names referenced by code; update the example when those names are agreed.
3. Frontend may contain only public Supabase URL and publishable/anon key if direct client access is deliberately implemented and RLS/grants are tested.
4. FastAPI-only secrets, service-role keys, database passwords, and AI-provider keys are server-side only.
5. Never commit a real `.env` or paste credentials into issues, chats, logs, or screenshots.

## Setup sequence

1. Inspect current branch and working tree: `git status`, `git branch --show-current`.
2. Install frontend dependencies using the committed lockfile once `frontend/package.json` exists.
3. Create/activate a Python virtual environment and install the committed backend dependency file once it exists.
4. Configure Supabase credentials locally and verify access without printing secrets.
5. Apply reviewed SQL migrations using the team's documented Supabase migration workflow.
6. Start FastAPI and frontend using the actual scripts recorded in their manifests.
7. Open FastAPI's generated OpenAPI docs and compare routes to `API_CONTRACTS.md`.
8. Run backend/frontend tests and the core end-to-end acceptance test.
9. Record actual commands and outcomes in the README/evaluator log.

## Safe Git update

```powershell
git status
git fetch origin
git status -sb
```

Only fast-forward a clean branch when safe. If local changes exist or Git reports divergence, preserve work and ask the lead. Never use destructive reset or force-push to resolve setup issues.

## Readiness checklist

- [ ] Native Odoo requirement verified against official rules
- [ ] Frontend/backend manifests and lockfiles committed
- [ ] Environment variable names match code
- [ ] Supabase schema and RLS/grants reviewed
- [ ] Migrations apply to a fresh test database
- [ ] API docs match actual implementation
- [ ] Core workflow passes with synthetic data
- [ ] Customer ownership denial test passes
- [ ] Billing retry cannot create duplicate invoice
