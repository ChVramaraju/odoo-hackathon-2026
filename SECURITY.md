# Security and Privacy Baseline

This is a hackathon project, not a formally audited or certified system.

## Secrets and credentials

Never commit `.env`, database passwords, private keys, API tokens, service-role credentials or real participant data. Use ignored local configuration and approved secret stores. A key exposed in Git history must be rotated, not merely deleted from the latest commit. Frontend variables (including `VITE_*`) are public.

## Authorization and validation

Enforce user/role access at trusted server boundaries, or through properly tested Odoo access/record rules. If Supabase is selected, enforce and test RLS. Treat UI hiding as convenience, not security. Validate inputs, use ORM/parameterized access and document transaction consistency where needed.

## Privacy and logs

Use synthetic development/demo records. Minimize collection; do not log secrets, private payloads, access tokens or sensitive customer data. Define deletion and retention policies when the actual domain requires them.

## Dependencies and integration

Use maintained dependencies after the stack is chosen, pin versions, avoid unnecessary network providers, protect server-side integrations and handle failures without exposing internal stack traces.

## Reporting concerns

Raise suspected exposed credentials or authorization flaws privately with the lead. Never post secrets to a public issue, screenshot, chat or commit.

## Submission review

- [ ] Secrets checked in current files and relevant history
- [ ] Browser bundle contains no server credentials
- [ ] Allowed and forbidden roles tested
- [ ] Inputs and failure paths validated
- [ ] Synthetic/demo data verified
- [ ] Known security limitations disclosed honestly
