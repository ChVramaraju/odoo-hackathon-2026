# Brightloop Subscription Management — Scope and Acceptance Criteria

## Problem summary

Brightloop Software sells software subscriptions and add-ons, including product variants. Current work relies on spreadsheets and manual renewal reminders, invoice preparation, payment matching, and finance reports. The target system should reduce missed renewals, incorrect invoices, and unclear recurring revenue.

## Must-have requirements

1. **Accounts and access:** email/password sign-in, unique email, password policy from the brief, password reset, admin/staff/customer roles. Only admin adds staff. Customers can view only their own records.
2. **Products and variants:** product name/type, sales and cost price, notes, variants, and price adjustments.
3. **Plans:** price, daily/weekly/monthly/yearly frequency, minimum quantity, availability dates, and configured end-of-term behavior.
4. **Quotations:** templates, correct plan/product lines, and validity days.
5. **Subscriptions:** unique reference, customer, plan, dates, payment terms, lines, quantities, prices, taxes, totals, and visible lifecycle.
6. **Billing:** automatically create an invoice when a subscription is due, prefill customer/line/tax/total information, support confirmation/cancellation/sending/printing as required, and prevent duplicate or missed billing.
7. **Discounts:** admin-created fixed or percentage discounts, eligibility thresholds, effective dates, usage limits, and scope.
8. **Payments:** record method, amount, date, note/reference and linked invoice; show paid/outstanding balances and overdue status.
9. **Finance dashboard:** active subscriptions, revenue, payments, overdue invoices and outstanding amount with useful filters.
10. **Performance:** target normal pages under two seconds with thousands of subscriptions; measure before claiming success.

## Proposed subscription lifecycle

`Draft → Quotation → Confirmed → Active → Closed`

Pause, resume, renew, early close, and end-of-term behavior are actions with explicit valid transitions. Implement and document the state-transition rules centrally; do not make the frontend independently decide lifecycle validity.

## Core end-to-end acceptance test

1. Admin creates a product/variant, tax rule, and plan.
2. A customer/authorized staff member creates a quotation with correct lines and validity.
3. The quotation is confirmed and a subscription becomes active.
4. Billing job is run for a due subscription.
5. Exactly one invoice is created for the billing period with correct customer, line snapshots, tax, discount, and total.
6. A payment is recorded against the invoice.
7. Invoice balance and dashboard values update correctly.
8. Customer A cannot view Customer B's subscription, invoice, or payment.
9. Retrying the billing job does not duplicate the invoice.

## Differentiators — after Must-have workflow

- Subscription Health Radar: upcoming expiries, renewals, overdue and billing attention with prioritized follow-up.
- Revenue Forecast and What-If: estimated scheduled revenue and scenario assumptions clearly labelled as estimates.
- Smart Invoice Explainer: transparent breakdown of quantities, prices, taxes and discounts.
- Retention/Renewal Insights: transparent rule-based signals, not unexplained AI scores.
- Audit Trail: actor, action, entity and timestamps for important changes.
- Role-aware AI assistant: configured-plan recommendations and a small set of permission-checked, read-only business queries. It must ground answers in database results.

These extras are not allowed to block the core workflow. No payment gateway or full ecommerce shopping cart is assumed by the problem statement.

## Definition of done

A requirement is complete only when integrated code, persisted data, access control, validation/error handling, and acceptance evidence exist. Mark incomplete or untested items honestly.
