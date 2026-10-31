# Supabase Database Guide

**Database:** Supabase PostgreSQL (15+).  
**Schema source of truth:** versioned SQL migrations under `supabase/migrations/`.  
**Status:** Core catalog schema is codified in `supabase/migrations/20261031000001_catalog.sql` on branch `feature/jashwanth-database`. Inspect the actual Supabase project before applying migrations. Never assume remote state from documentation alone.

## Applied migrations

| Version | Migration file | Tables & objects | Status |
|---|---|---|---|
| `20261031000001` | `20261031000001_catalog.sql` | `products`, `product_variants`, `plans`, `plan_products`, triggers, RLS policies, helper functions (`is_admin`, `is_staff_or_admin`, `update_updated_at_column`) | Verified locally; ready for dev database apply |

---

## Catalog schema specification & backend contract mapping

### 1. `products`
Stores core purchasable catalog items (subscriptions, standalone services, and physical goods).

| Database Column | Data Type | Nullable | Default | Constraints & Rules | Backend Mapping (Pydantic / FastAPI) |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | `id: UUID` |
| `name` | `VARCHAR(255)` | No | — | `NOT NULL`, non-empty | `name: str` |
| `product_type` | `VARCHAR(50)` | No | `'service'` | `CHECK (product_type IN ('service', 'consumable', 'storable'))` | `product_type: str` (API may alias as `type`) |
| `sales_price` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (sales_price >= 0)` | `sales_price: Decimal` |
| `cost_price` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (cost_price >= 0)` | `cost_price: Decimal` |
| `currency` | `VARCHAR(3)` | No | `'INR'` | `CHECK (length(currency) = 3)` | `currency: str = "INR"` |
| `description` | `TEXT` | Yes | `NULL` | Customer-facing summary | `description: Optional[str]` |
| `internal_notes`| `TEXT` | Yes | `NULL` | Internal admin/staff notes | `internal_notes: Optional[str]` |
| `is_active` | `BOOLEAN` | No | `true` | `NOT NULL` | `is_active: bool = True` |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | `created_at: datetime` |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL`, auto-updated by trigger | `updated_at: datetime` |

*Indexes & Triggers:*
- Index: `idx_products_is_active ON products(is_active)`
- Index: `idx_products_product_type ON products(product_type)`
- Trigger: `trg_products_updated_at BEFORE UPDATE` calling `update_updated_at_column()`

---

### 2. `product_variants`
Stores product attributes, SKU codes, and additive pricing adjustments.

| Database Column | Data Type | Nullable | Default | Constraints & Rules | Backend Mapping (Pydantic / FastAPI) |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | `id: UUID` |
| `product_id` | `UUID` | No | — | `REFERENCES products(id) ON DELETE CASCADE` | `product_id: UUID` |
| `attribute_name` | `VARCHAR(100)`| No | — | `CHECK (trim(attribute_name) <> '')` | `attribute_name: str` (backend alias: `variant_name`) |
| `attribute_value`| `VARCHAR(100)`| No | — | `CHECK (trim(attribute_value) <> '')` | `attribute_value: str` (backend alias: `variant_value`) |
| `sku` | `VARCHAR(100)` | Yes | `NULL` | Unique when non-null | `sku: Optional[str]` |
| `price_adjustment`| `NUMERIC(12, 2)`| No| `0.00` | Additive adjustment to `products.sales_price` | `price_adjustment: Decimal` |
| `is_active` | `BOOLEAN` | No | `true` | `NOT NULL` | `is_active: bool = True` |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | `created_at: datetime` |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL`, auto-updated by trigger | `updated_at: datetime` |

*Constraints & Indexes:*
- Unique: `uq_product_variant_attribute UNIQUE (product_id, attribute_name, attribute_value)`
- Partial Index: `idx_product_variants_sku UNIQUE (sku) WHERE sku IS NOT NULL`
- Foreign Key: `idx_product_variants_product_id ON product_variants(product_id)`
- Trigger: `trg_product_variants_updated_at BEFORE UPDATE` calling `update_updated_at_column()`

---

### 3. `plans`
Stores subscription plans, recurrence cycles, term rules, and status.

| Database Column | Data Type | Nullable | Default | Constraints & Rules | Backend Mapping (Pydantic / FastAPI) |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | `id: UUID` |
| `name` | `VARCHAR(255)` | No | — | `NOT NULL`, non-empty | `name: str` |
| `code` | `VARCHAR(50)` | Yes | `NULL` | `UNIQUE`, slug identifier | `code: Optional[str]` |
| `description` | `TEXT` | Yes | `NULL` | Marketing / summary text | `description: Optional[str]` |
| `price` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (price >= 0)` | `price: Decimal` |
| `currency` | `VARCHAR(3)` | No | `'INR'` | `CHECK (length(currency) = 3)` | `currency: str = "INR"` |
| `billing_interval` | `VARCHAR(20)` | No | `'monthly'`| `CHECK (billing_interval IN ('daily', 'weekly', 'monthly', 'yearly'))` | `billing_interval: str` |
| `interval_count` | `INTEGER` | No | `1` | `CHECK (interval_count >= 1)` | `interval_count: int = 1` |
| `minimum_quantity`| `INTEGER` | No | `1` | `CHECK (minimum_quantity >= 1)` | `minimum_quantity: int = 1` |
| `start_date` | `DATE` | Yes | `NULL` | Plan availability start | `start_date: Optional[date]` |
| `end_date` | `DATE` | Yes | `NULL` | `CHECK (end_date IS NULL OR end_date >= start_date)` | `end_date: Optional[date]` |
| `end_of_term_behavior`| `VARCHAR(50)`| No | `'renew'`| `CHECK (end_of_term_behavior IN ('renew', 'close', 'pause'))` | `end_of_term_behavior: str` |
| `status` | `VARCHAR(20)` | No | `'active'` | `CHECK (status IN ('draft', 'active', 'closed', 'archived'))` | `status: str` |
| `is_active` | `BOOLEAN` | No | `true` | `NOT NULL` | `is_active: bool = True` |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | `created_at: datetime` |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL`, auto-updated by trigger | `updated_at: datetime` |

*Indexes & Triggers:*
- Index: `idx_plans_status_is_active ON plans(status, is_active)`
- Index: `idx_plans_billing_interval ON plans(billing_interval)`
- Trigger: `trg_plans_updated_at BEFORE UPDATE` calling `update_updated_at_column()`

---

### 4. `plan_products`
Associates plans with bundled or optional add-on products and variants.

| Database Column | Data Type | Nullable | Default | Constraints & Rules | Backend Mapping (Pydantic / FastAPI) |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | `id: UUID` |
| `plan_id` | `UUID` | No | — | `REFERENCES plans(id) ON DELETE CASCADE` | `plan_id: UUID` |
| `product_id` | `UUID` | No | — | `REFERENCES products(id) ON DELETE RESTRICT` | `product_id: UUID` |
| `product_variant_id`| `UUID` | Yes | `NULL` | `REFERENCES product_variants(id) ON DELETE RESTRICT` | `product_variant_id: Optional[UUID]` |
| `quantity` | `INTEGER` | No | `1` | `CHECK (quantity > 0)` | `quantity: int = 1` |
| `price_override`| `NUMERIC(12, 2)`| Yes | `NULL` | `CHECK (price_override IS NULL OR price_override >= 0)` | `price_override: Optional[Decimal]` |
| `is_optional` | `BOOLEAN` | No | `false` | `NOT NULL` | `is_optional: bool = False` |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | `created_at: datetime` |

*Deletion Integrity & Nullable Variant Uniqueness:*
- `ON DELETE RESTRICT` on both `product_id` and `product_variant_id` ensures that catalog products/variants bundled into an active plan cannot be deleted accidentally, preventing corrupted plan configurations.
- Partial Unique Index 1: `idx_plan_products_variant_unique UNIQUE (plan_id, product_id, product_variant_id) WHERE product_variant_id IS NOT NULL`
- Partial Unique Index 2: `idx_plan_products_base_unique UNIQUE (plan_id, product_id) WHERE product_variant_id IS NULL`

---

## Row Level Security (RLS) & Access Control

All four catalog tables have Row Level Security enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).

### Role-verification helpers
- `is_admin()`: Verifies if the request context carries an admin role. First evaluates JWT claims (`auth.jwt() -> 'app_metadata'` or `'user_metadata'`); if omitted, falls back to `public.profiles` where `id = auth.uid() AND role = 'admin'`.
- `is_staff_or_admin()`: Similar check verifying if the caller has either `admin` or `staff` role.

### Policy matrix

| Table | Policy Name | Command | Target Role | Using / Check Condition |
|---|---|---|---|---|
| `products` | "Allow public and customers to read active products" | `SELECT` | `anon`, `authenticated` | `is_active = true` |
| `products` | "Allow staff and admin to read all products" | `SELECT` | `authenticated` | `is_staff_or_admin()` |
| `products` | "Allow admin to insert/update/delete products" | `INSERT`, `UPDATE`, `DELETE` | `authenticated` | `is_admin()` |
| `product_variants` | "Allow public and customers to read active product variants" | `SELECT` | `anon`, `authenticated` | `is_active = true AND parent product is_active = true` |
| `product_variants` | "Allow staff and admin to read all product variants" | `SELECT` | `authenticated` | `is_staff_or_admin()` |
| `product_variants` | "Allow admin to insert/update/delete product variants" | `INSERT`, `UPDATE`, `DELETE` | `authenticated` | `is_admin()` |
| `plans` | "Allow public and customers to read active plans" | `SELECT` | `anon`, `authenticated` | `is_active = true AND status = 'active' AND currently within date range` |
| `plans` | "Allow staff and admin to read all plans" | `SELECT` | `authenticated` | `is_staff_or_admin()` |
| `plans` | "Allow admin to insert/update/delete plans" | `INSERT`, `UPDATE`, `DELETE` | `authenticated` | `is_admin()` |
| `plan_products` | "Allow public and customers to read active plan products" | `SELECT` | `anon`, `authenticated` | `Parent plan is active` |
| `plan_products` | "Allow staff and admin to read all plan products" | `SELECT` | `authenticated` | `is_staff_or_admin()` |
| `plan_products` | "Allow admin to insert/update/delete plan products" | `INSERT`, `UPDATE`, `DELETE` | `authenticated` | `is_admin()` |

### Grants
- `service_role`: Granted `ALL` privileges on all 4 tables for FastAPI backend service access.
- `anon`, `authenticated`: Granted `SELECT` privileges; writes are prohibited and rejected by RLS.

---

## Future data model targets (Upcoming phases)

### Identity and access
- `profiles`: user UUID referencing Supabase Auth, display name, role, timestamps.
- Roles: controlled values such as `admin`, `staff`, `customer`. Never trust a role sent by the browser.
- Customer/profile association must support ownership checks.

### Tax rules
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

---

## Integrity rules

- UUID primary keys; foreign keys for relationships.
- Use `NUMERIC(p,s)` for money, never floating-point columns.
- Store financial amounts and agreed unit-price/tax snapshots on historical quotation/invoice lines so future catalog edits do not rewrite history.
- Define check constraints for positive quantities, valid discount ranges, allowed status values, and non-negative payment amounts as appropriate.
- Add unique constraints for business references and for recurring invoice uniqueness (subscription + billing period).
- Use transaction-safe operations for invoice creation, discount redemption, and payment recording.
- Prevent duplicate payments on retried requests with an idempotency/reference strategy where available.
- Index actual list filters, ownership FKs, statuses, next billing dates, invoice due dates, and joins after checking query plans.

---

## Authentication, roles and RLS

- Supabase Auth manages credentials, login and password reset.
- Backend verifies the caller's token and checks role and record ownership for every protected operation.
- Apply least-privilege grants and RLS to tables reachable through client roles. Test allowed and denied cases.
- Do not expose a service-role key to the frontend.
- If the frontend uses only FastAPI, document that data-access boundary and still use server-only credentials safely.
- Customers must not read or alter other customers' records by changing an ID.

---

## Migrations and collaboration

1. Inspect existing remote schema and repository migrations before any changes.
2. Make schema changes in a new, ordered SQL migration; do not silently rewrite a migration already applied to a shared database.
3. Review schema changes with backend and frontend owners before merge.
4. Include constraints, indexes, RLS/grants as applicable, and rollback/recovery considerations.
5. Add synthetic seed data only; never commit real customer information.
6. Record the migration command and observed result in the evaluator log only after running it.

---

## Verification checklist

- [x] Versioned SQL migration `20261031000001_catalog.sql` created and validated locally
- [ ] Fresh development database setup applies all migrations in order
- [ ] Duplicate recurring invoice is rejected (Upcoming Phase)
- [x] Foreign-key and check constraints reject invalid data in catalog schema
- [x] Role/ownership allowed and denied policies defined in RLS
- [ ] Role/ownership allowed and denied cases verified against live Supabase development instance
- [ ] Historical invoice totals remain stable after catalog changes
- [ ] Synthetic demo data can be seeded and reset reproducibly
