# Shared AI Coding Rules

These rules apply to every AI assistant used by the team, including separate Antigravity accounts.

## Before changing code
1. Read README.md, ARCHITECTURE.md, API_CONTRACTS.md, DATABASE_GUIDE.md, TEAM_WORKFLOW.md, and DECISIONS.md.
2. Confirm the official problem statement and the task being implemented. If requirements are missing or ambiguous, ask the team lead or document the assumption instead of inventing product behavior.
3. Inspect existing code and preserve established patterns. Do not replace working files or dependencies without a clear reason.
4. State the intended files and scope before a broad change.

## Engineering rules
- Make the smallest complete change that solves the assigned task.
- Do not add speculative features, mock success states, fake integrations, or unused abstractions.
- Keep UI, domain logic, persistence, and external integrations separated.
- Follow the agreed API and database contracts. Coordinate breaking changes before implementation.
- Validate inputs at boundaries; handle loading, empty, success, and error states in user-facing flows.
- Add or update tests for meaningful behavior. Never claim tests passed unless they were actually run.
- Do not leave broken imports, placeholder credentials, dead code, or undocumented setup steps.
- Prefer readable code and useful names over cleverness. Avoid microservices and unnecessary dependencies during a short hackathon.

## Security rules
- Never place secrets, access tokens, service-role keys, passwords, private user data, or real credentials in source code, prompts committed to the repo, logs, screenshots, or commits.
- Never disable authentication, authorization, validation, or Row Level Security just to make a demo work.
- Treat external API responses and user input as untrusted.
- Use synthetic sample data by default.

## Git rules
- Work only on the assigned branch and within the assigned scope.
- Do not force-push, rewrite shared history, or change branch protection/settings without approval.
- Do not make empty commits or cosmetic commits to satisfy contribution cadence.
- Summarize changed files, behavior, tests run, and remaining risks when handing work back.
- If a change affects another owner's files or contracts, coordinate first.

## Completion report
For each task, report:
- What changed and why
- Files changed
- Commands/tests actually run and their results
- Configuration or migration steps required
- Known limitations or follow-up work
