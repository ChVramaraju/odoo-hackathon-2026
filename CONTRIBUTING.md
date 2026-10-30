# Contributing to the Odoo Hackathon Repository

## Before making changes

Read [README.md](README.md), [AI_RULES.md](AI_RULES.md), [TEAM_WORKFLOW.md](TEAM_WORKFLOW.md) and assigned contracts. Confirm the official problem, branch, task owner and acceptance criteria.

## Branch and change policy

Use your own GitHub identity and assigned feature branch. Keep commits focused, meaningful and attributable; never fabricate commits. Coordinate before editing another owner's schema, API or architecture. Do not force-push shared branches, rewrite history or commit directly to `main` without lead approval.

## Definition of done

- Code addresses a confirmed requirement and follows current architecture.
- The critical path is implemented, integrated and tested as appropriate.
- API, schema, environment and setup changes are documented.
- Failure states and authorization are handled where relevant.
- Real test commands and results are reported; unknown/untested items labeled honestly.
- No secrets, private data, generated junk or unrelated churn.

## PR description

```text
Requirement:
Owner and base branch:
Summary:
Files changed:
API or database contract changes:
Tests run and observed results:
Screenshots / demo path:
Known limitations:
Reviewers:
```

Ensure the final project works from one submitted branch even when history includes separate development branches.
