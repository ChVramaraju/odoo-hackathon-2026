# Odoo Hackathon 2026

> A collaborative, hackathon-ready project workspace. The final product scope and implementation must be updated after the official problem statement is released.

## Status

**Preparation scaffold — problem statement pending.** This repository currently establishes team workflow, engineering conventions, security practices, and a place to document decisions. It does not yet claim to implement a solution.

## Team

| Member | Primary ownership | Responsibilities |
|---|---|---|
| Team lead (repository owner) | Architecture, backend, APIs, integration | Own system design and API contracts; coordinate integration; review cross-cutting changes and test end-to-end flows. |
| Sanjeeth | Frontend and UI/UX | Build accessible screens and user flows; integrate against agreed API contracts; flag contract changes before implementing them. |
| Jashwanth | Database and data integrity | Design schema, constraints, indexes, and migrations; coordinate schema changes with backend and frontend owners. |
| Nihal | Supporting modules and uncovered requirements | Pick up scoped modules, integrations, testing, documentation, and other work identified after requirements are understood. |

Replace role labels with GitHub handles in TEAM_WORKFLOW.md if useful. Do not assume unconfirmed requirements or create features just to fill the repository.

## Proposed default stack

This is a **starting point, not a hackathon requirement**. The official problem statement, organizer rules, deployment environment, and any Odoo-specific requirements take precedence.

- **Frontend:** React + TypeScript + Vite
- **UI:** Tailwind CSS; shadcn/ui components when useful
- **Data/auth/storage:** Supabase (PostgreSQL, Auth, Storage, Realtime as needed)
- **Custom backend:** Python + FastAPI + Pydantic when custom server-side workflows, privileged operations, AI, or integrations need it
- **Database changes:** versioned SQL migrations
- **Tests:** Vitest + React Testing Library; Pytest for Python; Playwright for critical user journeys if time permits
- **Collaboration:** GitHub, pull requests, and Google Antigravity IDE

Avoid adding every technology by default. If the challenge requires building an Odoo module, using Odoo's ORM, XML views, manifests, or specific APIs, document that decision and use the official Odoo development path instead of forcing this generic stack.

## Repository map

- [SETUP_GUIDE.md](SETUP_GUIDE.md) — tools to install, what is optional, cloning, and branch checkout
- [AI_RULES.md](AI_RULES.md) — shared instructions for AI coding assistants, including Antigravity
- [ARCHITECTURE.md](ARCHITECTURE.md) — component boundaries and data flow
- [API_CONTRACTS.md](API_CONTRACTS.md) — API conventions and integration agreements
- [DATABASE_GUIDE.md](DATABASE_GUIDE.md) — schema, migrations, and data safety
- [TEAM_WORKFLOW.md](TEAM_WORKFLOW.md) — ownership, branches, commits, and integration
- [DOMAIN_MODULES.md](DOMAIN_MODULES.md) — how to turn the actual challenge into scoped modules
- [EVALUATOR_LOG.md](EVALUATOR_LOG.md) — concise, factual progress record
- [DECISIONS.md](DECISIONS.md) — important technical decisions and rationale
- [CONTRIBUTING.md](CONTRIBUTING.md) — development and pull-request checklist
- [SECURITY.md](SECURITY.md) — secrets, access control, and reporting concerns
- [.env.example](.env.example) — names and examples of configuration variables; never real secrets
- [.github/](.github/) — contribution templates and basic documentation checks

## Getting started

1. Read this README, SETUP_GUIDE.md, TEAM_WORKFLOW.md, and AI_RULES.md.
2. Add the official problem statement, constraints, judging criteria, and submission requirements to DOMAIN_MODULES.md.
3. Agree on the smallest demonstrable end-to-end user journey before splitting implementation tasks.
4. Confirm the stack against organizer rules; record any change in DECISIONS.md.
5. Agree API and data contracts before parallel implementation.
6. Add the actual application code, dependency manifests, tests, and deployment instructions once the requirements are known.

### Local setup

The current repository is a preparation scaffold and does not yet contain runnable frontend/backend application code. Follow SETUP_GUIDE.md to install baseline tools and clone the repository. Application-specific install/run commands will be added after the actual architecture is confirmed.

## Branches

- `main` — stable, evaluator-facing baseline
- `integration` — combined testing branch
- `feature/lead-backend` — team lead's backend/API work
- `feature/sanjeeth-frontend` — Sanjeeth's frontend/UI work
- `feature/jashwanth-database` — Jashwanth's schema/migration work
- `feature/nihal-modules` — Nihal's agreed supporting work

See TEAM_WORKFLOW.md before committing. Use feature branches and pull requests; keep main presentable.

## Collaboration rules

- Use Antigravity IDE or another editor; keep repository conventions independent of any one editor.
- Work on focused branches and open pull requests into main or the agreed integration branch.
- Make meaningful, reviewable commits regularly. The team's hourly contribution requirement means each member should push a real update at least once per hour while actively working—not empty or cosmetic commits.
- Keep main in a presentable, working state. Do not merge untested or conflicting changes just to show activity.
- Never commit .env files, credentials, private data, or production secrets.
- Record major decisions and evaluator-facing progress in the relevant Markdown files.
- Follow the event's exact rules for evaluator access, repository visibility, attribution, and submission.

## Security baseline

- Frontend variables are public. Never put service-role keys, database passwords, signing secrets, or AI-provider keys in client code.
- Enforce authorization server-side and/or with properly configured Supabase Row Level Security (RLS).
- Validate inputs at trust boundaries; use parameterized database access.
- Keep test data synthetic unless the team is explicitly authorized to use real data.
- See SECURITY.md.

## Before submission

- [ ] Problem statement and judging criteria are reflected in the README and demo flow.
- [ ] A fresh clone can be set up using documented steps.
- [ ] Core user journey works from UI to backend/data store.
- [ ] Tests and build checks pass, or known failures are clearly documented.
- [ ] .env.example is current and contains placeholders only.
- [ ] No secrets or personal data are in the repository or commit history.
- [ ] Demo instructions, sample data, limitations, and future work are documented.
- [ ] Evaluator access and submission steps follow organizer instructions.

## License

No license has been selected yet. Confirm ownership and event rules before adding one.
