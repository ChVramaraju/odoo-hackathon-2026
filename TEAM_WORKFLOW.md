# Four-Person Development and Git Workflow

## Branch ownership

| Branch | Purpose |
|---|---|
| `main` | Stable evaluator-facing baseline, intended final submission |
| `integration` | Optional integration/testing |
| `feature/lead-backend` | Lead: APIs, backend and architecture |
| `feature/sanjeeth-frontend` | Sanjeeth: UI, deployment and frontend integration |
| `feature/jashwanth-database` | Jashwanth: schema, migrations and integrity |
| `feature/nihal-modules` | Nihal: assigned modules and testing |

During the 30 October 2026 audit, all five non-main branches pointed to an older shared commit. **Do not assume synchronization.** After approved changes, each owner should fetch and safely merge the agreed baseline, without overwriting uncommitted work or rewriting shared history.

## Start-of-day protocol

Each teammate uses a distinct GitHub identity and opens the **repository root** in Antigravity. Confirm branch, fetch updates and check for uncommitted work. Read [AI_RULES.md](AI_RULES.md) and assigned contracts.

## Suggested eight-hour schedule (not official rules)

| Time (IST) | Goal |
|---|---|
| 09:00–09:30 | Select official challenge and MVP |
| 09:30–10:15 | Agree stack, entities, contracts and ownership |
| 10:15–13:00 | Parallel implementation; first end-to-end integration |
| 13:00–15:00 | Complete essential features and error handling |
| 15:00–16:00 | Fresh-start verification and demo rehearsal |
| 16:00–17:00 | Merge final branch, record video and submit with buffer |

## Task and review discipline

Every work item has one owner, requirement reference, acceptance criteria and tests. Commit meaningful progress, not empty commits. Use focused PRs into `integration` or directly into `main` as appropriate. Describe tests actually run, schema/contract changes, risks and screenshots where relevant. Never merge broken work to simulate contribution.

## Final single-branch submission

1. Confirm the branch accepted by organizers (team intent: `main`).
2. Bring all approved features together through reviewed merges, preserving individual authorship.
3. Verify installation, application startup, dynamic database-backed behavior and known limitations.
4. Ensure the public video and code link are accessible.
5. Lead submits required links according to official rules.

Development branches may remain for history but must not be needed to reconstruct the submitted application. Never reset or force-push teammates' branches.

## Handoffs

Post blockers with owner, affected requirement, reproduction and decision needed. Record meaningful choices in [DECISIONS.md](DECISIONS.md), actual verification in [EVALUATOR_LOG.md](EVALUATOR_LOG.md). AI tools must not assume teammates share private chat context.
