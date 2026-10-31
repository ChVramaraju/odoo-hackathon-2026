# Supabase Database Guide

**Database:** Supabase PostgreSQL (15+).  
**Schema source of truth:** versioned SQL migrations under `supabase/migrations/`.  
**Status:** Core catalog, quotations, subscriptions, invoices, and payments schemas are codified in canonical migrations under `supabase/migrations/` on branch `feature/jashwanth-database`. Inspect the actual Supabase project before applying migrations. Never assume remote state from documentation alone.

## Applied migrations

| Version | Migration file | Tables & objects | Status |
|---|---|---|---|
| `20261031000001` | `20261031000001_catalog.sql` | `products`, `product_variants`, `plans`, `plan_products`, triggers, RLS policies, helper functions (`is_admin`, `is_staff_or_admin`, `update_updated_at_column`) | Verified locally; ready for dev database apply |
| `20261031000002` | `20261031000002_quotations.sql` | `quotations`, `quotation_lines`, sequences, status transition triggers, math/rollup triggers, atomic RPC `create_quotation_atomic` | Verified locally; ready for dev database apply |
| `20261031000003` | `20261031000003_subscriptions.sql` | `subscriptions`, `subscription_lines`, sequence `subscription_number_seq`, status transition triggers (`paused_at`, `closed_at`), math/rollup triggers, RLS | Verified locally; ready for dev database apply |
| `20261031000004` | `20261031000004_invoices.sql` | `invoices`, `invoice_lines`, sequence `invoice_number_seq`, recurring idempotency index `uq_invoices_subscription_billing_period`, status triggers, math/balance rollup triggers, RLS | Verified locally; ready for dev database apply |
| `20261031000005` | `20261031000005_payments.sql` | `payments`, sequence `payment_number_seq`, idempotency index `transaction_reference`, concurrency lock and overpayment guard trigger `trg_payments_apply_to_invoice`, automated invoice balance rollup, RLS | Verified locally; ready for dev database apply |

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
| `description` | `TEXT` | Yes | `NULL` | Customer-facing summary (visible to customers & public) | `description: Optional[str]` |
| `internal_notes`| `TEXT` | Yes | `NULL` | Internal admin/staff notes (masked to null for customers) | `internal_notes: Optional[str]` (API alias: `notes`) |
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
| `billing_interval` | `VARCHAR(20)` | No | `'monthly'` | `CHECK (billing_interval IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly'))` | `billing_frequency: str` (API alias: `billing_interval`) |
| `billing_interval_count` | `INTEGER` | No | `1` | `CHECK (billing_interval_count >= 1)` | `billing_interval: int` (API count multiplier) |
| `trial_period_days` | `INTEGER` | No | `0` | `CHECK (trial_period_days >= 0)` | `trial_period_days: int` |
| `status` | `VARCHAR(20)` | No | `'active'` | `CHECK (status IN ('draft', 'active', 'archived'))` | `status: str` |
| `auto_close` | `BOOLEAN` | No | `false` | Close on payment failure | `auto_close: bool` |
| `closable` | `BOOLEAN` | No | `true` | Customer can close early | `closable: bool` |
| `pausable` | `BOOLEAN` | No | `true` | Customer can pause subscription | `pausable: bool` |
| `renewable` | `BOOLEAN` | No | `true` | Auto-renews at end of term | `renewable: bool` |
| `end_of_term_behavior` | `VARCHAR(20)` | No | `'renew'` | `CHECK (end_of_term_behavior IN ('renew', 'close', 'cancel'))` | `end_of_term_behavior: str` |
| `is_active` | `BOOLEAN` | No | `true` | `NOT NULL` | `is_active: bool = True` |
| `start_date` | `DATE` | Yes | `NULL` | Plan validity window start | `start_date: Optional[date]` |
| `end_date` | `DATE` | Yes | `NULL` | `CHECK (end_date IS NULL OR end_date >= start_date)` | `end_date: Optional[date]` |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | `created_at: datetime` |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL`, auto-updated by trigger | `updated_at: datetime` |

*Indexes & Triggers:*
- Index: `idx_plans_is_active ON plans(is_active)`
- Index: `idx_plans_status ON plans(status)`
- Index: `idx_plans_code ON plans(code)`
- Trigger: `trg_plans_updated_at BEFORE UPDATE` calling `update_updated_at_column()`

---

### 4. `plan_products`
Join table connecting plans to included products, quantities, and pricing overrides.

| Database Column | Data Type | Nullable | Default | Constraints & Rules | Backend Mapping (Pydantic / FastAPI) |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | `id: UUID` |
| `plan_id` | `UUID` | No | — | `REFERENCES plans(id) ON DELETE CASCADE` | `plan_id: UUID` |
| `product_id` | `UUID` | No | — | `REFERENCES products(id) ON DELETE CASCADE` | `product_id: UUID` |
| `quantity` | `NUMERIC(10, 2)`| No | `1.00` | `CHECK (quantity > 0)` | `quantity: Decimal` |
| `price_override`| `NUMERIC(12, 2)`| Yes | `NULL` | Optional plan-specific product price | `price_override: Optional[Decimal]` |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | `created_at: datetime` |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL`, auto-updated by trigger | `updated_at: datetime` |

*Constraints & Indexes:*
- Unique: `uq_plan_product UNIQUE (plan_id, product_id)`
- Foreign Key: `idx_plan_products_plan_id ON plan_products(plan_id)`
- Foreign Key: `idx_plan_products_product_id ON plan_products(product_id)`
- Trigger: `trg_plan_products_updated_at BEFORE UPDATE` calling `update_updated_at_column()`

---

## Quotations Schema Specification & Backend Contract Mapping (Migration `20261031000002_quotations.sql`)

### 5. `quotations`
Stores sales quotation headers, customer association, validity windows, lifecycle status, and calculated financial summaries.

| Database Column | Data Type | Nullable | Default | Constraints & Rules | Description / Mapping |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique quotation UUID |
| `quotation_number` | `VARCHAR(64)` | No | `generate_quotation_number()` | `UNIQUE`, `NOT NULL`, e.g. `QT-202610-00001` | Human-readable quotation reference |
| `customer_id` | `UUID` | No | — | `REFERENCES auth.users(id) ON DELETE RESTRICT` | Referenced customer from `auth.users` |
| `plan_id` | `UUID` | Yes | `NULL` | `REFERENCES plans(id) ON DELETE RESTRICT` | Optional header plan anchor (forward compatibility) |
| `status` | `VARCHAR(20)` | No | `'draft'` | `CHECK (status IN ('draft', 'sent', 'confirmed', 'cancelled', 'expired'))` | Quotation lifecycle status |
| `currency` | `VARCHAR(3)` | No | `'INR'` | `CHECK (length(currency) = 3)` | Currency ISO 4217 code |
| `subtotal` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (subtotal >= 0)` | Undiscounted gross total of all lines |
| `discount_total` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (discount_total >= 0)` | Total discounts applied across all lines |
| `tax_total` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (tax_total >= 0)` | Total tax applied across all lines |
| `total_amount` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (total_amount >= 0)` | Authoritative net payable amount (`subtotal - discount + tax`) |
| `valid_until` | `DATE` | Yes | `NULL` | `CHECK (valid_until IS NULL OR valid_until >= CURRENT_DATE)` | Quotation expiration date |
| `notes` | `TEXT` | Yes | `NULL` | — | Customer-visible and operational notes |
| `created_by` | `UUID` | Yes | `NULL` | `REFERENCES auth.users(id) ON DELETE SET NULL` | Creator user ID from `auth.users` |
| `confirmed_at` | `TIMESTAMPTZ` | Yes | `NULL` | Auto-set when `status = 'confirmed'` | Confirmation timestamp |
| `cancelled_at` | `TIMESTAMPTZ` | Yes | `NULL` | Auto-set when `status = 'cancelled'` | Cancellation timestamp |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL`, auto-updated by trigger | Last modification timestamp |

*Indexes & Triggers:*
- Index: `idx_quotations_customer_id ON quotations (customer_id)`
- Index: `idx_quotations_status ON quotations (status)`
- Index: `idx_quotations_valid_until ON quotations (valid_until)`
- Index: `idx_quotations_created_at ON quotations (created_at DESC)`
- Trigger: `trg_quotations_updated_at BEFORE UPDATE` calling `update_updated_at_column()`
- Trigger: `trg_quotations_status_transition BEFORE UPDATE` auto-populating `confirmed_at` / `cancelled_at`

---

### 6. `quotation_lines`
Individual itemized detail rows snapshotting catalog products/variants/plans with agreed unit prices and discount/tax calculations.

| Database Column | Data Type | Nullable | Default | Constraints & Rules | Description / Mapping |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Line item UUID |
| `quotation_id` | `UUID` | No | — | `REFERENCES quotations(id) ON DELETE CASCADE` | Parent quotation reference |
| `line_type` | `VARCHAR(20)` | No | `'product'` | `CHECK (line_type IN ('product', 'plan'))` | Distinguishes product vs plan line |
| `product_id` | `UUID` | Yes | `NULL` | `REFERENCES products(id) ON DELETE RESTRICT` | Referenced product |
| `variant_id` | `UUID` | Yes | `NULL` | `REFERENCES product_variants(id) ON DELETE RESTRICT`| Referenced product variant |
| `plan_id` | `UUID` | Yes | `NULL` | `REFERENCES plans(id) ON DELETE RESTRICT` | Referenced plan |
| `line_number` | `INTEGER` | No | `1` | `CHECK (line_number >= 1)` | Sequence / display order |
| `description` | `TEXT` | No | — | `CHECK (trim(description) <> '')` | Snapshot description at quote creation |
| `quantity` | `NUMERIC(10, 2)`| No | `1.00` | `CHECK (quantity > 0)` | Line item quantity |
| `unit_price` | `NUMERIC(12, 2)`| No | `0.00` | `CHECK (unit_price >= 0)` | Snapshot agreed unit price |
| `discount_percentage`| `NUMERIC(5, 2)` | No | `0.00` | `CHECK (discount_percentage BETWEEN 0 AND 100)` | Line discount percentage |
| `discount_amount` | `NUMERIC(12, 2)`| No | `0.00` | `CHECK (discount_amount >= 0)` | Line discount amount |
| `tax_rate` | `NUMERIC(5, 2)` | No | `0.00` | `CHECK (tax_rate BETWEEN 0 AND 100)` | Applicable tax rate percentage |
| `tax_amount` | `NUMERIC(12, 2)`| No | `0.00` | `CHECK (tax_amount >= 0)` | Calculated tax amount |
| `subtotal` | `NUMERIC(12, 2)`| No | `0.00` | `CHECK (subtotal >= 0)` | Gross amount (`quantity * unit_price`) |
| `line_total` | `NUMERIC(12, 2)`| No | `0.00` | `CHECK (line_total >= 0)` | Net line total (`subtotal - discount + tax`) |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL`, auto-updated by trigger | Last modification timestamp |

*Catalog Deletion Protection & Automated Math Integrity:*
- `ON DELETE RESTRICT` on `product_id`, `variant_id`, and `plan_id` prevents deleting catalog entries that have been quoted, protecting financial audit history.
- `chk_quotation_line_item`: Enforces mutual exclusivity between product and plan line items (`(line_type = 'product' AND product_id IS NOT NULL AND plan_id IS NULL) OR (line_type = 'plan' AND plan_id IS NOT NULL AND product_id IS NULL AND variant_id IS NULL)`).
- `trg_quotation_lines_calculate BEFORE INSERT OR UPDATE`: Automatically synchronizes `line_type` based on referenced catalog entities (`plan` if `plan_id` is set, else `product`), and computes gross `subtotal = round(quantity * unit_price, 2)`, `discount_amount`, `tax_amount`, and net `line_total`.
- `trg_quotation_lines_sync_totals AFTER INSERT OR UPDATE OR DELETE`: Automatically synchronizes aggregated subtotals, discounts, taxes, and total amounts to the parent `quotations` header.

---

### Atomic Quotation Creation RPC (`create_quotation_atomic`)
To guarantee transaction atomicity across quotation header and detail lines without risk of orphaned records:
```sql
create_quotation_atomic(p_header JSONB, p_lines JSONB) RETURNS JSONB
```
- Executes inside a single ACID PostgreSQL transaction block.
- Automatically rolls back the entire quotation if any child line item violates catalog constraints, checks, or foreign keys.
- Granted `EXECUTE` to `authenticated` and `service_role`.

---

## Subscription Schema Specification & Backend Contract Mapping (Migration `20261031000003_subscriptions.sql`)

### 7. `subscriptions`
Stores ongoing recurring subscription contracts, customer ownership, billing cycles, and status.

| Database Column | Data Type | Nullable | Default | Constraints & Rules | Backend Mapping (Pydantic / FastAPI) |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | `id: UUID` |
| `subscription_number` | `VARCHAR(64)` | No | `generate_subscription_number()` | `UNIQUE`, `NOT NULL`, e.g. `SUB-YYYYMM-XXXXXX` | `subscription_number: str` |
| `customer_id` | `UUID` | No | — | `REFERENCES auth.users(id) ON DELETE RESTRICT` | `customer_id: UUID` |
| `plan_id` | `UUID` | Yes | `NULL` | `REFERENCES plans(id) ON DELETE RESTRICT` | `plan_id: Optional[UUID]` |
| `quotation_id` | `UUID` | Yes | `NULL` | `REFERENCES quotations(id) ON DELETE RESTRICT`, unique | `quotation_id: Optional[UUID]` |
| `status` | `VARCHAR(20)` | No | `'active'` | `CHECK (status IN ('draft', 'active', 'paused', 'closed', 'cancelled'))` | `status: SubscriptionStatus` |
| `currency` | `VARCHAR(3)` | No | `'INR'` | `CHECK (length(currency) = 3)` | `currency: str = "INR"` |
| `billing_frequency` | `VARCHAR(20)` | No | `'monthly'` | `CHECK (billing_frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly'))` | `billing_frequency: str` |
| `subtotal` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (subtotal >= 0)` | `subtotal: Decimal` |
| `discount_total` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (discount_total >= 0)` | `discount_total: Decimal` |
| `tax_total` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (tax_total >= 0)` | `tax_total: Decimal` |
| `total_amount` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (total_amount >= 0)` | `total_amount: Decimal` |
| `start_date` | `DATE` | No | `CURRENT_DATE` | Subscription start date | `start_date: date` |
| `end_date` | `DATE` | Yes | `NULL` | `CHECK (end_date IS NULL OR end_date >= start_date)` | `end_date: Optional[date]` |
| `next_billing_date` | `DATE` | No | `CURRENT_DATE` | Next automated billing run date | `next_billing_date: date` |
| `paused_at` | `TIMESTAMPTZ` | Yes | `NULL` | Timestamp when subscription was paused | `paused_at: Optional[datetime]` |
| `closed_at` | `TIMESTAMPTZ` | Yes | `NULL` | Timestamp when subscription was closed | `closed_at: Optional[datetime]` |
| `notes` | `TEXT` | Yes | `NULL` | Contract / customer notes | `notes: Optional[str]` |
| `created_by` | `UUID` | Yes | `NULL` | Creator user ID from `auth.users` | `created_by: Optional[UUID]` |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | `created_at: datetime` |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL`, auto-updated by trigger | `updated_at: datetime` |

*Indexes & Triggers:*
- `idx_subscriptions_customer_id ON subscriptions(customer_id)`
- `idx_subscriptions_status ON subscriptions(status)`
- `idx_subscriptions_next_billing_date ON subscriptions(next_billing_date)`
- `idx_subscriptions_quotation_id ON subscriptions(quotation_id)`
- `idx_subscriptions_plan_id ON subscriptions(plan_id)`
- `trg_subscriptions_updated_at BEFORE UPDATE` calling `update_updated_at_column()`
- `trg_subscriptions_status_transition BEFORE UPDATE` auto-populating `paused_at` and `closed_at`

---

### 8. `subscription_lines`
Stores itemized services, products, or plans attached to a recurring subscription contract.

| Database Column | Data Type | Nullable | Default | Constraints & Rules | Backend Mapping (Pydantic / FastAPI) |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | `id: UUID` |
| `subscription_id` | `UUID` | No | — | `REFERENCES subscriptions(id) ON DELETE CASCADE` | `subscription_id: UUID` |
| `line_type` | `VARCHAR(20)` | No | `'product'` | `CHECK (line_type IN ('product', 'plan'))` | `line_type: SubscriptionLineType` |
| `line_number` | `INTEGER` | No | `1` | `CHECK (line_number >= 1)` | `line_number: int` |
| `product_id` | `UUID` | Yes | `NULL` | `REFERENCES products(id) ON DELETE RESTRICT` | `product_id: Optional[UUID]` |
| `variant_id` | `UUID` | Yes | `NULL` | `REFERENCES product_variants(id) ON DELETE RESTRICT` | `variant_id: Optional[UUID]` |
| `plan_id` | `UUID` | Yes | `NULL` | `REFERENCES plans(id) ON DELETE RESTRICT` | `plan_id: Optional[UUID]` |
| `description` | `VARCHAR(500)` | No | — | Snapshot item description | `description: str` |
| `quantity` | `NUMERIC(10, 2)` | No | `1.00` | `CHECK (quantity > 0)` | `quantity: Decimal` |
| `unit_price` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (unit_price >= 0)` | `unit_price: Decimal` |
| `discount_percentage` | `NUMERIC(5, 2)` | No | `0.00` | `CHECK (discount_percentage BETWEEN 0 AND 100)` | `discount_percentage: Decimal` |
| `discount_amount` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (discount_amount >= 0)` | `discount_amount: Decimal` |
| `tax_rate` | `NUMERIC(5, 2)` | No | `0.00` | `CHECK (tax_rate BETWEEN 0 AND 100)` | `tax_rate: Decimal` |
| `tax_amount` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (tax_amount >= 0)` | `tax_amount: Decimal` |
| `line_total` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (line_total >= 0)` | `line_total: Decimal` |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | `created_at: datetime` |

*Indexes & Triggers:*
- `idx_subscription_lines_sub_id ON subscription_lines(subscription_id)`
- `chk_subscription_line_item CHECK ((line_type = 'product' AND product_id IS NOT NULL AND plan_id IS NULL) OR (line_type = 'plan' AND plan_id IS NOT NULL AND product_id IS NULL AND variant_id IS NULL))`
- `trg_subscription_lines_calculate BEFORE INSERT OR UPDATE`
- `trg_subscription_lines_sync_totals AFTER INSERT OR UPDATE OR DELETE`

---

## Invoices Schema Specification & Backend Contract Mapping (Migration `20261031000004_invoices.sql`)

### 9. `invoices`
Stores customer invoices, billing periods, payment balances, and lifecycle states.

| Database Column | Data Type | Nullable | Default | Constraints & Rules | Backend Mapping (Pydantic / FastAPI) |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | `id: UUID` |
| `invoice_number` | `VARCHAR(64)` | No | `generate_invoice_number()` | `UNIQUE`, `NOT NULL`, e.g. `INV-YYYYMM-XXXXXX` | `invoice_number: str` |
| `customer_id` | `UUID` | No | — | `REFERENCES auth.users(id) ON DELETE RESTRICT` | `customer_id: UUID` |
| `subscription_id` | `UUID` | Yes | `NULL` | `REFERENCES subscriptions(id) ON DELETE SET NULL` | `subscription_id: Optional[UUID]` |
| `quotation_id` | `UUID` | Yes | `NULL` | `REFERENCES quotations(id) ON DELETE SET NULL` | `quotation_id: Optional[UUID]` |
| `status` | `VARCHAR(20)` | No | `'draft'` | `CHECK (status IN ('draft', 'confirmed', 'paid', 'cancelled', 'overdue'))` | `status: InvoiceStatus` |
| `currency` | `VARCHAR(3)` | No | `'INR'` | `CHECK (length(currency) = 3)` | `currency: str = "INR"` |
| `subtotal` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (subtotal >= 0)` | `subtotal: Decimal` |
| `discount_total` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (discount_total >= 0)` | `discount_total: Decimal` |
| `tax_total` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (tax_total >= 0)` | `tax_total: Decimal` |
| `total_amount` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (total_amount >= 0)` | `total_amount: Decimal` |
| `amount_paid` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (amount_paid >= 0)` | `amount_paid: Decimal` |
| `balance` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (balance >= 0)` | `balance: Decimal` |
| `invoice_date` | `DATE` | No | `CURRENT_DATE` | Invoice issue date | `invoice_date: date` |
| `due_date` | `DATE` | No | `CURRENT_DATE + 15` | Payment due date (`due_date >= invoice_date`) | `due_date: date` |
| `billing_period_start` | `DATE` | Yes | `NULL` | Recurring billing cycle start | `billing_period_start: Optional[date]` |
| `billing_period_end` | `DATE` | Yes | `NULL` | Recurring billing cycle end | `billing_period_end: Optional[date]` |
| `confirmed_at` | `TIMESTAMPTZ` | Yes | `NULL` | Timestamp when confirmed | `confirmed_at: Optional[datetime]` |
| `paid_at` | `TIMESTAMPTZ` | Yes | `NULL` | Timestamp when paid in full | `paid_at: Optional[datetime]` |
| `cancelled_at` | `TIMESTAMPTZ` | Yes | `NULL` | Timestamp when cancelled | `cancelled_at: Optional[datetime]` |
| `notes` | `TEXT` | Yes | `NULL` | Customer-visible or operational notes | `notes: Optional[str]` |
| `created_by` | `UUID` | Yes | `NULL` | Creator user ID | `created_by: Optional[UUID]` |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | `created_at: datetime` |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL`, auto-updated by trigger | `updated_at: datetime` |

*Indexes & Unique Constraints:*
- `uq_invoices_subscription_billing_period UNIQUE (subscription_id, billing_period_start, billing_period_end) WHERE status <> 'cancelled'` (Guarantees recurring billing idempotency)
- `uq_invoices_quotation_id UNIQUE (quotation_id) WHERE quotation_id IS NOT NULL AND status <> 'cancelled'`
- `idx_invoices_customer_id ON invoices(customer_id)`
- `idx_invoices_status ON invoices(status)`
- `idx_invoices_due_date ON invoices(due_date)`
- `idx_invoices_subscription_id ON invoices(subscription_id)`
- `trg_invoices_updated_at BEFORE UPDATE` calling `update_updated_at_column()`
- `trg_invoices_status_transition BEFORE UPDATE` auto-populating timestamps

---

### 10. `invoice_lines`
Stores itemized product/plan lines with historical pricing, discount, and tax snapshots.

| Database Column | Data Type | Nullable | Default | Constraints & Rules | Backend Mapping (Pydantic / FastAPI) |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | `id: UUID` |
| `invoice_id` | `UUID` | No | — | `REFERENCES invoices(id) ON DELETE CASCADE` | `invoice_id: UUID` |
| `line_type` | `VARCHAR(20)` | No | `'product'` | `CHECK (line_type IN ('product', 'plan'))` | `line_type: InvoiceLineType` |
| `line_number` | `INTEGER` | No | `1` | `CHECK (line_number >= 1)` | `line_number: int` |
| `product_id` | `UUID` | Yes | `NULL` | `REFERENCES products(id) ON DELETE RESTRICT` | `product_id: Optional[UUID]` |
| `variant_id` | `UUID` | Yes | `NULL` | `REFERENCES product_variants(id) ON DELETE RESTRICT` | `variant_id: Optional[UUID]` |
| `plan_id` | `UUID` | Yes | `NULL` | `REFERENCES plans(id) ON DELETE RESTRICT` | `plan_id: Optional[UUID]` |
| `description` | `VARCHAR(500)` | No | — | Snapshot item description | `description: str` |
| `quantity` | `NUMERIC(10, 2)` | No | `1.00` | `CHECK (quantity > 0)` | `quantity: Decimal` |
| `unit_price` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (unit_price >= 0)` | `unit_price: Decimal` |
| `discount_percentage` | `NUMERIC(5, 2)` | No | `0.00` | `CHECK (discount_percentage BETWEEN 0 AND 100)` | `discount_percentage: Decimal` |
| `discount_amount` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (discount_amount >= 0)` | `discount_amount: Decimal` |
| `tax_rate` | `NUMERIC(5, 2)` | No | `0.00` | `CHECK (tax_rate BETWEEN 0 AND 100)` | `tax_rate: Decimal` |
| `tax_amount` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (tax_amount >= 0)` | `tax_amount: Decimal` |
| `line_total` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (line_total >= 0)` | `line_total: Decimal` |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | `created_at: datetime` |

*Indexes & Constraints:*
- `idx_invoice_lines_invoice_id ON invoice_lines(invoice_id)`
- Mutual exclusivity check: `chk_invoice_line_item CHECK ((line_type = 'product' AND product_id IS NOT NULL AND plan_id IS NULL) OR (line_type = 'plan' AND plan_id IS NOT NULL AND product_id IS NULL AND variant_id IS NULL))`
- `trg_invoice_lines_calculate BEFORE INSERT OR UPDATE`
- `trg_invoice_lines_sync_totals AFTER INSERT OR UPDATE OR DELETE`

---

## Payments Schema Specification & Backend Contract Mapping (Migration `20261031000005_payments.sql`)

### 11. `payments`
Stores recorded financial payment transactions applied to customer invoices with idempotency and balance enforcement.

| Database Column | Data Type | Nullable | Default | Constraints & Rules | Backend Mapping (Pydantic / FastAPI) |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | `id: UUID` |
| `payment_number` | `VARCHAR(64)` | No | `generate_payment_number()` | `UNIQUE`, `NOT NULL`, e.g. `PAY-YYYYMM-XXXXXX` | `payment_number: str` |
| `invoice_id` | `UUID` | No | — | `REFERENCES invoices(id) ON DELETE RESTRICT` | `invoice_id: UUID` |
| `customer_id` | `UUID` | No | — | `REFERENCES auth.users(id) ON DELETE RESTRICT` | `customer_id: UUID` |
| `amount` | `NUMERIC(12, 2)` | No | — | `CHECK (amount > 0)` | `amount: Decimal` |
| `currency` | `VARCHAR(3)` | No | `'INR'` | `CHECK (length(currency) = 3)` | `currency: str = "INR"` |
| `payment_method` | `VARCHAR(50)` | No | `'manual'` | `CHECK (payment_method IN ('card', 'bank_transfer', 'upi', 'net_banking', 'manual', 'cash'))` | `payment_method: PaymentMethod` |
| `payment_status` | `VARCHAR(20)` | No | `'completed'` | `CHECK (payment_status IN ('completed', 'pending', 'failed', 'refunded'))` | `payment_status: PaymentStatus` |
| `payment_date` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | `payment_date: datetime` |
| `transaction_reference` | `VARCHAR(100)` | Yes | `NULL` | External transaction ID, UTR, or gateway charge reference | `transaction_reference: Optional[str]` |
| `idempotency_key` | `VARCHAR(100)` | Yes | `NULL` | `UNIQUE` client key for duplicate submission prevention | `idempotency_key: Optional[str]` |
| `notes` | `TEXT` | Yes | `NULL` | — | `notes: Optional[str]` |
| `recorded_by` | `UUID` | Yes | `NULL` | `REFERENCES auth.users(id) ON DELETE SET NULL` | `recorded_by: Optional[UUID]` |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | `created_at: datetime` |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL`, auto-updated by trigger | `updated_at: datetime` |

*Indexes & Concurrency Protection:*
- `idx_payments_invoice_id ON payments (invoice_id)`
- `idx_payments_customer_id ON payments (customer_id)`
- `idx_payments_status ON payments (payment_status)`
- `idx_payments_payment_date ON payments (payment_date DESC)`
- `idx_payments_transaction_ref ON payments (transaction_reference) WHERE transaction_reference IS NOT NULL`
- `idx_payments_idempotency_key UNIQUE (idempotency_key) WHERE idempotency_key IS NOT NULL`
- `trg_payments_updated_at BEFORE UPDATE` calling `update_updated_at_column()`
- `trg_payments_apply_to_invoice AFTER INSERT OR UPDATE OR DELETE`:
  - Acquires `FOR UPDATE` lock on the parent invoice to prevent concurrent overpayments.
  - Aggregates completed payments: `COALESCE(SUM(amount), 0.00) WHERE invoice_id = ... AND payment_status = 'completed'`.
  - Enforces overpayment constraint: raises `check_violation` if total completed payments exceed invoice total amount.
  - Automatically synchronizes `invoices.amount_paid` and `invoices.balance = greatest(0.00, total_amount - amount_paid)`.
  - Transitions `invoices.status = 'paid'` and sets `paid_at = now()` when balance reaches 0.00.
  - Safely rolls back status to `confirmed` and resets `paid_at` if a payment is refunded or voided.
- Security Invariant: Zero raw card numbers, CVVs, expiration dates, or bank account credentials are stored in the database.

---

### Atomic Payment Settlement RPC (`record_payment_atomic`)
To guarantee that payment recording and invoice balance decrement occur atomically under concurrent access:
```sql
record_payment_atomic(p_payment JSONB) RETURNS JSONB
```
- Executes inside a single transaction with `SELECT ... FOR UPDATE` row-level lock on `invoices`.
- Checks `idempotency_key`: if previously recorded with identical parameters, returns existing payment record safely; if parameters conflict, raises `unique_violation` (409 Conflict).
- Validates invoice state (cannot pay cancelled or already paid invoice), currency match, and overpayment guard (`amount <= balance`).
- Inserts row into `payments` and synchronizes parent invoice totals and status.
- Granted `EXECUTE` to `authenticated` and `service_role`.

---

## Row Level Security (RLS) Policy Master Summary

| Table | Policy Name | Command | Target Role | Using / Check Condition |
|---|---|---|---|---|
| `products` | "Allow public read access to active products" | `SELECT` | `anon, authenticated` | `is_active = true` |
| `products` | "Allow staff and admin to view all products" | `SELECT` | `authenticated` | `is_staff_or_admin()` |
| `products` | "Allow admin to manage products" | `ALL` | `authenticated` | `is_admin()` |
| `quotations` | "Allow staff and admin to view all quotations" | `SELECT` | `authenticated` | `is_staff_or_admin()` |
| `quotations` | "Allow customers to view their own quotations" | `SELECT` | `authenticated` | `customer_id = auth.uid() AND (status IN ('sent', 'confirmed', 'cancelled') OR created_by = auth.uid())` |
| `quotations` | "Allow staff and admin to insert quotations" | `INSERT` | `authenticated` | `is_staff_or_admin()` |
| `quotations` | "Allow customers to create draft quotations" | `INSERT` | `authenticated` | `customer_id = auth.uid() AND status = 'draft'` |
| `quotations` | "Allow staff and admin to update quotations" | `UPDATE` | `authenticated` | `is_staff_or_admin()` |
| `quotations` | "Allow customers to update their own quotations" | `UPDATE` | `authenticated` | `customer_id = auth.uid()` on own drafts or confirming sent quotes |
| `quotations` | "Allow admin to delete draft or cancelled quotations" | `DELETE` | `authenticated` | `is_admin() AND status IN ('draft', 'cancelled')` |
| `quotation_lines` | "Allow callers to view lines of accessible quotations" | `SELECT` | `authenticated` | `EXISTS (SELECT 1 FROM quotations q WHERE q.id = quotation_lines.quotation_id)` |
| `quotation_lines` | "Allow staff and admin to insert/update/delete lines" | `ALL` | `authenticated` | `is_staff_or_admin()` |
| `quotation_lines` | "Allow customers to insert lines on own draft" | `INSERT` | `authenticated` | Customer owns parent quotation (`customer_id = auth.uid()`), and parent `status = 'draft'` |
| `subscriptions` | "Allow staff and admin to view all subscriptions" | `SELECT` | `authenticated` | `is_staff_or_admin()` |
| `subscriptions` | "Allow customers to view their own subscriptions" | `SELECT` | `authenticated` | `customer_id = auth.uid()` |
| `subscriptions` | "Allow staff and admin to insert subscriptions" | `INSERT` | `authenticated` | `is_staff_or_admin()` |
| `subscriptions` | "Allow customers to create their own subscriptions" | `INSERT` | `authenticated` | `customer_id = auth.uid() AND (created_by IS NULL OR created_by = auth.uid())` |
| `subscriptions` | "Allow staff and admin to update subscriptions" | `UPDATE` | `authenticated` | `is_staff_or_admin()` |
| `subscriptions` | "Allow customers to update their own subscriptions" | `UPDATE` | `authenticated` | `customer_id = auth.uid()` |
| `subscriptions` | "Allow admin to delete draft or cancelled subscriptions" | `DELETE` | `authenticated` | `is_admin() AND status IN ('draft', 'cancelled')` |
| `subscription_lines` | "Allow callers to view lines of accessible subscriptions" | `SELECT` | `authenticated` | `EXISTS (SELECT 1 FROM subscriptions s WHERE s.id = subscription_lines.subscription_id)` |
| `subscription_lines` | "Allow staff and admin to manage subscription lines" | `ALL` | `authenticated` | `is_staff_or_admin()` |
| `subscription_lines` | "Allow customers to insert lines on own subscriptions" | `INSERT` | `authenticated` | Customer owns parent subscription (`customer_id = auth.uid()`) |
| `invoices` | "Allow staff and admin to view all invoices" | `SELECT` | `authenticated` | `is_staff_or_admin()` |
| `invoices` | "Allow customers to view their own invoices" | `SELECT` | `authenticated` | `customer_id = auth.uid()` |
| `invoices` | "Allow staff and admin to insert invoices" | `INSERT` | `authenticated` | `is_staff_or_admin()` |
| `invoices` | "Allow customers to create draft invoices" | `INSERT` | `authenticated` | `customer_id = auth.uid() AND status = 'draft'` |
| `invoices` | "Allow staff and admin to update invoices" | `UPDATE` | `authenticated` | `is_staff_or_admin()` |
| `invoices` | "Allow customers to update own draft invoices" | `UPDATE` | `authenticated` | `customer_id = auth.uid() AND status = 'draft'` |
| `invoices` | "Allow admin to delete draft or cancelled invoices" | `DELETE` | `authenticated` | `is_admin() AND status IN ('draft', 'cancelled')` |
| `invoice_lines` | "Allow callers to view lines of accessible invoices" | `SELECT` | `authenticated` | `EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_lines.invoice_id)` |
| `invoice_lines` | "Allow staff and admin to manage invoice lines" | `ALL` | `authenticated` | `is_staff_or_admin()` |
| `invoice_lines` | "Allow customers to insert lines on own draft invoices" | `INSERT` | `authenticated` | Customer owns parent invoice, status is draft |
| `payments` | "Allow staff and admin to view all payments" | `SELECT` | `authenticated` | `is_staff_or_admin()` |
| `payments` | "Allow customers to view their own payments" | `SELECT` | `authenticated` | `customer_id = auth.uid()` |
| `payments` | "Allow staff and admin to insert payments" | `INSERT` | `authenticated` | `is_staff_or_admin()` |
| `payments` | "Allow customers to pay own confirmed invoices" | `INSERT` | `authenticated` | Customer owns target invoice (`customer_id = auth.uid()`), status in ('confirmed', 'overdue') |
| `payments` | "Allow staff and admin to update payments" | `UPDATE` | `authenticated` | `is_staff_or_admin()` |
| `payments` | "Allow admin to delete payments" | `DELETE` | `authenticated` | `is_admin()` |

---

## Future data model targets (Upcoming phases)

### Identity and access
- `profiles`: user UUID referencing Supabase Auth, display name, role, timestamps.
- Roles: controlled values such as `admin`, `staff`, `customer`. Never trust a role sent by the browser.
- Customer/profile association must support ownership checks.

### Tax rules
- `tax_rules`: admin-managed rate, applicability, effective dates, active flag.

### Discounts & Redemptions
- `discounts`: fixed or percentage value, minimum purchase/quantity, start/end dates, usage limit, scope, active flag.
- `discount_redemptions`: discount, eligible invoice/subscription, redemption timestamp; use constraints to enforce usage limits safely.

### Automation & Audit
- `billing_runs` or equivalent idempotency record: run key, subscription, billing period, outcome and timestamps.
- `audit_logs`: actor, action, entity type/id, timestamp, and safe before/after metadata.

---

## Integrity rules

- UUID primary keys; foreign keys for relationships.
- Use `NUMERIC(p,s)` for money, never floating-point columns.
- Store financial amounts and agreed unit-price/tax snapshots on historical quotation/invoice lines so future catalog edits do not rewrite history.
- Define check constraints for positive quantities, valid discount ranges, allowed status values, and non-negative payment amounts.
- Add unique constraints for business references and for recurring invoice uniqueness (subscription + billing period).
- Use transaction-safe operations for invoice creation, discount redemption, and payment recording.
- Prevent duplicate payments on retried requests with an idempotency/reference strategy (`transaction_reference UNIQUE`).
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
- [x] Versioned SQL migration `20261031000002_quotations.sql` created and validated locally (quotations, quotation_lines)
- [x] Versioned SQL migration `20261031000003_subscriptions.sql` created and validated locally (subscriptions, subscription_lines)
- [x] Versioned SQL migration `20261031000004_invoices.sql` created and validated locally (invoices, invoice_lines)
- [x] Versioned SQL migration `20261031000005_payments.sql` created and validated locally (payments, balance triggers)
- [ ] Fresh development database setup applies all migrations in order
- [x] Duplicate recurring invoice is rejected via partial unique constraint `uq_invoices_subscription_billing_period`
- [x] Foreign-key and check constraints reject invalid data across all schemas
- [x] Role/ownership allowed and denied policies defined in RLS
- [ ] Role/ownership allowed and denied cases verified against live Supabase development instance
- [x] Historical quotation and invoice totals remain stable after catalog changes
- [ ] Synthetic demo data can be seeded and reset reproducibly
