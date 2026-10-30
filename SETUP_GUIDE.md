# Reproducible Developer Setup — Windows First

**Current direction:** The team lead reports that the project uses Supabase. Inspect the existing repository configuration and project before installing a separate database or changing frameworks. This documentation audit did not verify a runnable app or its dependency manifests.

## Baseline prerequisites
- Git and a GitHub account with collaborator access.
- Google Antigravity or another editor.
- A local repository clone; open the **repository root**.
- Install only runtimes required by actual manifests/source; do not install React/Vite, FastAPI, Odoo or a local database merely because they appear as alternatives in older design notes.
- Supabase project access may be needed to inspect remote tables/auth/RLS. Never share credentials in chat or commit them.

## Existing clone: inspect before changing
In PowerShell:
```powershell
git status
git branch --show-current
git fetch origin
git status -sb
```
If the working tree is clean and tracks the intended branch, `git pull --ff-only` is safe. If it refuses or local work exists, preserve it and ask the lead; never reset, clean, overwrite or force-push.

## Supabase verification sequence
1. Inspect `package.json`, lockfiles, source and server configuration to identify the actual framework, Supabase SDK and versions.
2. Find every environment variable read by the code. Compare it with `.env.example`; use only names actually referenced by source.
3. Inspect Supabase client initialization and determine whether calls originate in browser code or a server/backend.
4. Inventory all Auth, table/view, RPC, Storage and Realtime calls in [API_CALL_INVENTORY.md](API_CALL_INVENTORY.md).
5. Inspect repository migrations/config and compare them with remote schema/policies using authorized dashboard/CLI access.
6. Verify RLS/grants and both allowed and denied access cases.
7. Only then install missing dependencies or change setup scripts. Never create a second database to work around an uninspected existing project.

## Secrets and environment
Copy `.env.example` to an ignored local `.env` only if the code requires it. The example names are not proof that the application reads them. Never commit passwords, service-role keys or real data. Browser-visible `VITE_*` variables must never contain secrets.

## Setup and verification checklist
- [ ] Fresh clone and correct branch verified
- [ ] Actual package manifests, runtime versions and install scripts identified
- [ ] Environment variable names matched to source
- [ ] Supabase client initialization and access path documented
- [ ] Remote schema/auth/RLS inspected where access is available
- [ ] Migrations/seed setup reproducible
- [ ] App startup/build/test commands actually verified
- [ ] One database-backed happy path and one denied/error path tested
- [ ] Commands and observed results recorded in README and evaluator log

Do not publish an application start command or claim a test passed unless the relevant script was found and run.
