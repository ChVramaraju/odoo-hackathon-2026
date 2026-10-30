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

## Branches created

All five working branches were created from `main` as a starting point. These branches currently contain the same baseline documentation; they are ready for their owners to begin work.

| Branch | Intended use / owner |
|---|---|
| `main` | Stable, presentable baseline; merge completed and reviewed work here |
| `integration` | Team integration/testing branch; merge feature PRs here first if using this workflow |
| `feature/lead-backend` | Team lead — backend, APIs, business logic, integration tests |
| `feature/sanjeeth-frontend` | Sanjeeth — frontend/UI and API integration |
| `feature/jashwanth-database` | Jashwanth — schema, migrations, constraints, RLS/policies |
| `feature/nihal-modules` | Nihal — scoped supporting module(s), testing, docs, or integration tasks |

Do not have several people commit to the same feature branch at once. Each teammate should clone the repository, check out their own branch, and push their work there. Use pull requests so changes can be reviewed before merging.

## Recommended merge flow

1. Individual owner works on their feature branch and pushes meaningful commits.
2. Open a pull request from the feature branch into `integration` when cross-feature integration is needed; otherwise open a focused PR into `main` for a small independent change.
3. Test the combined journey on `integration`.
4. After review and successful checks, open/merge a PR from `integration` into `main`.
5. Keep `main` presentable for evaluator review and demo.

If the event timeline is very short, a simpler feature-branch-to-main PR flow may be safer than maintaining an extra integration branch. Do not merge untested or conflicting changes just to show activity.

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
