# Reproducible Developer Setup — Windows First

**Preparation-only:** No application dependency manifests or startup scripts exist yet. Do not install every candidate framework before the official problem and stack are confirmed.

## Baseline prerequisites

- Git and a GitHub account with collaborator access.
- Google Antigravity or another editor.
- A local repository clone; open the **repository root**.
- Node.js LTS **only if** the selected stack uses React/Vite.
- Python 3 **only if** FastAPI, Odoo or Python modules are selected.
- PostgreSQL/MySQL/Odoo dependencies **only after** selecting the exact engine/version.

Verify whichever tools are applicable with `git --version`, `node --version`, `npm --version` and `python --version`.

## Team clone location

On Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force -Path "$HOME\Documents\OdooHackathon"
Set-Location "$HOME\Documents\OdooHackathon"
git clone https://github.com/ChVramaraju/odoo-hackathon-2026.git
Set-Location ".\odoo-hackathon-2026"
git fetch origin
git branch -a
git status
```

Only clone if no repository copy exists at the target. Do not create a nested clone inside another repository.

## Choose your branch

```powershell
git switch feature/lead-backend
# Sanjeeth: git switch feature/sanjeeth-frontend
# Jashwanth: git switch feature/jashwanth-database
# Nihal: git switch feature/nihal-modules
git branch --show-current
git status
```

If the branch only exists remotely, run `git fetch origin` and `git switch --track origin/feature/your-branch`. Before syncing `main`, confirm uncommitted work is safe; coordinate merges with branch owners. Do not force push.

## Stack-dependent setup

**Standalone frontend:** Install project-local React/Vite/Tailwind packages after the team selects the UI stack; pin dependencies and commit lockfiles. **Backend:** Create an isolated Python environment and install pinned dependencies after the API framework decision. **Local database:** Document exact version, connection setup, migrations, seed/reset, backups and test command. **Odoo:** Follow the official installation path for the required version, including PostgreSQL and module installation. Do not run arbitrary setup commands or expose database credentials.

## Environment and secrets

Copy `.env.example` to an ignored `.env` if applicable. The template contains **candidate variables**, not proof that a service is in use. Never commit passwords, service-role keys or real datasets. Browser-visible `VITE_*` variables must not contain secrets.

## Verification checklist

- [ ] Fresh clone succeeds
- [ ] Correct branch selected; working tree status known
- [ ] Pinned application dependencies installed (after stack approval)
- [ ] Database initializes and synthetic seeds load
- [ ] Server/UI start commands verified
- [ ] Main happy path and one failure case tested
- [ ] Commands/results documented in README and evaluator log

**At present only Git/repository setup commands apply; no verified application run command exists.**
