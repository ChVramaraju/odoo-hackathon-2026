# Database and Data Integrity Guide

**Status:** The team lead reports that the project is using Supabase. This is the current working direction, but repository configuration and remote Supabase state still need verification. The audited `main` documentation snapshot contains no schema or migration files referenced by the setup docs; do not assume remote schema is empty or correct.

## Immediate rule
Audit the existing Supabase project and repository before installing or configuring a second database. Keep one authoritative source of truth unless official requirements or a documented architecture decision require otherwise.

## Verification checklist
- [ ] Identify Supabase client initialization and package/version from source and lockfiles.
- [ ] Identify environment variable **names** used by code; never paste or commit real values.
- [ ] Determine whether the browser calls Supabase directly or calls a custom backend.
- [ ] Inspect repository migrations, SQL, generated database types, seed scripts and Supabase configuration.
- [ ] Inspect remote tables, views, functions, auth providers and RLS policies in the Supabase dashboard using authorized access; repository inspection alone cannot prove remote state.
- [ ] Confirm official organizer rules permit the chosen persistence/access model.
- [ ] Record the verified project decision and evidence in [DECISIONS.md](DECISIONS.md).

## Data modeling procedure
1. Extract entities and relationships from the selected challenge and primary user journey.
2. Define ownership, roles, allowed operations, required attributes and stable IDs.
3. Add primary/foreign keys, uniqueness, nullability, check constraints and deletion behavior.
4. Plan transactions for multi-step writes and indexes for actual query paths.
5. Review entities with API and UI owners before versioning migrations.
6. Add synthetic seed data, clean initialization and repeatable reset procedures.

## Schema and migrations
- Never fabricate an ER diagram without domain requirements.
- Keep migrations ordered and reproducible; create new migrations rather than silently editing applied ones.
- Review destructive changes; document recovery and backup expectations.
- Use constraints even when frontend validation exists.
- Avoid comma-separated relationships and speculative indexes.
- Keep credentials only in ignored local environment or approved secret storage.
- If the remote project has tables not represented by repository migrations, document the drift before modifying anything.

## Supabase authorization
- Enable and test RLS for every table/view exposed to browser/client roles where applicable.
- Review grants as well as policies; RLS does not replace correct privilege configuration.
- Test both permitted and denied reads/writes for anonymous and authenticated users, plus privileged server access where used.
- Keep service-role keys server-only. Never put them in browser bundles, committed files, screenshots, or `VITE_*` variables.
- Do not treat UI hiding as authorization.
- If a custom backend mediates all database access, document that boundary and still review database credentials and least privilege.

## API and database-call inventory
For every query/mutation/RPC, record: source file and line, table/view/function, operation, selected/changed fields, filters, auth context, expected result/error, related UI action or API route, and test evidence. Keep this inventory synchronized with [API_CONTRACTS.md](API_CONTRACTS.md) and [API_CALL_INVENTORY.md](API_CALL_INVENTORY.md).

## Test evidence to capture
| Check | Required evidence |
|---|---|
| Initialization | Reproducible migration/setup command and result |
| Integrity | Invalid duplicate/foreign-key data rejected |
| RLS | Allowed and denied access verified for relevant roles |
| Transaction | Partial failure leaves consistent data |
| Migrations | Fresh installation and change path tested |
| Demo data | Synthetic seeds and reset are reproducible |

No implementation or remote policy is marked verified by this guide alone.
