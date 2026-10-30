# API and Integration Contracts

**Status:** No domain endpoints have been agreed or implemented. Do not invent endpoints before selecting the official challenge.

## Proposed standalone HTTP conventions

- Base path: `/api/v1` where custom REST APIs are appropriate.
- JSON requests/responses; ISO 8601 timestamps with timezone; stable IDs.
- HTTP status semantics: 200/201 success, 400 malformed, 401 unauthenticated, 403 forbidden, 404 missing, 409 conflict, 422 validation if chosen consistently, 500 unexpected.
- Validate body, path and query values. Enforce authentication and authorization server-side.
- Return actionable errors without stack traces, SQL details or secrets.

Example error contract (proposal only):

```json
{"error":{"code":"VALIDATION_ERROR","message":"Please correct the highlighted fields.","details":[]}}
```

## Endpoint template

```text
Requirement ID:
Owner:
Method and path:
Purpose:
Authentication / allowed roles:
Request fields, constraints and synthetic example:
Success status and response:
Failure status / error codes:
Entities read or changed:
Transaction and idempotency needs:
Contract tests and evidence:
```

## Integration policy

The lead and Sanjeeth confirm the UI/API contract; Jashwanth confirms schema effects. Any breaking schema or API change needs review and updated examples/tests before merge. Use synthetic examples only. Do not claim an endpoint exists until demonstrated.

## Odoo-native adaptation

Use supported Odoo controller methods, models and ORM APIs where appropriate. Document groups, record rules, model methods and inter-module contracts. Do not impose `/api/v1` on an Odoo-native implementation without a real requirement.

## Contract inventory

| Interface | Owner | Status | Evidence |
|---|---|---|---|
| Pending official brief | TBD | Not defined | None |
