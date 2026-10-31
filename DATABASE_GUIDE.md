# Supabase Database Guide

**Database:** Supabase PostgreSQL.  
**Schema source of truth:** versioned SQL migrations under `supabase/migrations/`.  
**Status:** This guide defines the target data model; inspect the actual Supabase project before applying migrations. Never assume remote state from documentation alone.

## Data model — target entities

### Identity and access
- `profiles`: user UUID referencing Supabase Auth, display name, role, timestamps.
- Roles: controlled values such as `admin`, `staff`, `customer`. Never trust a role sent by the browser.
- Customer/profile association must support ownership checks.

### Catalog
- `products`: name, type, sales price, cost price, notes, active flag.
- `product_variants`: product FK, variant name/value, price adjustment, active flag.
- `plans`: name, price, billing frequency (daily/weekly/monthly/yearly), minimum quantity, availability dates, end-of-term behavior, active/closed status.
- `plan_products`: plan/product association and any configured quantity/price rule.
- `tax_rules`: admin-managed rate, applicability, effective dates, active flag.

### Sales and subscriptions
- `quotation_templates`: reusable quotation settings and validity days.
- `quotations`: unique reference, customer, status, valid-until, totals, created-by.
- `quotation_lines`: quotation, product/variant/plan references, quantity, unit price snapshot, tax snapshot, line total.
- `subscriptions`: unique reference, customer, plan, start/end dates, payment terms, lifecycle status, next billing date, end behavior.
- `subscription_lines`: subscription, product/variant, quantity, agreed unit price snapshot, tax rule/snapshot, line amount.

### Billing
- `discounts`: fixed or percentage value, minimum purchase/quantity, start/end dates, usage limit, scope, active flag.
- `discount_redemptions`: discount, eligible invoice/subscription, redemption timestamp; use constraints to enforce usage limits safely.
- `invoices`: unique reference, customer, optional subscription, billing-period start/end, dates, status, currency, subtotal, tax, discount, total, amount paid, balance.
- `invoice_lines`: invoice, product description snapshot, quantity, unit price, tax snapshot, discount allocation, line total.
- `payments`: invoice FK, method, amount, payment date, note/reference, recorded-by.
- `billing_runs` or equivalent idempotency record: run key, subscription, billing period, outcome and timestamps.
- `audit_logs`: actor, action, entity type/id, timestamp, and safe before/after metadata.

Names are a target proposal. Review actual source and team requirements before creating migrations; document any agreed naming variation.

## Integrity rules

- UUID primary keys; foreign keys for relationships.
- Use `NUMERIC(p,s)` for money, never floating-point columns.
- Store financial amounts and agreed unit-price/tax snapshots on historical quotation/invoice lines so future catalog edits do not rewrite history.
- Define check constraints for positive quantities, valid discount ranges, allowed status values, and non-negative payment amounts as appropriate.
- Add unique constraints for business references and for recurring invoice uniqueness (subscription + billing period).
- Use transaction-safe operations for invoice creation, discount redemption, and payment recording.
- Prevent duplicate payments on retried requests with an idempotency/reference strategy where available.
- Index actual list filters, ownership FKs, statuses, next billing dates, invoice due dates, and joins after checking query plans.

## Authentication, roles and RLS

- Supabase Auth manages credentials, login and password reset.
- Backend verifies the caller's token and checks role and record ownership for every protected operation.
- Apply least-privilege grants and RLS to tables reachable through client roles. Test allowed and denied cases.
- Do not expose a service-role key to the frontend.
- If the frontend uses only FastAPI, document that data-access boundary and still use server-only credentials safely.
- Customers must not read or alter other customers' records by changing an ID.

## Migrations and collaboration

1. Inspect existing remote schema and repository migrations before any changes.
2. Make schema changes in a new, ordered SQL migration; do not silently rewrite a migration already applied to a shared database.
3. Review schema changes with backend and frontend owners before merge.
4. Include constraints, indexes, RLS/grants as applicable, and rollback/recovery considerations.
5. Add synthetic seed data only; never commit real customer information.
6. Record the migration command and observed result in the evaluator log only after running it.

## Verification checklist

- [ ] Fresh database setup can apply all migrations in order
- [ ] Duplicate recurring invoice is rejected
- [ ] Foreign-key and check constraints reject invalid data
- [ ] Role/ownership allowed and denied cases are tested
- [ ] Failed multi-step operations leave consistent data
- [ ] Historical invoice totals remain stable after catalog changes
- [ ] Synthetic demo data can be seeded and reset reproducibly
