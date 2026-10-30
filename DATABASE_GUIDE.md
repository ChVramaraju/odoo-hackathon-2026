# Database Guide

## Status
Supabase/PostgreSQL is the proposed default, subject to event requirements. No domain schema is prescribed until the problem statement is known.

## Schema principles
- Model the domain from confirmed requirements; avoid speculative tables.
- Use primary keys, foreign keys, NOT NULL, UNIQUE, CHECK constraints, and indexes where they enforce real invariants or query needs.
- Choose types intentionally; do not store structured relationships as comma-separated strings.
- Decide deletion behavior explicitly (restrict, cascade, or soft-delete) based on business rules.
- Store timestamps consistently and define who may create, read, update, and delete each record.
- Add indexes based on expected access patterns, not indiscriminately.

## Migrations
- Store ordered SQL migrations in `supabase/migrations/` if Supabase is selected.
- Treat applied migrations as immutable; add a new migration to change schema.
- Review destructive changes with the team lead and data owner before applying.
- Test migrations against a development project and document required setup.
- Never put real credentials or production data in migration files.
- Coordinate schema changes with API contracts before merging.

## Row Level Security (RLS)
- Enable RLS on tables exposed through Supabase's client-facing APIs.
- Add explicit policies for each required operation and role.
- Test both permitted and denied access cases.
- Do not use a service-role key in frontend code; it bypasses normal RLS protections.
- Do not treat a hidden UI button as access control.

## Data quality and privacy
- Validate critical invariants in the database as well as the application layer where appropriate.
- Use synthetic sample data in development and demos.
- Collect only data needed for the challenge.
- Avoid logging tokens, secrets, or sensitive records.
- Document seed data and reset steps when the application is implemented.

## Database change checklist
- [ ] Requirement and owning module are clear.
- [ ] Schema and constraints reviewed by database owner.
- [ ] API/UI contract impacts are communicated.
- [ ] Migration is ordered and reproducible.
- [ ] RLS/policies and denied-access cases are tested where applicable.
- [ ] Rollback or recovery approach is understood for risky changes.
