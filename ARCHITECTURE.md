# Architecture Guide

## Status
This is a proposed baseline. Final architecture must follow the official problem statement and organizer rules. No application runtime or business domain is assumed yet.

## Principles
- Build one demonstrable end-to-end user journey before expanding scope.
- Prefer a modular monolith over microservices for a four-person hackathon team.
- Keep interfaces explicit so frontend, backend, and database work can proceed in parallel.
- Keep privileged operations on a trusted server.
- Use the simplest architecture that meets the actual requirements.

## Proposed logical layers
1. **Presentation** — React + TypeScript UI if a web frontend is appropriate; owns layout, forms, accessibility, and interaction states.
2. **API/application layer** — FastAPI + Pydantic when custom server-side workflows are needed; validates requests and coordinates domain operations.
3. **Domain logic** — explicit business rules independent of UI rendering and persistence where practical.
4. **Data layer** — Supabase/PostgreSQL by default if allowed; schema, constraints, and migrations are versioned.
5. **External adapters** — AI model APIs, payment sandbox, IoT/MQTT, Odoo APIs, or other services only when justified by the problem statement.

Supabase can serve straightforward data/auth/storage needs directly when RLS and policies are correctly configured. Do not duplicate the same business rules in frontend code, database triggers, and API handlers.

## Typical request flow
Browser UI -> authenticated API or policy-protected Supabase operation -> validation/business rules -> database or external adapter -> structured response -> UI state.

For privileged actions, secrets and authorization checks must remain server-side. Do not trust a client-supplied user ID or role.

## Proposed repository layout
```text
frontend/                 # web UI, if required
backend/                  # FastAPI service, if required
supabase/migrations/      # ordered SQL migrations, if Supabase is selected
docs/                     # optional detailed product/design documents
.github/workflows/        # automated repository checks
README.md                 # canonical entry point
```

Create only the application directories actually needed. If the event requires an Odoo module, use an Odoo-appropriate structure (manifest, models, views, security, data, tests) and document how it integrates with any separate UI/API.

## API conventions
- Prefix custom HTTP endpoints with `/api/v1`.
- Use JSON for ordinary request/response payloads unless a file or streaming protocol is required.
- Validate input and return consistent error shapes.
- Keep secrets and provider credentials on the server.
- See API_CONTRACTS.md.

## Cross-cutting concerns
- Authentication and authorization must be explicit.
- Database constraints protect integrity even when UI validation exists.
- Log operational failures without logging secrets or sensitive payloads.
- Add health/readiness endpoints only when a backend service exists.
- Add tests for the core journey and critical business rules.
- Document environment variables and deployment commands only after they are verified.

## Change control
Record important architecture changes in DECISIONS.md, including context, choice, alternatives, and consequences. Coordinate contract/schema changes before merging parallel work.
