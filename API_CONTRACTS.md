# API Contracts

## Status
No product endpoints are defined yet because the official problem statement is not recorded. Do not implement invented endpoints. Agree on each endpoint's purpose and request/response shape before parallel UI and backend work.

## Conventions for custom HTTP APIs
- Base path: `/api/v1`
- Use nouns for resource paths and HTTP verbs for actions.
- Use JSON unless the endpoint needs uploads, downloads, or streaming.
- Use ISO 8601 timestamps with timezone information; use UTC for server-side storage where practical.
- Validate request bodies, path parameters, query parameters, and authorization.
- Return only fields the caller is permitted to see.
- Never rely on frontend checks as the authorization boundary.

## Suggested response shapes
Success responses should be resource-oriented and documented per endpoint. For errors, use a stable shape such as:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A human-readable explanation",
    "details": []
  }
}
```
Do not expose stack traces, secrets, SQL errors, or internal provider responses to users.

## Contract template
For every endpoint, document:
- Method and path
- Purpose and owning teammate
- Authentication/authorization requirements
- Request fields, types, constraints, and example
- Success status and response example
- Expected validation/business errors
- Data entities touched
- Tests and integration status

## Integration rules
1. Team lead and frontend owner agree the contract before implementation begins.
2. Database owner confirms required entities and constraints.
3. Breaking changes are announced and recorded before merging.
4. Use stable IDs and explicit enum values; do not make the UI infer business meaning from display labels.
5. Do not claim an endpoint exists until it is implemented and tested.

## Supabase usage
For simple direct client operations, use only the public/anon key and enforce appropriate Row Level Security (RLS) policies. Any service-role key or privileged workflow belongs on a trusted server. Do not duplicate business logic across Supabase client calls and FastAPI.
