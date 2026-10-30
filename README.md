# Odoo Hackathon 2026 — Team Engineering Workspace

> **Preparation only.** The selected challenge, product domain and final runtime stack are pending. This repository contains coordination and design documentation; it does not yet contain a runnable application.

## Event and submission

Four-person team preparing for the **Odoo × CUSAT Make-A-Ton 9.0 virtual qualifier**, 31 October 2026, 9:00 AM–5:00 PM IST. Participant guidance supplied to the team describes a single final solution branch, a repository link, and a publicly accessible solution video. The original organizer document/URL is not archived in this repository; the lead must reconfirm the current requirements before submission. Organizer-video notes also report a preference for local persistence, custom APIs, dynamic data and meaningful contributions from all four participants; confirm whether each is a mandatory rule before finalizing the stack.

**The event name does not by itself require an Odoo-native module.**

## Team

| Owner | Responsibility |
|---|---|
| Team lead | Architecture, backend, APIs, integration and submission |
| Sanjeeth | Frontend, UI/UX, integration and deployment |
| Jashwanth | Database, migrations, constraints and integrity |
| Nihal | Scoped supporting modules, tests and quality assurance |

## Architecture decision gate

Choose after reading the official problem:

1. **Odoo-native:** If an Odoo module is required, use the specified Odoo version, ORM, PostgreSQL, views, manifests and access rules.
2. **Standalone:** If an independent web app is permitted, evaluate React + TypeScript + Vite, FastAPI and a locally runnable PostgreSQL or MySQL database. These are candidates, not requirements.
3. **Hybrid:** Combine Odoo and external components only when the brief explicitly needs both and integration costs are justified.

Default engineering preference, if allowed: a **modular monolith**, one authoritative database, clear API/data contracts, server-side authorization and a reproducible end-to-end demo. Avoid adding services solely for complexity.

## Current repository status

- Documentation, templates and one documentation-check workflow exist.
- **No** frontend, backend, Odoo module, migration or executable solution has been verified.
- No final domain model, endpoints, application start command or deployment are available yet.
- All six remote branches were verified at the same documentation commit `7e8094069d6bdc3e61a83e0e17404a46733fdac8` in the 30 October 2026 audit. This is a historical snapshot: local clones and future branch commits must be checked independently.

## Documentation

| Start here | Purpose |
|---|---|
| [DOMAIN_MODULES.md](DOMAIN_MODULES.md) | Official challenge, prioritized MVP, acceptance criteria |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Architecture alternatives, boundaries, failure modes |
| [DECISIONS.md](DECISIONS.md) | Proposed and accepted decisions |
| [API_CONTRACTS.md](API_CONTRACTS.md) | API design and integration contract |
| [DATABASE_GUIDE.md](DATABASE_GUIDE.md) | Database choice, migrations, integrity |
| [TEAM_WORKFLOW.md](TEAM_WORKFLOW.md) | Collaboration, branches, and submission |
| [AI_RULES.md](AI_RULES.md) | Guardrails for Antigravity and other AI assistants |
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | Local development and tool selection |
| [EVALUATOR_LOG.md](EVALUATOR_LOG.md) | Factual progress and evidence |
| [SECURITY.md](SECURITY.md) | Secrets, authorization and privacy |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Pull requests and review standards |

## Workflow

1. Capture the chosen official statement and rules in `DOMAIN_MODULES.md`.
2. Record the accepted architecture/database in `DECISIONS.md`.
3. Define one working vertical slice and agree interfaces before parallel coding.
4. Develop on individual feature branches, integrating and testing early.
5. Consolidate all submitted solution code into one identified final branch, intended to be `main` unless organizers specify otherwise.
6. Test clean setup and the demo, prepare an accessible video and submit the required links.

## Working safely in your local clone

Open the repository root in Antigravity. Before editing, check:

```powershell
git status
git branch --show-current
git fetch origin
git status -sb
```

If the worktree is clean and tracking the correct remote branch, `git pull --ff-only` is a safe fast-forward-only update. If it refuses, preserve local work and ask the lead to help resolve divergence; never reset or force-push. The commands above are reviewed by inspection, not executed on teammates' machines. See [SETUP_GUIDE.md](SETUP_GUIDE.md).

## Branch ownership

- `main` — stable baseline and intended submission branch
- `integration` — optional integration testing
- `feature/lead-backend` — lead
- `feature/sanjeeth-frontend` — Sanjeeth
- `feature/jashwanth-database` — Jashwanth
- `feature/nihal-modules` — Nihal

Do not force-push or reset a teammate's branch. Use meaningful real commits; no fabricated activity or test claims.

## Submission checklist

- [ ] Exact challenge and judging rules captured
- [ ] One complete UI → API/business logic → real database journey works
- [ ] Final submitted code consolidated on one branch
- [ ] All four identities have genuine attributable contributions
- [ ] Fresh-clone setup, build and tests verified
- [ ] Input validation, authorization and errors checked
- [ ] No secrets or sensitive data committed
- [ ] Demo video accessible and limitations reported
- [ ] Lead submits GitHub and video links using official instructions

## License

Not chosen; confirm event and ownership requirements before adding a license.
