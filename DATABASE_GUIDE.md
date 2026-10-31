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
| `billing_interval` | `VARCHAR(20)` | No | `'monthly'`| `CHECK (billing_interval IN ('daily', 'weekly', 'monthly', 'yearly'))` | `billing_interval: str` |
| `interval_count` | `INTEGER` | No | `1` | `CHECK (interval_count >= 1)` | `interval_count: int = 1` |
| `minimum_quantity`| `INTEGER` | No | `1` | `CHECK (minimum_quantity >= 1)` | `minimum_quantity: int = 1` |
| `start_date` | `DATE` | Yes | `NULL` | Plan availability start | `start_date: Optional[date]` |
| `end_date` | `DATE` | Yes | `NULL` | `CHECK (end_date IS NULL OR end_date >= start_date)` | `end_date: Optional[date]` |
| `end_of_term_behavior`| `VARCHAR(50)`| No | `'renew'`| `CHECK (end_of_term_behavior IN ('renew', 'close', 'pause'))` | `end_of_term_behavior: str` (API accepts 'cancel', persisted as 'close') |
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
- `is_admin()`: Verifies if the request context carries an admin role. Evaluates server-controlled JWT `app_metadata` only (never user_metadata, which is client-writable); if omitted, falls back to trusted `public.profiles` where `id = auth.uid() AND role = 'admin'`. Explicitly sets `search_path = public, auth` to prevent `SECURITY DEFINER` path hijacking.
- `is_staff_or_admin()`: Similar check verifying if the caller has either `admin` or `staff` role in `app_metadata` or `public.profiles`. Explicitly sets `search_path = public, auth`.

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

### Grants & Service-Role Security Boundary
- `service_role`: Granted `ALL` privileges on all 4 tables for FastAPI backend service access.
  > [!IMPORTANT]
  > Since `SUPABASE_SERVICE_ROLE_KEY` bypasses PostgreSQL Row Level Security (RLS), all FastAPI backend endpoints enforce role-based access control (`require_role(...)`) server-side before executing any queries.
- `anon`, `authenticated`: Granted `SELECT` privileges; direct client writes are prohibited and rejected by RLS.

---

# Quotations Schema (`20261031000002_quotations.sql`)

Migration `20261031000002_quotations.sql` establishes the sales quotation lifecycle, providing immutable pricing snapshots, server-verifiable financial totals, cascade integrity, and granular ownership/staff RLS policies.

### 5. `quotations`
Header record for a customer quotation, establishing business reference, currency, lifecycle status, validity dates, and aggregated totals.

| Database Column | Data Type | Nullable | Default | Constraints & Rules | Description / Mapping |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | Unique quotation UUID |
| `quotation_number` | `VARCHAR(50)` | No | `generate_quotation_number()` | `UNIQUE`, non-empty | Human-readable business reference (e.g. `QUOT-2026-00001`) |
| `customer_id` | `UUID` | No | — | `REFERENCES auth.users(id) ON DELETE RESTRICT` | Customer reference (ownership anchor) |
| `plan_id` | `UUID` | Yes | `NULL` | `REFERENCES plans(id) ON DELETE RESTRICT` | Optional associated subscription plan |
| `status` | `VARCHAR(20)` | No | `'draft'` | `CHECK (status IN ('draft', 'sent', 'confirmed', 'cancelled'))` | Lifecycle state |
| `currency` | `VARCHAR(3)` | No | `'INR'` | `CHECK (length(currency) = 3)` | Currency ISO code (default INR) |
| `subtotal` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (subtotal >= 0)` | Aggregated gross sum of lines |
| `discount_total` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (discount_total >= 0)` | Aggregated line discounts |
| `tax_total` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (tax_total >= 0)` | Aggregated line taxes |
| `total_amount` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (total_amount >= 0)` | Net payable amount (subtotal - discount + tax) |
| `valid_until` | `DATE` | Yes | `NULL` | — | Quotation validity expiration date |
| `confirmed_at` | `TIMESTAMPTZ` | Yes | `NULL` | `CHECK (confirmed_at >= created_at)` | Timestamp when confirmed |
| `cancelled_at` | `TIMESTAMPTZ` | Yes | `NULL` | `CHECK (cancelled_at >= created_at)` | Timestamp when cancelled |
| `notes` | `TEXT` | Yes | `NULL` | — | Customer-facing terms & conditions |
| `internal_notes` | `TEXT` | Yes | `NULL` | — | Staff-only internal comments (masked from customers) |
| `created_by` | `UUID` | Yes | `NULL` | `REFERENCES auth.users(id) ON DELETE SET NULL` | Originating staff/customer ID |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL`, auto-updated by trigger | Last modification timestamp |

*Triggers & Indexes:*
- Index: `idx_quotations_customer_id ON quotations (customer_id)`
- Index: `idx_quotations_status ON quotations (status)`
- Index: `idx_quotations_valid_until ON quotations (valid_until)`
- Index: `idx_quotations_created_by ON quotations (created_by)`
- Index: `idx_quotations_plan_id ON quotations (plan_id)`
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
- `chk_quotation_line_item`: Enforces mutual exclusivity between product and plan line items (`(line_type = 'product' AND product_id IS NOT NULL AND plan_id IS NULL) OR (line_type = 'plan' AND plan_id IS NOT NULL AND product_id IS NULL AND variant_id IS NULL)`). Custom description-only lines are prohibited at the database level to align with the backend domain model (`QuotationService` enforces `has_prod ^ has_plan`, and `QuotationLineType` enum strictly defines `product` and `plan`).
- `trg_quotation_lines_calculate BEFORE INSERT OR UPDATE`: Automatically synchronizes `line_type` based on referenced catalog entities (`plan` if `plan_id` is set, else `product`), and computes gross `subtotal = round(quantity * unit_price, 2)`, `discount_amount`, `tax_amount`, and net `line_total`. On updates modifying quantities, prices, or rates, line amounts are automatically recomputed.
- `trg_quotation_lines_sync_totals AFTER INSERT OR UPDATE OR DELETE`: Automatically synchronizes aggregated subtotals, discounts, taxes, and total amounts to the parent `quotations` header. Handles line insertion, line deletion, and line reassignment across quotations (re-aggregating both `OLD.quotation_id` and `NEW.quotation_id` if reassigned).

---

### Atomic Quotation Creation RPC (`create_quotation_atomic`)
To guarantee transaction atomicity across quotation header and detail lines without risk of orphaned records, the migration provides:
```sql
create_quotation_atomic(p_header JSONB, p_lines JSONB) RETURNS JSONB
```
- Executes inside a single ACID PostgreSQL transaction block.
- Automatically rolls back the entire quotation if any child line item violates catalog constraints, checks, or foreign keys.
- Granted `EXECUTE` to `authenticated` and `service_role`.

---

### Architectural Design Decisions & Baseline Invariants

1. **Header-level `plan_id` Evaluation:**
   - **Finding:** In Brightloop, subscription plans are itemized as individual lines (`quotation_lines.plan_id`), enabling mixed quotes (e.g. plan subscription + add-on service products). The backend schemas (`QuotationCreate`, `QuotationResponse`) do not expose a header-level `plan_id`.
   - **Schema Status:** Kept as a nullable foreign key (`plan_id UUID REFERENCES plans(id) ON DELETE RESTRICT`) for optional forward compatibility (e.g. anchoring a quotation to a primary subscription plan), but operates safely as `NULL` for standard multi-item quotations.
2. **Backend Service-Role vs RLS Security Boundary:**
   - The FastAPI backend accesses Supabase using `SUPABASE_SERVICE_ROLE_KEY`. In Supabase PostgreSQL, `service_role` holds the `BYPASSRLS` attribute, so FastAPI backend endpoints enforce role-based access control (`require_role(...)`) and ownership checks server-side in Python.
   - The PostgreSQL RLS policies provide **defense-in-depth**: direct client connections or scoped tokens using `authenticated` role are strictly locked down to customer ownership or staff/admin verification via `is_staff_or_admin()`.
3. **Customer Draft Creation Permissions:**
   - Authenticated customers are permitted to create draft quotations directly (`POST /api/v1/quotations`), matching `test_customer_create_quotation_with_product_snapshot`. Both the API service and the PostgreSQL RLS policy restrict customer insertions to `customer_id = auth.uid()` and `status = 'draft'`.
4. **Earlier Migration Function Dependencies:**
   - Confirmed all referenced PostgreSQL functions exist in canonical migration `20261031000001_catalog.sql`:
     - `update_updated_at_column()` (line 13)
     - `is_admin()` (line 26)
     - `is_staff_or_admin()` (line 50)

---

### Quotations Row Level Security (RLS) Policy Summary

| Table | Policy Name | Command | Target Role | Using / Check Condition |
|---|---|---|---|---|
| `quotations` | "Allow staff and admin to view all quotations" | `SELECT` | `authenticated` | `is_staff_or_admin()` |
| `quotations` | "Allow customers to view their own quotations" | `SELECT` | `authenticated` | `customer_id = auth.uid() AND (status IN ('sent', 'confirmed', 'cancelled') OR created_by = auth.uid())` |
| `quotations` | "Allow staff and admin to insert quotations" | `INSERT` | `authenticated` | `is_staff_or_admin()` |
| `quotations` | "Allow customers to create draft quotations" | `INSERT` | `authenticated` | `customer_id = auth.uid() AND status = 'draft'` |
| `quotations` | "Allow staff and admin to update quotations" | `UPDATE` | `authenticated` | `is_staff_or_admin()` |
| `quotations` | "Allow customers to update their own quotations" | `UPDATE` | `authenticated` | `customer_id = auth.uid()` on own drafts or confirming sent quotes |
| `quotations` | "Allow admin to delete draft or cancelled quotations" | `DELETE` | `authenticated` | `is_admin() AND status IN ('draft', 'cancelled')` |
| `quotation_lines` | "Allow callers to view lines of accessible quotations" | `SELECT` | `authenticated` | `EXISTS (SELECT 1 FROM quotations q WHERE q.id = quotation_lines.quotation_id)` |
| `quotation_lines` | "Allow staff and admin to insert/update/delete lines" | `INSERT`, `UPDATE`, `DELETE` | `authenticated` | `is_staff_or_admin() AND parent status = 'draft'` |
| `quotation_lines` | "Allow customers to insert/update/delete lines on own draft" | `INSERT`, `UPDATE`, `DELETE` | `authenticated` | Customer owns parent quotation (`customer_id = auth.uid()`), creator is self/null, AND parent `status = 'draft'` |

---

## Subscription Schema Specification & Backend Contract Mapping (Migration `20261031000003_subscriptions.sql`)

### 7. `subscriptions`
Stores ongoing recurring subscription contracts, customer ownership, billing cycles, and status.

| Database Column | Data Type | Nullable | Default | Constraints & Rules | Backend Mapping (Pydantic / FastAPI) |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | `id: UUID` |
| `subscription_number` | `VARCHAR(64)` | No | — | `UNIQUE`, `NOT NULL`, e.g. `SUB-YYYYMM-XXXXXX` | `subscription_number: str` |
| `customer_id` | `UUID` | No | — | References auth customer / user | `customer_id: UUID` |
| `plan_id` | `UUID` | Yes | `NULL` | `REFERENCES plans(id) ON DELETE RESTRICT` | `plan_id: Optional[UUID]` |
| `quotation_id` | `UUID` | Yes | `NULL` | `REFERENCES quotations(id) ON DELETE RESTRICT`, unique | `quotation_id: Optional[UUID]` |
| `status` | `VARCHAR(20)` | No | `'active'` | `CHECK (status IN ('draft', 'active', 'paused', 'closed', 'cancelled'))` | `status: SubscriptionStatus` |
| `currency` | `VARCHAR(3)` | No | `'INR'` | `CHECK (length(currency) = 3)` | `currency: str = "INR"` |
| `billing_frequency` | `VARCHAR(20)` | No | `'monthly'` | `CHECK (billing_frequency IN ('weekly', 'monthly', 'quarterly', 'yearly'))` | `billing_frequency: str` |
| `subtotal` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (subtotal >= 0)` | `subtotal: Decimal` |
| `discount_total` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (discount_total >= 0)` | `discount_total: Decimal` |
| `tax_total` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (tax_total >= 0)` | `tax_total: Decimal` |
| `total_amount` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (total_amount >= 0)` | `total_amount: Decimal` |
| `start_date` | `DATE` | No | `CURRENT_DATE` | Subscription start date | `start_date: date` |
| `end_date` | `DATE` | Yes | `NULL` | `CHECK (end_date IS NULL OR end_date >= start_date)` | `end_date: Optional[date]` |
| `next_billing_date` | `DATE` | No | — | Next automated billing run date | `next_billing_date: date` |
| `paused_at` | `TIMESTAMPTZ` | Yes | `NULL` | Timestamp when subscription was paused | `paused_at: Optional[datetime]` |
| `closed_at` | `TIMESTAMPTZ` | Yes | `NULL` | Timestamp when subscription was closed | `closed_at: Optional[datetime]` |
| `notes` | `TEXT` | Yes | `NULL` | Contract / customer notes | `notes: Optional[str]` |
| `created_by` | `UUID` | Yes | `NULL` | Creator user ID | `created_by: Optional[UUID]` |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | `created_at: datetime` |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL`, auto-updated by trigger | `updated_at: datetime` |

*Indexes:*
- `idx_subscriptions_customer_id ON subscriptions(customer_id)`
- `idx_subscriptions_status ON subscriptions(status)`
- `idx_subscriptions_next_billing_date ON subscriptions(next_billing_date)`
- `idx_subscriptions_quotation_id ON subscriptions(quotation_id)`

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

*Indexes & Constraints:*
- `idx_subscription_lines_sub_id ON subscription_lines(subscription_id)`
- Mutual exclusivity check: `chk_subscription_line_item CHECK ((line_type = 'product' AND product_id IS NOT NULL AND plan_id IS NULL) OR (line_type = 'plan' AND plan_id IS NOT NULL AND product_id IS NULL AND variant_id IS NULL))`

---

## Invoices Schema Specification & Backend Contract Mapping (Migration `20261031000004_invoices.sql`)

### 9. `invoices`
Stores customer invoices, billing periods, payment balances, and lifecycle states.

| Database Column | Data Type | Nullable | Default | Constraints & Rules | Backend Mapping (Pydantic / FastAPI) |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | `id: UUID` |
| `invoice_number` | `VARCHAR(64)` | No | — | `UNIQUE`, `NOT NULL`, e.g. `INV-YYYYMM-XXXXXX` | `invoice_number: str` |
| `customer_id` | `UUID` | No | — | References auth customer / user | `customer_id: UUID` |
| `subscription_id` | `UUID` | Yes | `NULL` | `REFERENCES subscriptions(id) ON DELETE RESTRICT` | `subscription_id: Optional[UUID]` |
| `quotation_id` | `UUID` | Yes | `NULL` | `REFERENCES quotations(id) ON DELETE RESTRICT` | `quotation_id: Optional[UUID]` |
| `status` | `VARCHAR(20)` | No | `'draft'` | `CHECK (status IN ('draft', 'confirmed', 'paid', 'cancelled', 'overdue'))` | `status: InvoiceStatus` |
| `currency` | `VARCHAR(3)` | No | `'INR'` | `CHECK (length(currency) = 3)` | `currency: str = "INR"` |
| `subtotal` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (subtotal >= 0)` | `subtotal: Decimal` |
| `discount_total` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (discount_total >= 0)` | `discount_total: Decimal` |
| `tax_total` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (tax_total >= 0)` | `tax_total: Decimal` |
| `total_amount` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (total_amount >= 0)` | `total_amount: Decimal` |
| `amount_paid` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (amount_paid >= 0)` | `amount_paid: Decimal` |
| `balance` | `NUMERIC(12, 2)` | No | `0.00` | `CHECK (balance >= 0)` | `balance: Decimal` |
| `invoice_date` | `DATE` | No | `CURRENT_DATE` | Invoice issue date | `invoice_date: date` |
| `due_date` | `DATE` | No | — | Payment due date (`due_date >= invoice_date`) | `due_date: date` |
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
- `uq_invoices_subscription_billing_period UNIQUE (subscription_id, billing_period_start, billing_period_end) WHERE status <> 'cancelled'` (Guarantees billing run idempotency!)
- `idx_invoices_customer_id ON invoices(customer_id)`
- `idx_invoices_status ON invoices(status)`
- `idx_invoices_due_date ON invoices(due_date)`
- `idx_invoices_subscription_id ON invoices(subscription_id)`

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

---

## Payments & Settlements Schema Specification (Migration `20261031000005_payments.sql`)

### 11. `payments`
Stores recorded payments, transaction methods, references, and audit links.

| Database Column | Data Type | Nullable | Default | Constraints & Rules | Backend Mapping (Pydantic / FastAPI) |
|---|---|---|---|---|---|
| `id` | `UUID` | No | `gen_random_uuid()` | `PRIMARY KEY` | `id: UUID` |
| `payment_number` | `VARCHAR(64)` | No | — | `UNIQUE`, `NOT NULL`, e.g. `PAY-YYYYMM-XXXXXX` | `payment_number: str` |
| `invoice_id` | `UUID` | No | — | `REFERENCES invoices(id) ON DELETE RESTRICT` | `invoice_id: UUID` |
| `customer_id` | `UUID` | No | — | References auth customer / user | `customer_id: UUID` |
| `amount` | `NUMERIC(12, 2)` | No | — | `CHECK (amount > 0)` | `amount: Decimal` |
| `currency` | `VARCHAR(3)` | No | `'INR'` | `CHECK (length(currency) = 3)` | `currency: str = "INR"` |
| `payment_method` | `VARCHAR(50)` | No | `'manual'` | `CHECK (payment_method IN ('card', 'bank_transfer', 'upi', 'net_banking', 'manual', 'cash'))` | `payment_method: PaymentMethod` |
| `payment_status` | `VARCHAR(20)` | No | `'completed'` | `CHECK (payment_status IN ('completed', 'pending', 'failed', 'refunded'))` | `payment_status: PaymentStatus` |
| `payment_date` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | `payment_date: datetime` |
| `transaction_reference` | `VARCHAR(100)` | Yes | `NULL` | External transaction ID, UTR or reference | `transaction_reference: Optional[str]` |
| `idempotency_key` | `VARCHAR(100)` | Yes | `NULL` | `UNIQUE` client key for duplicate prevention | `idempotency_key: Optional[str]` |
| `notes` | `TEXT` | Yes | `NULL` | Operational notes | `notes: Optional[str]` |
| `recorded_by` | `UUID` | Yes | `NULL` | User who recorded the payment | `recorded_by: Optional[UUID]` |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL` | `created_at: datetime` |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | `NOT NULL`, auto-updated by trigger | `updated_at: datetime` |

*Indexes:*
- `idx_payments_invoice_id ON payments(invoice_id)`
- `idx_payments_customer_id ON payments(customer_id)`
- `idx_payments_payment_date ON payments(payment_date)`
- `idx_payments_idempotency_key UNIQUE (idempotency_key) WHERE idempotency_key IS NOT NULL`

---

### Atomic Settlement RPC (`record_payment_atomic`)
To guarantee that payment recording and invoice balance decrement occur atomically under concurrent access:
```sql
record_payment_atomic(p_payment JSONB) RETURNS JSONB
```
- Executes inside a single transaction with `SELECT ... FOR UPDATE` row-level lock on `invoices`.
- Validates that `amount <= balance`, applies `amount_paid = amount_paid + amount`, `balance = total_amount - amount_paid`.
- If `balance = 0.00`, transitions `invoices.status = 'paid'` and sets `paid_at = now()`.
- Inserts row into `payments`.
- Returns both the created payment and updated invoice state.

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
- [x] Versioned SQL migration `20261031000002_quotations.sql` created and validated locally (quotations, quotation_lines)
- [ ] Fresh development database setup applies all migrations in order
- [ ] Duplicate recurring invoice is rejected (Upcoming Phase)
- [x] Foreign-key and check constraints reject invalid data in catalog schema
- [x] Role/ownership allowed and denied policies defined in RLS
- [ ] Role/ownership allowed and denied cases verified against live Supabase development instance
- [ ] Historical invoice totals remain stable after catalog changes
- [ ] Synthetic demo data can be seeded and reset reproducibly
