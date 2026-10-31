# Shared AI Coding Rules

These rules apply to ChatGPT, Antigravity, and every other coding assistant used on this repository.

1. Read `PROJECT_STANDARD.md` and the relevant architecture, API, database, and workflow docs first.
2. Use only the approved target stack: React/TypeScript/Vite, FastAPI/Pydantic, Supabase PostgreSQL, and the documented libraries.
3. Do not add a competing framework, database, backend, service, or dependency without explicit review and an entry in `DECISIONS.md`.
4. Inspect the actual branch and files before editing. Preserve existing code and local work. Do not reset, force-push, delete branches, or overwrite another contributor's work.
5. Never invent endpoint paths, fields, tables, enum values, environment names, or implemented behavior. If a contract is missing, propose it and get agreement before relying on it.
6. Keep financial rules in backend domain services; never trust browser totals, roles, discounts, tax values, invoice status, or payment status.
7. Enforce authentication, role checks, and record ownership at the trusted backend boundary. Customer records are isolated by owner.
8. AI assistant code must use approved backend tools only. No arbitrary SQL, model-decided permissions, fabricated plans/prices, or unconfirmed state-changing actions.
9. Keep secrets out of Git. Never expose Supabase service-role/database credentials in frontend code or `VITE_*` variables.
10. Use migrations for schema changes; coordinate with the database owner. Do not silently rewrite already-applied migrations.
11. Write focused tests for critical business rules and report which commands were actually run. Do not claim tests, deployments, or integrations passed without evidence.
12. Keep mocks explicitly labelled and isolated from production data paths.
13. Update API/schema docs and inform affected teammates whenever a shared contract changes.
14. Respect the official challenge requirements. If native Odoo is mandatory, stop and escalate rather than silently implementing the standalone architecture.
15. Use the required handoff format below.

## Handoff format

```text
Task / requirement:
Branch and commit:
Files changed:
Behavior implemented:
Commands actually run:
Tests passed / failed / not run:
API / schema / environment impact:
Known gaps and next owner:
```
