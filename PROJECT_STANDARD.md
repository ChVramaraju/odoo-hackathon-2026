# Brightloop Project Standard — Single Source of Truth

**Applies to every contributor, feature branch, AI coding assistant, and pull request.**

This file is the shared project baseline. If another document conflicts with it, update the conflicting document and record the decision in `DECISIONS.md`; do not invent a private alternative.

## 1. Approved target stack

- Frontend: React, TypeScript, Vite.
- Styling/components: Tailwind CSS and shadcn/ui.
- Forms: React Hook Form + Zod.
- Server-state fetching/caching: TanStack Query.
- Backend: Python, FastAPI, Pydantic.
- API: REST JSON, version prefix `/api/v1`, OpenAPI documentation.
- Database: Supabase PostgreSQL.
- Authentication: Supabase Auth; backend verifies tokens and applies role/ownership checks.
- Database changes: reviewed SQL migrations under `supabase/migrations/`.
- Tests: Pytest (backend), Vitest (frontend).
- Git: existing feature branches, small commits, reviewed integration.

No second database, competing API server, alternative frontend framework, or microservice architecture without a reviewed decision.

## 2. Architecture boundaries

1. React renders UI, validates forms for usability, calls the API, and handles loading/error states.
2. FastAPI is the trusted business boundary. It validates requests, verifies identity, checks role and record ownership, invokes domain services, and returns documented responses.
3. Domain services own prices, variants, taxes, discounts, quotation totals, subscription transitions, invoice generation, payment allocation, and reporting calculations.
4. Persistence uses Supabase PostgreSQL with constraints, transactions, indexes, and versioned migrations.
5. The scheduled billing worker calls the same backend/domain services as interactive requests.
6. The AI assistant may use only explicitly approved backend tools. The model never decides authorization and never executes arbitrary SQL.
7. Service-role/database secrets are server-side only. Never place them in the browser bundle, Git, screenshots, or logs.

## 3. Contract rules

- API prefix: `/api/v1`.
- Entity identifiers: UUIDs unless an existing verified schema requires otherwise.
- Timestamps: ISO 8601 with timezone; persist operational timestamps consistently in UTC.
- Money: PostgreSQL `NUMERIC` / Python Decimal; never binary floating point for financial calculations.
- Use consistent pagination, filtering, sorting, and structured error responses.
- Frontend must consume documented response types; do not invent fields or endpoint names.
- API/schema changes require coordination between backend, frontend, and database owners plus updated tests/docs.
- The endpoint list in `API_CONTRACTS.md` is a target contract until implementation and tests prove otherwise.

## 4. Security and data integrity

- Verify Supabase access tokens in the backend.
- Enforce permissions on every protected operation; UI hiding is not authorization.
- Customers may access only their own records.
- Only admins may add staff and manage restricted configuration.
- Staff access must be limited to assigned operational capabilities.
- Use RLS/grants when tables are reachable through client roles; test allowed and denied access.
- Never trust client-supplied role, totals, tax, discount eligibility, invoice status, or payment status.
- Use database constraints and transaction-safe logic.
- Enforce a unique billing-period key so retries cannot duplicate recurring invoices.
- Keep payments as records linked to invoices; maintain an auditable history.

## 5. Shared product scope

Core: products/variants, plans, quotations, subscriptions, taxes, discounts, invoices, payments, role-aware access, and finance dashboard.

Differentiators, only after the core workflow works: subscription health radar, revenue forecast with clear estimates, invoice calculation explainer, retention/renewal insights, audit trail, and role-aware AI plan advisor/read-only business assistant.

## 6. Definition of done

A feature is done only when it:
- uses the shared stack and contract;
- persists real data through the approved path;
- enforces authentication and authorization;
- handles validation, empty, loading, and failure states;
- has relevant tests or documented manual acceptance checks;
- is integrated into the agreed branch;
- has accurate docs and a truthful status entry.

Mocks may support an explicitly labelled UI prototype; they are not evidence of database persistence.

## 7. Odoo requirement gate

The official organizer brief overrides this target architecture. Before implementation, the lead must verify whether native Odoo is mandatory and record the source in `DECISIONS.md`. If it is mandatory, pause standalone implementation and revise the design deliberately. Do not silently mix a native Odoo module with FastAPI/Supabase.
