# API Contracts — Brightloop

**Base prefix:** `/api/v1`  
**Format:** JSON over HTTPS  
**Default Currency:** `INR` (Indian Rupee, ISO 4217)  
**Status:** Implemented and verified for Phase B (Catalog: Products, Product Variants, Plans). All mutating operations require explicit server-side role verification.

## Conventions

- **Authentication:** `Authorization: Bearer <Supabase access token>` for protected routes. FastAPI verifies the token against Supabase Auth (or dependency overrides in test suite) before handling the request.
- **Authorization & Service Role Security:** Because backend database clients using `SUPABASE_SERVICE_ROLE_KEY` bypass PostgreSQL Row Level Security (RLS), every FastAPI route must strictly enforce role-based access control (`require_role(...)`) server-side.
- **IDs:** UUID strings.
- **Timestamps:** ISO 8601 with timezone.
- **Money:** decimal strings in JSON for exact representation (`NUMERIC(12, 2)`); backend uses Python `Decimal` and PostgreSQL `NUMERIC`. Default currency across Brightloop is `INR`.
- **Lists:** `items`, `page`, `page_size`, and `total` standard envelope unless a documented endpoint-specific shape is needed.
- **Validate request bodies, path params, filters, and state transitions.**
- **The backend computes totals, taxes, discounts, invoice status, and balances.** Ignore client-supplied derived totals.
- **Return consistent errors without stack traces or database internals.**

Example error:
```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to perform this action.",
    "details": []
  }
}
```

## Endpoint inventory

| Area | Method and path | Purpose / access |
|---|---|---|
| Current user | GET `/auth/me` | Authenticated caller profile and effective role |
| Products | GET, POST `/products` | List; admin creates |
| Product detail | GET, PATCH `/products/{id}` | Read; authorized admin updates |
| Plans | GET, POST `/plans` | List available plans; admin configures |
| Plan detail | GET, PATCH `/plans/{id}` | Read; admin updates |
| Quotations | GET, POST `/quotations` | Role-scoped list and create |
| Confirm quotation | POST `/quotations/{id}/confirm` | Validate and confirm eligible quotation |
| Subscriptions | GET, POST `/subscriptions` | Role-scoped list and authorized creation |
| Subscription detail | GET, PATCH `/subscriptions/{id}` | Read/update permitted fields |
| Pause/resume/renew/close | POST `/subscriptions/{id}/pause`, `/resume`, `/renew`, `/close` | Validated lifecycle transitions |
| Invoices | GET, POST `/invoices` | Role-scoped list; controlled creation |
| Invoice detail | GET `/invoices/{id}` | Read with ownership checks |
| Confirm/cancel invoice | POST `/invoices/{id}/confirm`, `/cancel` | Validated invoice transitions |
| Payments | GET, POST `/payments` | List and record payment |
| Discounts | GET, POST `/discounts`; PATCH `/discounts/{id}` | Admin-managed discount rules |
| Dashboard | GET `/dashboard/summary` | Role-appropriate KPIs |
| Subscription health | GET `/analytics/subscription-health` | Expiry, renewal, overdue and billing attention |
| Revenue forecast | GET `/analytics/revenue-forecast` | Estimated scheduled subscription revenue; label as estimate |
| Audit logs | GET `/audit-logs` | Permission-filtered change history |
| AI assistant | POST `/assistant/chat` | Approved read-only assistant tools initially |

For action endpoints, use request bodies only when the action requires parameters. Document exact Pydantic request/response models and status codes in code before frontend integration.

## Authorization matrix (baseline)

| Capability | Customer | Staff | Admin |
|---|---|---|---|
| Read own subscription/invoice/payment | Yes | As operationally permitted | Yes |
| Read other customers' records | No | Only if role permits the task | Yes |
| Read public products & plans | Yes (notes masked) | Yes (full notes) | Yes (full notes) |
| Create/manage products, plans, taxes, discounts | No | No | Yes |
| Add staff | No | No | Yes |
| Record operational payment | No | If permitted | Yes |
| View finance-wide reports | No | If permitted | Yes |
| Use AI assistant | Own-data tools only | Tools allowed for staff role | Tools allowed for admin role |

Every route must enforce these rules server-side. The AI model cannot grant permissions.

## Billing and consistency rules

- Recurring invoice creation is idempotent per subscription and billing period.
- Use a unique database constraint, not only a frontend check.
- Use safe transaction boundaries for invoice and payment writes.
- Return `409 Conflict` for conflicting state changes or duplicate operations where appropriate.
- Payment recording must reference an invoice, record method/amount/date/note, and update the invoice balance consistently.
- Never trust client-provided role, unit price, tax amount, discount, total, or paid status.

## Contract change checklist

1. Discuss change with frontend and database owners.
2. Update this document and Pydantic/TypeScript types.
3. Update migration or database function if required.
4. Add/update tests and examples.
5. Communicate breaking changes before merging.

---

## Implemented Phase B Specifications (Products, Variants & Plans)

### 1. Products & Variants

#### Data Privacy & Notes Isolation:
- `description` (TEXT): Customer-facing description. Visible to all callers (public, customer, staff, admin).
- `notes` / `internal_notes` (TEXT): Confidential internal staff/admin notes (e.g. supplier markup, vendor discount notes).
  - **Leakage Prevention Rule:** When a product is retrieved or listed by an unauthenticated visitor or a user with role `customer`, the `notes` field is strictly masked to `null`.
  - **Privileged Access:** Only callers authenticated with `admin` or `staff` roles receive populated `notes`.

#### `POST /api/v1/products`
- **Access:** Admin only (`require_role(["admin"])`)
- **Status:** `201 Created`
- **Request Body:**
  ```json
  {
    "name": "Cloud Storage Pro",
    "type": "service",
    "sales_price": "2999.00",
    "cost_price": "1000.00",
    "currency": "INR",
    "description": "High-availability enterprise cloud storage",
    "notes": "Internal supplier negotiated margin: 60%",
    "is_active": true
  }
  ```
- **Response Body (`201`):**
  ```json
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Cloud Storage Pro",
    "type": "service",
    "sales_price": "2999.00",
    "cost_price": "1000.00",
    "currency": "INR",
    "description": "High-availability enterprise cloud storage",
    "notes": "Internal supplier negotiated margin: 60%",
    "is_active": true,
    "created_at": "2026-10-31T10:00:00Z",
    "updated_at": "2026-10-31T10:00:00Z"
  }
  ```

#### `GET /api/v1/products`
- **Access:** Public / Authenticated
- **Query Params:** `active_only` (bool, default `false`), `page` (int, default `1`), `page_size` (int, default `20`)
- **Response Body (`200` — Customer / Public view with internal notes masked):**
  ```json
  {
    "items": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "Cloud Storage Pro",
        "type": "service",
        "sales_price": "2999.00",
        "cost_price": "1000.00",
        "currency": "INR",
        "description": "High-availability enterprise cloud storage",
        "notes": null,
        "is_active": true,
        "created_at": "2026-10-31T10:00:00Z",
        "updated_at": "2026-10-31T10:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 20
  }
  ```

#### `GET /api/v1/products/{product_id}`
- **Access:** Public / Authenticated (Customers and anonymous callers receive `notes: null`; Staff/Admin receive full `notes`)
- **Status:** `200 OK` (or `404 Not Found`)

#### `PATCH /api/v1/products/{product_id}`
- **Access:** Admin only (`require_role(["admin"])`)
- **Status:** `200 OK`

#### `POST /api/v1/products/{product_id}/variants`
- **Access:** Admin only (`require_role(["admin"])`)
- **Status:** `201 Created`
- **Variant Field Aliases:** The API accepts `name` (aliases: `attribute_name`, `variant_name`) and `value` (aliases: `attribute_value`, `variant_value`). Persisted to `product_variants.attribute_name` and `product_variants.attribute_value`.
- **Request Body:**
  ```json
  {
    "name": "User Seat",
    "value": "10-User Pack",
    "price_adjustment": "2500.00",
    "sku": "CRM-10U",
    "is_active": true
  }
  ```
- **Response Body (`201`):**
  ```json
  {
    "id": "4da85f64-5717-4562-b3fc-2c963f66afa7",
    "product_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "User Seat",
    "value": "10-User Pack",
    "price_adjustment": "2500.00",
    "sku": "CRM-10U",
    "is_active": true,
    "created_at": "2026-10-31T10:00:00Z",
    "updated_at": "2026-10-31T10:00:00Z"
  }
  ```

#### `GET /api/v1/products/{product_id}/variants`
- **Access:** Public / Authenticated
- **Status:** `200 OK`
- **Response Body (`200`):** Array of `ProductVariantResponse` objects.

---

### 2. Subscription Plans

#### Mapping Rules:
- **Billing Recurrence:** The API exposes `billing_frequency` (`daily`, `weekly`, `monthly`, `yearly`) and `billing_interval` (integer multiplier, e.g. 1 month, 3 months). The database maps these to columns `billing_interval` (VARCHAR frequency) and `interval_count` (INTEGER multiplier).
- **End-of-Term Behavior (`cancel` → `close`):** The API accepts `end_of_term_behavior` with values `"renew"`, `"close"`, `"pause"`, or `"cancel"`. When `"cancel"` is provided by API clients, the persistence repository automatically translates it to `"close"` prior to database storage, fulfilling the PostgreSQL check constraint `CHECK (end_of_term_behavior IN ('renew', 'close', 'pause'))`.
- **Date Aliases:** The API accepts `start_date` (alias: `available_from`) and `end_date` (alias: `available_until`).

#### `POST /api/v1/plans`
- **Access:** Admin only (`require_role(["admin"])`)
- **Status:** `201 Created`
- **Request Body:**
  ```json
  {
    "name": "Standard Monthly",
    "description": "Standard business tier billed monthly",
    "price": "4900.00",
    "currency": "INR",
    "billing_frequency": "monthly",
    "billing_interval": 1,
    "minimum_quantity": 1,
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "end_of_term_behavior": "renew",
    "status": "active"
  }
  ```
- **Response Body (`201`):** `PlanResponse` object with `currency: "INR"`.

#### `GET /api/v1/plans`
- **Access:** Public / Authenticated
- **Query Params:** `status` (draft/active/closed/archived), `billing_frequency` (daily/weekly/monthly/yearly), `page` (int), `page_size` (int)
- **Response Body (`200`):**
  ```json
  {
    "items": [],
    "total": 0,
    "page": 1,
    "page_size": 20
  }
  ```

#### `GET /api/v1/plans/{plan_id}`
- **Access:** Public / Authenticated
- **Status:** `200 OK` (or `404 Not Found`)

#### `PATCH /api/v1/plans/{plan_id}`
- **Access:** Admin only (`require_role(["admin"])`)
- **Status:** `200 OK`


---

### 3. Quotations

#### Data Integrity & Snapshot Rules:
- Server-side calculation of all financial fields (`subtotal`, `discount_total`, `tax_total`, `total_amount`, `line_total`).
- Snapshots catalog price at creation time; future catalog updates do not alter existing quotations.
- Role-based authorization & data isolation: customers can only view and confirm their own quotations.
- Status state transitions: `draft` -> `confirmed`. Prevents duplicate or expired confirmations.

#### `POST /api/v1/quotations`
- **Access:** Authenticated (Customer / Staff / Admin)
- **Status:** `201 Created`
- **Request Body:**
  ```json
  {
    "customer_id": "00000000-0000-0000-0000-000000000000",
    "currency": "INR",
    "valid_until": "2026-11-30",
    "notes": "Annual subscription bundle",
    "lines": [
      {
        "plan_id": "00000000-0000-0000-0000-000000000001",
        "quantity": "1.00",
        "discount_percentage": "10.00",
        "tax_rate": "18.00"
      }
    ]
  }
  ```

#### `GET /api/v1/quotations`
- **Access:** Authenticated (Role-scoped: customers see only their own)
- **Status:** `200 OK`

#### `GET /api/v1/quotations/{id}`
- **Access:** Authenticated (Customer isolation enforced)
- **Status:** `200 OK` (or `404 Not Found`)

#### `POST /api/v1/quotations/{id}/confirm`
- **Access:** Authenticated (Customer / Staff / Admin)
- **Status:** `200 OK`
- **Behavior:** Conditionally transitions quotation status from `draft` to `confirmed`. Rejects expired or already confirmed quotes with `400 Bad Request`.

---

### 4. Subscription Management

#### Core Rules & State Machine:
- **Statuses:** `draft`, `active`, `paused`, `closed`, `cancelled`.
- **Transitions:**
  - Direct creation starts in `active`.
  - `active` -> `paused` (via `/pause`), `paused` -> `active` (via `/resume`).
  - `active` / `paused` -> `closed` (via `/close`).
  - `/renew` advances `next_billing_date` by the billing frequency (e.g. 1 month).
- **Conversion from Quotation (`POST /api/v1/subscriptions/from-quotation/{quotation_id}`):**
  - Converts a `confirmed` quotation into an `active` subscription with lines.
  - **Idempotency:** Calling multiple times with the same `quotation_id` returns the existing subscription without creating duplicates.
  - Rejects unconfirmed quotations with `400 Bad Request` (`INVALID_STATUS_TRANSITION`).
- **Data Isolation:** Customers can only view, update, pause, resume, close, or convert quotations for their own subscriptions.

#### `POST /api/v1/subscriptions`
- **Access:** Authenticated (Customer / Staff / Admin)
- **Status:** `201 Created`
- **Request Body:**
  ```json
  {
    "customer_id": "00000000-0000-0000-0000-000000000000",
    "plan_id": "00000000-0000-0000-0000-000000000001",
    "currency": "INR",
    "billing_frequency": "monthly",
    "start_date": "2026-11-01",
    "notes": "Enterprise subscription"
  }
  ```

#### `POST /api/v1/subscriptions/from-quotation/{quotation_id}`
- **Access:** Authenticated (Customer owns quotation, or Staff / Admin)
- **Status:** `201 Created`
- **Behavior:** Idempotently converts confirmed quotation to active subscription.

#### `GET /api/v1/subscriptions`
- **Access:** Authenticated (Customer-isolated / Staff & Admin)
- **Query Params:** `customer_id`, `status`, `page`, `page_size`
- **Status:** `200 OK`

#### `GET /api/v1/subscriptions/{id}`
- **Access:** Authenticated (Customer-isolated)
- **Status:** `200 OK` (or `404 Not Found`)

#### `PATCH /api/v1/subscriptions/{id}`
- **Access:** Authenticated (Authorized customer or Staff / Admin)
- **Status:** `200 OK`
- **Request Body:** `{"notes": "...", "end_date": "...", "next_billing_date": "..."}`

#### `POST /api/v1/subscriptions/{id}/pause`
- **Access:** Authenticated (Customer / Staff / Admin)
- **Status:** `200 OK` (Transitions `active` -> `paused`)

#### `POST /api/v1/subscriptions/{id}/resume`
- **Access:** Authenticated (Customer / Staff / Admin)
- **Status:** `200 OK` (Transitions `paused` -> `active`)

#### `POST /api/v1/subscriptions/{id}/renew`
- **Access:** Authenticated (Customer / Staff / Admin)
- **Status:** `200 OK` (Advances `next_billing_date`)

#### `POST /api/v1/subscriptions/{id}/close`
- **Access:** Authenticated (Customer / Staff / Admin)
- **Status:** `200 OK` (Transitions to `closed`)


---

### 5. Invoices & Billing

#### Core Rules & Invariants:
- **Statuses:** `draft` -> `confirmed` -> `paid` (or `cancelled`).
- **Server Calculation & Precision:** Exact 2-decimal financial calculations (`Decimal("0.01")`). Client-submitted totals are ignored; backend computes gross, discount, tax, total, and balance.
- **Balance Invariant:** `balance = total_amount - amount_paid`.
- **Idempotent Recurring Billing (`POST /api/v1/invoices/from-subscription/{subscription_id}`):**
  - Unique per `(subscription_id, billing_period_start, billing_period_end)`.
  - Re-triggering generation for the same subscription billing period returns the existing invoice without duplicate creation.
- **Customer Data Isolation:** Customers can only view, list, confirm, or cancel their own invoices.

#### `POST /api/v1/invoices`
- **Access:** Authenticated (Customer / Staff / Admin)
- **Status:** `201 Created`
- **Request Body:**
  ```json
  {
    "customer_id": "00000000-0000-0000-0000-000000000000",
    "currency": "INR",
    "due_date": "2026-11-30",
    "lines": [
      {
        "plan_id": "00000000-0000-0000-0000-000000000001",
        "quantity": "1.00",
        "discount_percentage": "10.00",
        "tax_rate": "18.00"
      }
    ]
  }
  ```

#### `POST /api/v1/invoices/from-subscription/{subscription_id}`
- **Access:** Authenticated (Customer owns subscription, or Staff / Admin)
- **Status:** `201 Created`
- **Behavior:** Idempotently generates invoice from subscription lines for the specified billing period.

#### `GET /api/v1/invoices`
- **Access:** Authenticated (Role-scoped: customers see only their own)
- **Query Params:** `customer_id`, `status`, `subscription_id`, `page`, `page_size`
- **Status:** `200 OK`

#### `GET /api/v1/invoices/{id}`
- **Access:** Authenticated (Customer isolation enforced)
- **Status:** `200 OK` (or `404 Not Found`)

#### `POST /api/v1/invoices/{id}/confirm`
- **Access:** Authenticated (Customer / Staff / Admin)
- **Status:** `200 OK` (Transitions `draft` -> `confirmed`)

#### `POST /api/v1/invoices/{id}/cancel`
- **Access:** Authenticated (Customer / Staff / Admin)
- **Status:** `200 OK` (Transitions to `cancelled`, rejected if payments recorded)


---

### 6. Payments & Settlements

#### Core Rules & Invariants:
- **Statuses:** `completed`, `pending`, `failed`, `refunded`.
- **Payment Methods:** `card`, `bank_transfer`, `upi`, `net_banking`, `manual`, `cash`.
- **Settlement Invariants:**
  - Payment amount must be positive (`> 0.00`).
  - Cannot exceed outstanding invoice balance (`OVERPAYMENT_NOT_ALLOWED`).
  - Invoice balance decreases by exact payment amount: `new_balance = balance - amount`.
  - When `new_balance == 0.00`, invoice status transitions to `PAID` with `paid_at` recorded.
  - Payments cannot be recorded against cancelled invoices.
  - Payment currency must match invoice currency.
- **Idempotency (`idempotency_key`):**
  - Unique per client payment attempt.
  - Resending with identical key and parameters returns existing payment without double-crediting.
  - Re-submitting with different parameters returns `409 Conflict`.
- **Customer Data Isolation:** Customers can only view and pay their own invoices.

#### `POST /api/v1/payments`
- **Access:** Authenticated (Customer / Staff / Admin)
- **Status:** `201 Created`
- **Request Body:**
  ```json
  {
    "invoice_id": "00000000-0000-0000-0000-000000000000",
    "amount": "2500.00",
    "currency": "INR",
    "payment_method": "upi",
    "transaction_reference": "UPI-UTR-998877",
    "idempotency_key": "client-pay-nonce-12345",
    "notes": "First installment"
  }
  ```

#### `GET /api/v1/payments`
- **Access:** Authenticated (Role-scoped: customers see only their own)
- **Query Params:** `customer_id`, `invoice_id`, `status`, `page`, `page_size`
- **Status:** `200 OK`

#### `GET /api/v1/payments/{payment_id}`
- **Access:** Authenticated (Customer isolation enforced)
- **Status:** `200 OK` (or `404 Not Found`)
