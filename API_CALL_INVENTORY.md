# API and Database Call Inventory

**Purpose:** One evidence-based list of every application network/API/database operation. Update this file whenever a call site changes. Do not fill it with guessed endpoints.

## Audit scope and current finding
The documentation files reviewed on `main` describe a preparation scaffold and do not contain application source/package manifests or repository migrations to enumerate. Therefore this audit cannot truthfully list implementation call sites yet. This is **not** proof that a remote Supabase project is empty. The developer reports that Supabase is in use; source configuration and remote settings remain to be verified.

## Required call categories
Search all current source and tests for:
- HTTP calls: `fetch`, Axios, generated clients, WebSockets, GraphQL, server route handlers/controllers.
- Supabase initialization and use: `createClient`, `from(...)`, `select`, `insert`, `update`, `upsert`, `delete`, `rpc`, Storage, Realtime.
- Authentication: sign-in/sign-up/sign-out, session/token refresh, user/role lookup, auth-state listeners.
- Backend database access: ORM queries, SQL, migrations, RPC/function calls.
- Odoo controllers, model methods, external API integrations, if present.
- Calls hidden behind wrapper functions or service modules. Trace callers and callees; do not count a wrapper as a separate network call unless it performs one.

## Call inventory
No implementation call sites are marked verified in this documentation-only audit. Add one row per distinct call site (or a clearly referenced grouped family if dynamically generated), with source file and line.

| ID | Source file:line | UI/workflow | Type + method/operation | URL/path/table/RPC | Inputs / filters / fields | Auth context | Response/error handling | Implementation target | Test evidence | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| — | None verified in reviewed documentation snapshot | — | — | — | — | — | — | — | — | Awaiting source audit |

## Required traceability
For each UI-driven operation, trace:
`UI action -> handler -> service/client function -> actual HTTP/Supabase/Odoo operation -> route/database object -> authorization -> response/error -> UI result`.

For every backend operation, trace:
`route/controller -> validation -> authorization -> domain logic -> DB query/transaction -> response/error -> test`.

## Evidence statuses
- **Implemented and tested:** code path exists and a reproducible test was run.
- **Implemented, test pending:** code exists but no test evidence.
- **Documented only:** docs mention it; no implementation found.
- **Broken/mismatched:** caller and implementation disagree.
- **Unverified remote state:** requires authorized inspection of the live Supabase project or deployed environment.
- **Proposed:** not implemented; must not be described as a working feature.

## Completion checklist
- [ ] Enumerate all call sites on the integration/submission branch and relevant feature branches.
- [ ] Match each custom HTTP endpoint to a handler and API contract.
- [ ] Match each Supabase table/view/RPC/Storage/Realtime operation to an actual database object and permission policy.
- [ ] Match each auth call to the expected session/role behavior.
- [ ] Record request/response shapes, errors, timeout/retry behavior and side effects.
- [ ] Check RLS/grants for client-visible objects with allowed and denied tests.
- [ ] Link unit/integration/end-to-end tests and record actual results.
- [ ] Verify the README and API_CONTRACTS.md accurately summarize the inventory.
- [ ] Re-run after any endpoint/schema changes.

Never state “all API calls are documented” until every relevant call site has been enumerated and matched to implementation, permissions, and tests.
