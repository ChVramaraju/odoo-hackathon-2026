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

## D-002 — Choose stack after official problem
- **Date:** 2026-10-30
- **Status:** Proposed, not accepted
- **Owner:** Team lead
- **Options:** Odoo-native framework; standalone React/TypeScript + FastAPI + local PostgreSQL/MySQL; limited hybrid.
- **Selection criteria:** Mandatory platform rules, required behavior, team proficiency, local reproducibility, integration cost and demonstration reliability.
- **Note:** Supabase was originally suggested, but should not be assumed when organizer-video notes favor local database and team-built APIs.

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

## Open decisions

| Item | Owner | Decision gate |
|---|---|---|
| Official challenge / Odoo requirement | Lead | Once problem is released |
| Database engine and version | Lead + Jashwanth | After rules and setup comparison |
| Backend and frontend runtimes | Lead + Sanjeeth | After feature and platform analysis |
| Auth and data access model | Lead + Jashwanth | After actors and protected actions |
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
