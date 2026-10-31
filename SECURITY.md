# Security Baseline

## Secrets

- Never commit .env, access tokens, passwords, database passwords, private API keys, or real customer data.
- Supabase service-role keys and database credentials are server-only. Never place them in frontend code or VITE_* variables.
- Browser-visible Supabase publishable/anon keys are not secrets, but may be used only with appropriate grants and tested Row Level Security.
- Use .env.example for placeholders and update names to match actual source reads.

## Authentication and authorization

- Supabase Auth handles identity and password reset.
- FastAPI verifies access tokens before protected requests.
- Role and record ownership checks occur server-side on every protected operation.
- Customers can access only their own subscriptions, invoices and payments.
- Only admins may add staff or manage restricted settings.
- Staff permissions must be explicit and limited to approved operational tasks.
- Do not trust role, owner ID, price, discount, tax, total, invoice state or paid state supplied by a browser.

## Database

- Apply least-privilege grants and RLS where client roles can reach tables.
- Test both allowed and denied cases.
- Use foreign keys, uniqueness, check constraints and transactions.
- Recurring invoice duplication must be prevented by a database-enforced unique key for subscription and billing period.
- Avoid logging credentials or sensitive customer/payment details.

## AI assistant

- AI is not an authorization layer.
- Use a small allowlist of typed backend tools; each tool validates input and checks permissions.
- Never let the model execute arbitrary SQL or access a broader data scope than the authenticated user.
- Ground recommendations in configured plans and real query results.
- Require explicit confirmation and fresh permission checks for any future state-changing tool.

## Reporting an issue

Tell the team lead privately with reproduction steps and affected files. Do not publish secrets or sensitive customer data in a public issue.
