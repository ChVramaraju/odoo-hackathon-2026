# API and Integration Contracts

**Status:** The audited `main` documentation snapshot does not define implemented domain endpoints. No application source/API call sites were found in the reviewed documentation scaffold. This does not prove that a remote Supabase project has no tables or that other branches have no code. Inventory all current code before claiming coverage.

## First determine the access path
Record which of these is actually implemented:
1. **Browser -> Supabase directly:** document each Supabase Auth call, table/view query, insert/update/delete, RPC, storage operation and realtime subscription. These are network/data API calls even when they are not custom REST endpoints. RLS and grants must be verified.
2. **Browser -> custom backend -> Supabase:** document every HTTP endpoint and the backend's database calls. Keep service-role credentials server-side and avoid duplicated auth/business rules.
3. **Odoo-native:** document controllers/model methods, access groups, record rules and ORM effects as appropriate.

Do not assume a separate FastAPI/custom backend exists. Do not invent endpoints before the confirmed challenge and source code support them.

## Custom HTTP API conventions (proposal only)
- Use a stable base path such as `/api/v1` only if a custom REST API is actually selected.
- Document JSON request/response schemas and timezone-aware ISO 8601 timestamps where relevant.
- Choose status codes consistently (e.g. 200/201, 400, 401, 403, 404, 409, 422 and 500 where appropriate).
- Validate body, path and query values. Enforce authentication and authorization at a trusted boundary.
- Return actionable errors without stack traces, SQL details or secrets.

Example error contract (proposal only):
```json
{"error":{"code":"VALIDATION_ERROR","message":"Please correct the highlighted fields.","details":[]}}
```

## Endpoint / operation template
```text
Requirement ID:
Owner:
Type: HTTP endpoint / Supabase query / Auth / RPC / Storage / Realtime / Odoo model
Method and path or table/function:
Source file and line:
Purpose:
Authentication / allowed roles:
Request fields, filters and constraints:
Success status / result shape:
Failure status / error codes:
Entities read or changed:
RLS/grants or server authorization:
Transaction / idempotency needs:
Test command and observed evidence:
```

## Integration policy
The lead and frontend owner confirm the UI/API contract; the database owner confirms schema effects and RLS. Breaking schema or API changes need review and updated examples/tests before merge. Use synthetic examples only. Do not claim an endpoint or operation exists until found in code and verified.

## Odoo-native adaptation
Use supported Odoo controller methods, models and ORM APIs where appropriate. Document groups, record rules, model methods and inter-module contracts. Do not impose `/api/v1` on an Odoo-native implementation without a real requirement.

## Current contract inventory
| Interface | Status in audited main documentation snapshot | Next action |
|---|---|---|
| Custom HTTP endpoints | None documented or implemented in the reviewed scaffold | Search all branches/source after code is added |
| Supabase client calls | Not evidenced in reviewed source because no application source was present in the audited snapshot | Inspect actual frontend/server source and list each call |
| Supabase Auth | Not verified | Inspect client setup and auth call sites |
| Supabase RPC / Storage / Realtime | Not verified | Search source and document if present |
| Odoo controllers/models | No implementation verified | Only document if required and present |

See [API_CALL_INVENTORY.md](API_CALL_INVENTORY.md) for the call-by-call checklist.
