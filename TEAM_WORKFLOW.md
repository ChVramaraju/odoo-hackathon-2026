# Team Workflow

## Roles and ownership

| Teammate | Primary area | Expected outputs |
|---|---|---|
| Team lead / repository owner | Architecture, backend, API/business logic, integration | Architecture decisions, API contracts, backend workflows, integration tests, end-to-end coordination |
| Sanjeeth | Frontend and UI/UX | Responsive accessible UI, reusable components, API integration, UI tests |
| Jashwanth | Database | Schema, migrations, constraints, RLS/policies, seed data, integrity tests |
| Nihal | Supporting modules | Scoped features identified from requirements, integrations, tests, docs, and gap-filling agreed with the team |

Ownership is a coordination aid, not a reason to block necessary collaboration. Agree cross-cutting changes with the relevant owner. Replace names with GitHub handles if helpful.

## Before coding
1. Read the README and relevant guidance documents.
2. Extract the actual problem statement, constraints, judging criteria, and submission requirements.
3. Define one minimal end-to-end demo journey and its acceptance criteria.
4. Agree API contracts and data entities before parallel implementation.
5. Assign each task one owner and a clear completion definition.

## Branch strategy
- `main`: presentable, stable, demo-ready branch.
- `integration`: optional shared integration branch if parallel work creates a need; keep it tested.
- Feature branches: `feature/<short-task>`, for example `feature/frontend-dashboard`, `feature/api-core`, `feature/db-schema`, `feature/ai-adapter`.
- Do not create branches merely to match a template. Use the simplest workflow the team can reliably follow.

## Commits and hourly cadence
Each teammate must push meaningful work at least once every hour while actively working, per the team requirement. Good updates include a tested component, an agreed migration, a documented API, a bug fix, a test, or a clear integration improvement. Do not use empty commits, meaningless whitespace changes, or untested broken changes to game contribution history.

Suggested commit prefixes: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.

## Pull requests
Each PR should include:
- Problem/requirement addressed
- What changed
- How to test it
- Screenshots or a short demo note for visible UI changes
- Schema/configuration changes
- Known limitations and follow-ups

Keep PRs focused. Request a review from the relevant owner. Resolve conflicts and verify the combined flow before merging. Do not merge code that breaks the agreed demo path.

## Antigravity collaboration
Each teammate may use a separate Antigravity account/assistant. Keep shared instructions in AI_RULES.md and contracts in this repository so assistants do not depend on private chat context. AI-generated changes must be reviewed and tested by the human contributor who submits them.

## Evaluator-facing hygiene
- Follow organizer instructions for evaluator access and repository visibility.
- Keep README and EVALUATOR_LOG.md factual and current.
- Show real progress, actual tests, known limitations, and demo steps.
- Do not commit credentials, private user data, or misleading claims.
