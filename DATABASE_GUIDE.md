# Database and Data Integrity Guide

**Status:** No database engine, domain tables or migrations are implemented. Supabase/PostgreSQL was an early proposal, not a final decision. Organizer-video notes reportedly favor a local database; verify whether mandatory.

## Database decision gate

| Candidate | Select when | Important detail |
|---|---|---|
| Odoo PostgreSQL + ORM | Official brief requires Odoo-native | Respect mandated version, access controls and record rules |
| Local PostgreSQL | Standalone app allowed and team can set it up | Test actual local connection and migrations |
| Local MySQL | Official guidance or team experience favors it | Verify driver, SQL dialect and migration tooling |
| Supabase/managed PostgreSQL | Permitted and demonstrably useful | Network availability and RLS/authorization are critical |

The lead and Jashwanth record the final engine/version in [DECISIONS.md](DECISIONS.md) before implementing schema.

## Modeling procedure

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

## Authorization

Standalone APIs: enforce database access through trusted backend processes and role checks. Odoo: groups, access rights and record rules. Supabase, only if selected: enable/test RLS for client-visible tables and never expose service-role keys.

## Test evidence to capture

| Check | Required evidence |
|---|---|
| Initialization | Fresh database setup command and result |
| Integrity | Invalid duplicate/foreign-key data rejected |
| Transaction | Partial failure leaves consistent data |
| Authorization | Allowed and denied access verified |
| Migrations | Fresh installation and change path tested |
| Demo data | Synthetic seeds and reset are reproducible |

All checks are currently pending.
