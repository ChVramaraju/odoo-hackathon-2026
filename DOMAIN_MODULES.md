# Problem Statement and Module Planning

## Current status
**Pending official problem statement.** This file intentionally does not invent a product domain, user persona, feature list, or judging criterion.

## Record the official brief
When available, add:
- Exact challenge title and statement
- Target users and pain point
- Required capabilities and prohibited approaches
- Technical/platform constraints (including whether Odoo itself is required)
- Judging criteria and scoring weights
- Submission deadline, demo format, and evaluator instructions
- External services or datasets permitted
- Known risks and assumptions

Quote or link official material where allowed; distinguish confirmed requirements from team assumptions.

## Turn the brief into an MVP
1. Identify the primary user and the problem the demo must solve.
2. Write one end-to-end scenario with observable success criteria.
3. Split it into the smallest useful modules.
4. Mark each item as **Must**, **Should**, or **Could**.
5. Assign one owner, dependencies, acceptance criteria, and a test for every Must item.
6. Build a thin vertical slice before adding optional features.

## Module planning template
| Module | User value | Inputs/outputs | Owner | Dependencies | Acceptance test | Status |
|---|---|---|---|---|---|---|
| TBD | Fill after the brief is confirmed | TBD | TBD | TBD | Given/when/then | Not started |

## Domain-specific options (only if needed)
- **AI/ML:** define the task, data source, evaluation method, latency/cost limits, fallback behavior, and privacy boundary before choosing a model.
- **Fintech:** use a sandbox provider, server-side authorization, idempotency for repeatable operations, auditability, and explicit failure states. Never process real money or store payment credentials without authorization.
- **Education:** define learner/educator roles, accessibility requirements, and what data may be collected.
- **Robotics/IoT:** confirm hardware access early; define telemetry protocol, simulation fallback, device authentication, and safe failure behavior.
- **Odoo:** confirm target Odoo version and required module/API conventions; follow Odoo's model, view, security, and module packaging practices.
- **Other domains:** choose only libraries and integrations required to meet confirmed acceptance criteria.

These are planning prompts, not requirements. Avoid building all of them.
