# Contributing to Brightloop

## Read first

Every contributor must follow PROJECT_STANDARD.md. Related references: ARCHITECTURE.md, API_CONTRACTS.md, DATABASE_GUIDE.md, TEAM_WORKFLOW.md, AI_RULES.md, and DOMAIN_MODULES.md.

## Required stack

React + TypeScript + Vite; Tailwind CSS + shadcn/ui; React Hook Form + Zod; TanStack Query; Python + FastAPI + Pydantic; Supabase PostgreSQL; Supabase Auth; SQL migrations; Pytest and Vitest.

Do not add another stack or data store without a reviewed decision in DECISIONS.md. Official organizer constraints take precedence.

## Before coding

1. Check branch and working tree: git status, git branch --show-current.
2. Confirm task, owner, acceptance criteria and contract dependencies.
3. Read current API/schema docs; do not invent routes, fields or enum values.
4. Preserve local changes and teammates' work.

## Code and data rules

- Keep business logic in backend domain services.
- Validate requests in FastAPI/Pydantic and enforce authorization server-side.
- Use Supabase PostgreSQL with reviewed migrations.
- Use Decimal/NUMERIC for financial amounts.
- Make recurring invoice generation idempotent.
- Do not expose service-role keys in browser code.
- AI tools must be allowlisted and independently permission-checked.

## Pull requests

Include:
- Requirement and user-visible behavior
- Files changed
- API/schema/environment impact
- Tests actually run and results
- Known gaps and next owner

Do not claim tests or functionality passed unless verified. Avoid unrelated changes and breaking contract changes without team agreement.
