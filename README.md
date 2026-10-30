# Odoo Hackathon 2026 — Team Engineering Workspace

> **Preparation only.** The selected challenge and final runtime implementation still require verification. This repository has been a coordination/design workspace; do not assume that a runnable application exists until source code and startup/test evidence are found.

## Current stack status — important
The team lead reports that the project is currently using **Supabase**. This supersedes the older wording that described Supabase only as an early proposal, but the repository's actual client configuration, schema, migrations, authentication and remote RLS policies must still be verified. Until that audit is complete, treat Supabase as the **current working assumption**, not as proof that every integration is configured correctly.

Do not install or create a second database just because older documentation mentions local PostgreSQL/MySQL. First inspect the existing Supabase integration and reconfirm that the chosen approach satisfies the official challenge rules. The event name alone does not prove that an Odoo-native module is mandatory.

## Event and submission
Four-person team preparing for the **Odoo × CUSAT Make-A-Ton 9.0 virtual qualifier**, 31 October 2026, 9:00 AM–5:00 PM IST. Participant guidance supplied to the team describes a single final solution branch, a repository link, and a publicly accessible solution video. The original organizer document/URL is not archived in this repository; the lead must reconfirm current requirements before submission. Organizer-video notes also report a preference for local persistence, custom APIs, dynamic data and meaningful contributions from all four participants; confirm whether each is mandatory before finalizing architecture.

## Team
| Owner | Responsibility |
|---|---|
| Team lead | Architecture, backend, APIs, integration and submission |
| Sanjeeth | Frontend, UI/UX, integration and deployment |
| Jashwanth | Database, migrations, constraints and integrity |
| Nihal | Scoped supporting modules, tests and quality assurance |

## Architecture decision gate
1. **Odoo-native:** If an Odoo module is required, use the specified Odoo version, ORM, PostgreSQL, views, manifests and access rules.
2. **Existing Supabase application:** Inspect current client calls, schema, auth and RLS before changing the stack. Determine whether the browser calls Supabase directly or a backend mediates access.
3. **Standalone custom API:** Add a separate backend only if official requirements and confirmed architecture need one; document its role and every endpoint.
4. **Hybrid:** Combine Odoo and external components only when the brief explicitly needs both and integration costs are justified.

Default engineering preference, if allowed: one coherent application, one authoritative data store, clear API/data contracts, server-side or database-enforced authorization, and a reproducible end-to-end demo.

## Current repository status
- Documentation, templates and one documentation-check workflow exist.
- The audited documentation snapshot did not contain verified application source, package manifests, database migrations or executable startup commands.
- No complete UI → API/Supabase → database end-to-end journey has been verified by this documentation audit.
- The remote Supabase dashboard has not been inspected through this repository review; remote schema/auth/RLS state remains unverified.

## Documentation
| Start here | Purpose |
|---|---|
| [DOMAIN_MODULES.md](DOMAIN_MODULES.md) | Official challenge, prioritized MVP, acceptance criteria |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Architecture alternatives and boundaries |
| [DECISIONS.md](DECISIONS.md) | Proposed and accepted decisions, including Supabase working assumption |
| [API_CONTRACTS.md](API_CONTRACTS.md) | HTTP and Supabase operation contract rules |
| [API_CALL_INVENTORY.md](API_CALL_INVENTORY.md) | Evidence-based call-by-call API/database inventory |
| [DATABASE_GUIDE.md](DATABASE_GUIDE.md) | Supabase/database schema, migrations, RLS and integrity |
| [TEAM_WORKFLOW.md](TEAM_WORKFLOW.md) | Collaboration, branches, submission |
| [AI_RULES.md](AI_RULES.md) | Guardrails for AI assistants |
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | Local development and tool setup |
| [EVALUATOR_LOG.md](EVALUATOR_LOG.md) | Factual progress and evidence |
| [SECURITY.md](SECURITY.md) | Secrets, authorization and privacy |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Pull requests and review standards |

## Workflow
1. Capture the official statement and rules in `DOMAIN_MODULES.md`.
2. Inspect existing Supabase configuration and record the verified access path in `DECISIONS.md`.
3. Inventory every UI/API/database call and agree contracts before parallel coding.
4. Develop on individual feature branches, integrating and testing early.
5. Consolidate approved solution code into one identified final branch, intended to be `main` unless organizers specify otherwise.
6. Test clean setup and the demo, prepare an accessible video and submit the required links.

## Working safely in your local clone
Open the repository root in Antigravity. Before editing, check:
```powershell
git status
git branch --show-current
git fetch origin
git status -sb
```
If the worktree is clean and tracking the correct remote branch, `git pull --ff-only` is a safe fast-forward-only update. If it refuses, preserve local work and ask the lead to resolve divergence; never reset or force-push.

## Branch ownership
- `main` — stable baseline and intended submission branch
- `integration` — optional integration testing
- `feature/lead-backend` — lead
- `feature/sanjeeth-frontend` — frontend
- `feature/jashwanth-database` — database
- `feature/nihal-modules` — supporting modules/testing

## Submission checklist
- [ ] Exact challenge and judging rules captured
- [ ] Supabase usage and access path verified against source and remote settings
- [ ] Every API/database call inventoried and mapped to implementation/contracts/tests
- [ ] One complete UI → business logic/API → real database journey works
- [ ] Final submitted code consolidated on one branch
- [ ] All four identities have genuine attributable contributions
- [ ] Fresh-clone setup, build and tests verified
- [ ] Input validation, authorization/RLS and errors checked
- [ ] No secrets or sensitive data committed
- [ ] Demo video accessible and limitations reported
- [ ] Lead submits GitHub and video links using official instructions

## License
Not chosen; confirm event and ownership requirements before adding a license.
