# Team Workflow and Branch Rules

## Branches

| Branch | Owner / purpose |
|---|---|
| `main` | Stable integration and intended final submission branch, subject to organizer rules |
| `integration` | Shared integration and end-to-end testing |
| `feature/lead-backend` | Ramaraju: FastAPI, domain services, API contracts, integration |
| `feature/sanjeeth-frontend` | Sanjeeth: React UI and API integration |
| `feature/jashwanth-database` | Jashwanth: Supabase schema, migrations, constraints and RLS |
| `feature/nihal-modules` | Nihal: agreed supporting modules and QA |
| `docs/supabase-stack-and-api-audit` | Documentation/audit work; keep synchronized with the shared standard |

## Required reading

Every contributor and AI assistant must read `PROJECT_STANDARD.md`, `README.md`, `ARCHITECTURE.md`, `API_CONTRACTS.md`, `DATABASE_GUIDE.md`, and `AI_RULES.md` before changing shared interfaces.

## Start safely

Run in PowerShell:
```powershell
git status
git branch --show-current
git fetch origin
git status -sb
```

If there are local changes, preserve them. If a pull cannot fast-forward safely, stop and ask the lead. Never run `git reset --hard`, destructive clean commands, force-pushes, or branch deletion to fix a conflict.

## Contract-first implementation

1. Agree entity names, states, request/response schemas, role permissions, and acceptance tests.
2. Database owner prepares a migration; backend owner reviews data access and business constraints.
3. Backend publishes working API schemas/OpenAPI examples.
4. Frontend integrates against those exact schemas; do not create parallel mock contracts.
5. Supporting modules consume shared services and documented interfaces.
6. Integrate continuously and run the end-to-end flow before adding more features.

## Pull request checklist

- [ ] Requirement and owner identified
- [ ] Scope is focused
- [ ] API/schema changes documented and communicated
- [ ] Authorization and customer ownership checked
- [ ] Tests run and actual results stated
- [ ] No secrets, real customer data, or generated local files committed
- [ ] No false claims of completion or performance
- [ ] Reviewer approves before merge

## Suggested MVP sequence

1. Environment, schema migrations, token verification and first API contract.
2. Product/variant/plan CRUD.
3. Quotation and subscription lifecycle.
4. Idempotent due-billing and invoice creation.
5. Payment recording and invoice balance.
6. Role-scoped dashboard and customer portal.
7. AI advisor/read-only assistant and differentiators only after core workflow is stable.
8. Clean setup, end-to-end tests, demo rehearsal and submission checks.

## Submission

Confirm official rules, final branch, video visibility, deadline, and repository visibility with organizer materials. Keep a single coherent final solution branch, but do not merge untested or broken work just to show activity. Preserve attributable contributions and branch history.
