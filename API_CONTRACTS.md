# API Contracts — Brightloop

**Base prefix:** `/api/v1`  
**Format:** JSON over HTTPS  
**Status:** Proposed shared contract. An endpoint is not implemented merely because it appears here. FastAPI OpenAPI output and automated tests become the executable evidence.

## Conventions

- Authentication: `Authorization: Bearer <Supabase access token>` for protected routes. FastAPI verifies the token before handling the request.
- IDs: UUID strings.
- Timestamps: ISO 8601 with timezone.
- Money: decimal strings in JSON for exact representation; backend uses Python `Decimal` and PostgreSQL `NUMERIC`. Include currency explicitly where needed.
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

### 1. Products & Variants

#### `POST /api/v1/products`
- **Access:** Admin only (`require_role(["admin"])`)
- **Status:** `201 Created`
- **Request Body:**
  ```json
  {
    "name": "Cloud Storage Pro",
    "type": "service",
    "sales_price": "29.99",
    "cost_price": "10.00",
    "currency": "USD",
    "notes": "Premium cloud storage tier",
    "is_active": true
  }
  ```
- **Response Body (`201`):**
  ```json
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Cloud Storage Pro",
    "type": "service",
    "sales_price": "29.99",
    "cost_price": "10.00",
    "currency": "USD",
    "notes": "Premium cloud storage tier",
    "is_active": true,
    "created_at": "2026-10-31T10:00:00Z",
    "updated_at": "2026-10-31T10:00:00Z"
  }
  ```

#### `GET /api/v1/products`
- **Access:** Public / Authenticated
- **Query Params:** `active_only` (bool, default `false`), `page` (int, default `1`), `page_size` (int, default `20`)
- **Response Body (`200`):**
  ```json
  {
    "items": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "Cloud Storage Pro",
        "type": "service",
        "sales_price": "29.99",
        "cost_price": "10.00",
        "currency": "USD",
        "notes": "Premium cloud storage tier",
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
- **Access:** Public / Authenticated
- **Status:** `200 OK` (or `404 Not Found`)

#### `PATCH /api/v1/products/{product_id}`
- **Access:** Admin only
- **Status:** `200 OK`

#### `POST /api/v1/products/{product_id}/variants`
- **Access:** Admin only
- **Status:** `201 Created`
- **Request Body:**
  ```json
  {
    "name": "User Seat",
    "value": "10-User Pack",
    "price_adjustment": "25.00",
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
    "price_adjustment": "25.00",
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

#### `POST /api/v1/plans`
- **Access:** Admin only
- **Status:** `201 Created`
- **Request Body:**
  ```json
  {
    "name": "Standard Monthly",
    "description": "Standard business tier billed monthly",
    "price": "49.00",
    "currency": "USD",
    "billing_frequency": "monthly",
    "billing_interval": 1,
    "minimum_quantity": 1,
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "end_of_term_behavior": "renew",
    "status": "active"
  }
  ```
- **Response Body (`201`):** `PlanResponse` object.

#### `GET /api/v1/plans`
- **Access:** Public / Authenticated
- **Query Params:** `status` (active/closed), `billing_frequency` (daily/weekly/monthly/yearly), `page` (int), `page_size` (int)
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
- **Access:** Admin only
- **Status:** `200 OK`
