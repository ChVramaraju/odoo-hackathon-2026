# API Contracts — Brightloop

**Base prefix:** `/api/v1`  
**Format:** JSON over HTTPS  
**Status:** Shared contract. An endpoint is not implemented merely because it appears here. FastAPI OpenAPI output and automated tests become the executable evidence.

## Conventions

- Authentication: `Authorization: Bearer <Supabase access token>` for protected routes. FastAPI verifies the token before handling the request.
- IDs: UUID strings.
- Timestamps: ISO 8601 with timezone.
- Money: decimal strings in JSON for exact representation; backend uses Python `Decimal` and PostgreSQL `NUMERIC`. Include currency explicitly where needed. Default currency is `INR`.
- Lists: `items`, `page`, `page_size`, and `total` unless a documented endpoint-specific shape is needed.
- Validate request bodies, path params, filters, and state transitions.
- The backend computes totals, taxes, discounts, invoice status, and balances. Ignore client-supplied derived totals.
- Return consistent errors without stack traces or database internals.

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
| Create/manage products, plans, taxes, discounts | No | Limited to explicit permission | Yes |
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

### System-Wide Conventions
- **Base / Default Currency:** `INR` (Indian Rupee, ISO 4217). If omitted in requests, the system defaults to `INR`.
- **Money Representation:** Decimal strings in JSON (e.g. `"1499.00"`), mapped to Python `Decimal` and PostgreSQL `NUMERIC(12, 2)`.
- **Role Enforcement & RLS Guard:** Because internal FastAPI service calls may utilize `SUPABASE_SERVICE_ROLE_KEY` (which by design bypasses PostgreSQL Row Level Security), every mutating or restricted endpoint MUST enforce explicit authorization via FastAPI `require_role(...)` guards.

---

### 1. Products & Variants

#### Privacy & Field Distinction:
- `description` (string, max 1000): Customer-facing public overview and marketing copy. Returned to all callers (public visitors, customers, staff, and admins).
- `internal_notes` / `notes` (string, max 1000): Operational and administrative staff notes. **Strictly redacted** (returned as `null`) for customer and unauthenticated public requests; visible only to authenticated `admin` and `staff` roles.
- `is_active` (boolean): Inactive products (`is_active: false`) are visible only to `admin` and `staff`. Public/customer requests for inactive items return `404 Not Found`.

#### `POST /api/v1/products`
- **Access:** Admin only (`require_role(["admin"])`)
- **Status:** `201 Created`
- **Request Body:**
  ```json
  {
    "name": "Cloud Storage Pro",
    "type": "service",
    "sales_price": "1499.00",
    "cost_price": "500.00",
    "currency": "INR",
    "description": "Enterprise cloud storage with automated backup",
    "notes": "Internal procurement margin target: 65%",
    "is_active": true
  }
  ```
- **Response Body (`201`):**
  ```json
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Cloud Storage Pro",
    "type": "service",
    "product_type": "service",
    "sales_price": "1499.00",
    "cost_price": "500.00",
    "currency": "INR",
    "description": "Enterprise cloud storage with automated backup",
    "notes": "Internal procurement margin target: 65%",
    "internal_notes": "Internal procurement margin target: 65%",
    "is_active": true,
    "created_at": "2026-10-31T10:00:00Z",
    "updated_at": "2026-10-31T10:00:00Z"
  }
  ```

#### `GET /api/v1/products`
- **Access:** Public / Authenticated (Role-aware visibility)
  - **Admin / Staff:** Can pass `active_only=false` to inspect inactive items; receives unredacted `notes` / `internal_notes`.
  - **Customer / Public:** Restricted to active products (`is_active=true`); `notes` and `internal_notes` are redacted to `null`.
- **Query Params:** `active_only` (bool, default `false`), `page` (int, default `1`), `page_size` (int, default `20`)
- **Response Body (`200`):**
  ```json
  {
    "items": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "Cloud Storage Pro",
        "type": "service",
        "product_type": "service",
        "sales_price": "1499.00",
        "cost_price": "500.00",
        "currency": "INR",
        "description": "Enterprise cloud storage with automated backup",
        "notes": null,
        "internal_notes": null,
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
- **Access:** Public / Authenticated (Role-aware)
  - Returns `404 Not Found` to customer/public callers if product is inactive.
  - Redacts `notes` / `internal_notes` to `null` for customer/public callers.
- **Status:** `200 OK` (or `404 Not Found`)

#### `PATCH /api/v1/products/{product_id}`
- **Access:** Admin only (`require_role(["admin"])`)
- **Status:** `200 OK`

#### `POST /api/v1/products/{product_id}/variants`
- **Access:** Admin only (`require_role(["admin"])`)
- **Status:** `201 Created`
- **Request Body:** Accepts `name`, `attribute_name`, or `variant_name`; and `value`, `attribute_value`, or `variant_value`:
  ```json
  {
    "name": "User Seat",
    "value": "10-User Pack",
    "price_adjustment": "499.00",
    "sku": "CRM-10U",
    "is_active": true
  }
  ```
- **Response Body (`201`):** Provides both standard API fields (`name`, `value`) and computed database/frontend aliases (`variant_name`, `variant_value`, `attribute_name`, `attribute_value`):
  ```json
  {
    "id": "4da85f64-5717-4562-b3fc-2c963f66afa7",
    "product_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "User Seat",
    "value": "10-User Pack",
    "variant_name": "User Seat",
    "variant_value": "10-User Pack",
    "attribute_name": "User Seat",
    "attribute_value": "10-User Pack",
    "price_adjustment": "499.00",
    "sku": "CRM-10U",
    "is_active": true,
    "created_at": "2026-10-31T10:00:00Z",
    "updated_at": "2026-10-31T10:00:00Z"
  }
  ```

#### `GET /api/v1/products/{product_id}/variants`
- **Access:** Public / Authenticated (Customer sees active variants only)
- **Status:** `200 OK`
- **Response Body (`200`):** Array of `ProductVariantResponse` objects.

---

### 2. Subscription Plans

#### Recurrence & End-of-Term Mappings:
- **Billing Recurrence:**
  - API `billing_frequency` (string enum: `daily`, `weekly`, `monthly`, `yearly`) maps to database column `billing_interval`.
  - API `billing_interval` (positive integer multiplier, e.g. `1`, `3`) maps to database column `interval_count`.
- **End-of-Term Behavior:**
  - API accepts: `renew`, `close`, `cancel` (legacy client alias for `close`), `pause`.
  - Database schema constraint: `CHECK (end_of_term_behavior IN ('renew', 'close', 'pause'))`.
  - Backend translation: Incoming `"cancel"` is mapped to `"close"` prior to database persistence. Responses return canonical `"close"`.
- **Status:** `draft`, `active`, `closed`, `archived`.
  - Customers/public callers can only view active plans (`is_active: true` and `status: "active"`). Non-active plans return `404 Not Found` for customers.

#### `POST /api/v1/plans`
- **Access:** Admin only (`require_role(["admin"])`)
- **Status:** `201 Created`
- **Request Body:**
  ```json
  {
    "name": "Standard Monthly",
    "code": "PLAN-STD-M",
    "description": "Standard business tier billed monthly",
    "price": "2499.00",
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
- **Response Body (`201`):**
  ```json
  {
    "id": "5ea85f64-5717-4562-b3fc-2c963f66afa8",
    "name": "Standard Monthly",
    "code": "PLAN-STD-M",
    "description": "Standard business tier billed monthly",
    "price": "2499.00",
    "currency": "INR",
    "billing_frequency": "monthly",
    "billing_interval": 1,
    "minimum_quantity": 1,
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "end_of_term_behavior": "renew",
    "status": "active",
    "is_active": true,
    "created_at": "2026-10-31T10:00:00Z",
    "updated_at": "2026-10-31T10:00:00Z"
  }
  ```

#### `GET /api/v1/plans`
- **Access:** Public / Authenticated (Customer sees active plans only)
- **Query Params:** `status` (active/closed/draft/archived), `billing_frequency` (daily/weekly/monthly/yearly), `page` (int), `page_size` (int)
- **Response Body (`200`):** `PlanListResponse` containing `items`, `total`, `page`, `page_size`.

#### `GET /api/v1/plans/{plan_id}`
- **Access:** Public / Authenticated (Returns `404` for non-active plans requested by customers)
- **Status:** `200 OK` (or `404 Not Found`)

#### `PATCH /api/v1/plans/{plan_id}`
- **Access:** Admin only (`require_role(["admin"])`)
- **Status:** `200 OK`
