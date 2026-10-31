# API and Database Call Inventory

**Purpose:** Keep the frontend-to-backend and backend-to-database contract visible in one place.

**Status:** Target inventory, not evidence of implemented calls. Update each row with source file, schema and test evidence when code exists.

## Required inventory columns

For every HTTP route or database operation, record: requirement, owner, source file, method/path or table/function, request fields, response shape, roles/ownership, tables affected, transaction/idempotency behavior, test command and observed result.

## Target REST routes

| Area | Target route(s) | Primary data |
|---|---|---|
| Current user | GET /api/v1/auth/me | profiles |
| Products | GET/POST /api/v1/products; GET/PATCH /api/v1/products/{id} | products, product_variants |
| Plans | GET/POST /api/v1/plans; GET/PATCH /api/v1/plans/{id} | plans, plan_products |
| Quotations | GET/POST /api/v1/quotations; POST /api/v1/quotations/{id}/confirm | quotations, quotation_lines |
| Subscriptions | GET/POST /api/v1/subscriptions; GET/PATCH /api/v1/subscriptions/{id} | subscriptions, subscription_lines |
| Subscription actions | POST /api/v1/subscriptions/{id}/pause, /resume, /renew, /close | subscriptions, audit_logs |
| Invoices | GET/POST /api/v1/invoices; GET /api/v1/invoices/{id}; POST /api/v1/invoices/{id}/confirm or /cancel | invoices, invoice_lines |
| Payments | GET/POST /api/v1/payments | payments, invoices |
| Discounts | GET/POST /api/v1/discounts; PATCH /api/v1/discounts/{id} | discounts, discount_redemptions |
| Dashboard | GET /api/v1/dashboard/summary | subscriptions, invoices, payments |
| Health radar | GET /api/v1/analytics/subscription-health | subscriptions, invoices |
| Forecast | GET /api/v1/analytics/revenue-forecast | subscriptions, invoices |
| Audit | GET /api/v1/audit-logs | audit_logs |
| Assistant | POST /api/v1/assistant/chat | Approved domain tools only |

Exact schemas, response status codes and filters must be specified in FastAPI/Pydantic and reflected in API_CONTRACTS.md before frontend integration.

## Rules

- Backend verifies Supabase Auth tokens and enforces role/record ownership.
- Never trust client-supplied financial totals or roles.
- Billing creation must be idempotent for each subscription/billing period.
- All database writes must use validated domain services and appropriate transaction boundaries.
- Keep inventory current; never mark a planned route as implemented until found in source and tested.
