# Shared AI Coding and Repository Governance

These rules apply to ChatGPT, Google Antigravity and any other assistant working with this four-person repository.

1. **Inspect first:** Read the README, official challenge plan, architecture, contracts, database guide, team workflow and decisions.
2. **Requirements before implementation:** Official organizer instructions and the selected problem override suggestions. Never assume an Odoo-native requirement from the event name alone.
3. **Permission and scope:** Confirm the branch, working-tree state, requested files and authorization before editing. Cross-owner changes require coordination. Direct `main` edits require explicit lead approval.
4. **No destructive Git operations:** Do not force-push, rewrite shared history, delete branches or alter settings/secrets without explicit authorization.
5. **Contracts first:** Agree entity definitions, endpoint schemas and permission rules before changing shared interfaces. Announce breaking changes.
6. **No invented progress:** Never claim an implementation, test, deployment, PR, or integration succeeded unless observed.
7. **Security:** Never commit credentials, passwords, service-role keys, private datasets or sensitive logs. Browser variables are public.
8. **Quality:** Validate inputs, enforce trusted authorization, handle empty/loading/error states, test critical paths and use database integrity controls.
9. **Avoid speculative code:** No invented feature, dependency, framework replacement or directory solely to fill out a scaffold.
10. **One submission branch:** Preserve genuine, attributable contributions and consolidate all final solution code into one identified branch.
11. **Human review:** Each assigned owner reviews assistant-produced work and communicates cross-team impacts.

## Required handoff

```text
Requirement / task:
Branch + commit:
Files changed and why:
Behavior delivered:
Commands actually run:
Tests passed / failed / not run:
Schema / API / environment impacts:
Known risks and next owner:
```

If official rules conflict with team plans, escalate to the lead before proceeding.
