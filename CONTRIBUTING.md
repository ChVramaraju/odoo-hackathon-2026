# Contributing

## First steps
1. Read README.md and TEAM_WORKFLOW.md.
2. Read AI_RULES.md before asking an AI assistant to modify project files.
3. Check DOMAIN_MODULES.md for confirmed requirements and assigned tasks.
4. Ask the task owner before changing a shared API contract, database schema, or architectural decision.

## Development expectations
- Keep changes focused and explain why they are needed.
- Follow existing formatting, naming, and error-handling patterns.
- Add or update tests for behavior changes.
- Update documentation when setup, contracts, environment variables, or user flows change.
- Never commit secrets or real user data.
- Do not claim a check passed unless it was run.

## Pull request checklist
- [ ] Linked to a requirement or task
- [ ] Scope and behavior described
- [ ] Tests added/updated and run where applicable
- [ ] API/schema/config changes documented
- [ ] No secrets, generated junk, or unrelated formatting churn
- [ ] Main demo journey remains functional or impact is clearly explained

## Commit message examples
- `docs: document database migration workflow`
- `feat: add primary user workflow`
- `fix: handle expired session response`
- `test: cover authorization failure`
