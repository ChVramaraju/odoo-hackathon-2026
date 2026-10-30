# Security and Privacy Baseline

This is a hackathon project, not a formally audited or certified system. The team lead reports that Supabase is currently used; actual source configuration and remote policy state must be verified.

## Secrets and credentials
Never commit `.env`, database passwords, private keys, API tokens, Supabase service-role credentials or real participant data. Use ignored local configuration and approved secret stores. A key exposed in Git history must be rotated, not merely deleted from the latest commit. Frontend variables (including `VITE_*`) are public. A Supabase publishable/anon key is not a substitute for database authorization.

## Supabase access and RLS
- Determine whether browser clients access Supabase directly or all requests pass through a trusted backend.
- For direct client access, review RLS and grants for every exposed table/view and test both allowed and denied operations.
- Do not assume enabling RLS alone makes a policy correct. Verify the policy conditions against real roles and ownership rules.
- Keep service-role keys server-only. Never use them in browser bundles, `VITE_*` variables, committed files or screenshots.
- Verify Auth/session handling and ensure client-side role checks are not the only authorization layer.
- Record verified tables, policies and test evidence in the database/API inventory; do not claim remote dashboard state from repository files alone.

## Authorization and validation
Enforce user/role access at trusted server boundaries, or through properly tested Supabase RLS/grants or Odoo access/record rules. Treat UI hiding as convenience, not security. Validate inputs, use ORM/parameterized access and document transaction consistency where needed.

## Privacy and logs
Use synthetic development/demo records. Minimize collection; do not log secrets, private payloads, access tokens or sensitive customer data. Define deletion and retention policies when the actual domain requires them.

## Dependencies and integration
Use maintained dependencies after verifying the selected stack, pin versions, avoid unnecessary network providers, protect server-side integrations and handle failures without exposing internal stack traces.

## Reporting concerns
Raise suspected exposed credentials or authorization flaws privately with the lead. Never post secrets to a public issue, screenshot, chat or commit.

## Submission review
- [ ] Secrets checked in current files and relevant history
- [ ] Browser bundle contains no server credentials
- [ ] Supabase access path verified
- [ ] RLS and grants checked for client-visible objects
- [ ] Allowed and forbidden roles tested
- [ ] Inputs and failure paths validated
- [ ] Synthetic/demo data verified
- [ ] Known security limitations disclosed honestly
