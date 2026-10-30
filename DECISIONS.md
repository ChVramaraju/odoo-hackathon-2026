# Architecture Decision Register

Important decisions must have an owner, status, alternatives, rationale and consequences. A proposal is not an accepted stack.

## D-001 — Modular monolith as default engineering shape
- **Date:** 2026-10-30
- **Status:** Proposed
- **Owner:** Team lead
- **Context:** Four-person team, eight-hour qualifier and uncertain requirements.
- **Recommendation:** Favor explicit UI/domain/persistence boundaries in a single coherent application instead of microservices.
- **Alternatives:** Multi-service architecture, Odoo-native module.
- **Consequence:** Faster setup and easier debugging; final selection still depends on official rules.

## D-002 — Supabase as current working database assumption
- **Date:** 2026-10-30
- **Status:** User-reported working choice; repository configuration not yet verified
- **Owner:** Team lead + database owner
- **Context:** The lead reports that the team is using Supabase. Earlier repository docs described Supabase as an early proposal and the database decision as open; those statements are now stale relative to the reported team direction.
- **Working direction:** Audit the existing Supabase project and code before installing or adding another database. Prefer one authoritative data store. Do not create a parallel local database unless official rules or a documented technical need require it.
- **Not yet verified:** Supabase project URL/configuration, auth setup, schema, migrations, RLS policies, whether the browser calls Supabase directly, whether a custom backend exists, and whether remote configuration matches repository files.
- **Constraint:** The official challenge and organizer rules override this working assumption. If they require Odoo-native implementation or local-only persistence, revisit this decision explicitly before implementation.
- **Alternatives:** Odoo-managed PostgreSQL/ORM if Odoo-native is mandatory; local PostgreSQL/MySQL if local persistence is mandatory; a backend-mediated Supabase architecture if server-side business logic is required.
- **Required verification:** Inspect source, environment variable names, migrations, Supabase config, API calls, and RLS. Never commit real keys or expose service-role credentials.

## D-003 — Single submission branch
- **Date:** 2026-10-30
- **Status:** Team-adopted based on previously supplied participant guidance; current official source/URL not archived in repository
- **Owner:** Team lead
- **Decision:** Keep individual feature branches during development, then consolidate final code on one branch (team intent: `main`) and submit that repository plus the required video.
- **Risk:** Last-minute merge conflicts; integrate early and reserve submission time.
- **Verification needed:** Reconfirm final branch, video visibility and deadline from official organizer materials before submission.

## D-004 — Contract-first teamwork
- **Date:** 2026-10-30
- **Status:** Proposed
- **Owner:** Lead, Sanjeeth and Jashwanth
- **Decision:** Agree first user journey, domain entities, request/response contracts and ownership before parallel implementation.
- **Reason:** Reduces broken UI/backend/database integration.

## Open decisions and verification
| Item | Owner | Status / decision gate |
|---|---|---|
| Official challenge / Odoo requirement | Lead | Must verify against organizer source before final stack |
| Supabase project and access path | Lead + Jashwanth | Current working assumption; inspect actual code and remote configuration |
| Database engine and version | Lead + Jashwanth | Record Supabase/PostgreSQL details if confirmed; revisit if rules require local-only persistence |
| Frontend runtime | Lead + Sanjeeth | Verify from package manifests; do not assume React/Vite without evidence |
| Custom backend runtime | Lead | Determine whether a server/API exists and is required; do not add one by default |
| Auth and data access model | Lead + Jashwanth | Verify Supabase Auth, server auth, and RLS behavior |
| Deployment and demo environment | Sanjeeth + lead | After local end-to-end test |

## Decision template
```text
ID and title:
Date:
Status: Proposed / Accepted / Superseded
Owner:
Official requirement or context:
Decision and rationale:
Alternatives evaluated:
Consequences / risks:
Verification evidence:
```
