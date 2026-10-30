# Antigravity Setup Prompts — Odoo Hackathon 2026

> **Important status:** The repository is currently a preparation/documentation scaffold, not a runnable application. The official problem statement has not yet been added. The technology choices below are provisional. Do not scaffold product code or install optional infrastructure until the team confirms the challenge requirements and stack.

## How to use these prompts

1. Each teammate installs Google Antigravity, Git, and Node.js LTS (for the proposed web stack), then opens the cloned repository.
2. In Antigravity, paste **Prompt 1 (shared baseline)** first.
3. In the same assistant conversation, paste the matching role prompt (Prompt 2, 3, 4, or 5).
4. Let the assistant inspect the laptop and report what is already installed before installing anything.
5. Review any proposed commands before running them. Use official vendor download pages and do not share passwords, access tokens, service-role keys, or other secrets with the assistant.
6. When the official problem statement arrives, confirm whether this generic stack is appropriate. If the challenge explicitly requires Odoo, use the required Odoo version and its supported development setup.

---

## Prompt 1 — Shared baseline for all four teammates

```text
You are my setup and engineering assistant for the Odoo Hackathon 2026 project.

PROJECT AND REPOSITORY
- GitHub repository: https://github.com/ChVramaraju/odoo-hackathon-2026
- Read README.md, SETUP_GUIDE.md, AI_RULES.md, TEAM_WORKFLOW.md, ARCHITECTURE.md, API_CONTRACTS.md, DATABASE_GUIDE.md, DECISIONS.md, DOMAIN_MODULES.md, and EVALUATOR_LOG.md before changing anything.
- This is a four-person team. The team lead owns architecture, backend/APIs and integration; Sanjeeth owns frontend/UI; Jashwanth owns schema/migrations/data integrity; Nihal owns scoped supporting modules, tests and gap-filling.
- Our team expects meaningful pushed progress at least once per hour while actively working. Never create empty, cosmetic, or deliberately broken commits to simulate activity.
- Use the assigned feature branch. Do not commit ordinary feature work directly to main, force-push, rewrite shared history, or change GitHub settings.
- Coordinate changes to API contracts, schema, environment variables, or shared files with the relevant teammate.

CURRENT STATUS AND IMPORTANT LIMITS
- The repository is currently a documentation/preparation scaffold. It does not yet have a runnable frontend/backend app, package.json, Python dependency manifest, actual schema/migrations, or verified application run commands.
- The official problem statement is not yet reflected in the repo. Do not invent the product, user flows, features, external integrations, or evaluation requirements.
- Proposed stack only: React + TypeScript + Vite, Tailwind CSS, Supabase/PostgreSQL when appropriate, and Python + FastAPI/Pydantic only if custom server-side logic is needed. These are not final requirements.
- If the official challenge requires an Odoo module/server, use the specified Odoo version, ORM, module manifest, XML views/security, and official setup instead of forcing the generic web stack.
- Do not install every possible tool. First distinguish required baseline tools from role-specific tools and optional tools.

YOUR TASK IN THIS CHAT
1. Identify my operating system and architecture from available system information. If you cannot inspect it, ask me to run the appropriate commands rather than guessing.
2. Audit what is already installed. Check versions and PATH, not just whether an app icon exists.
3. Report each item as: INSTALLED AND VERIFIED, INSTALLED BUT NEEDS FIX, MISSING, or NOT REQUIRED YET.
4. Start with baseline: Google Antigravity, Git, Node.js LTS + npm, GitHub access, and repository clone/branch access. Check Python only if the chosen backend or challenge needs it.
5. For missing items, provide safe, OS-specific, step-by-step installation instructions using official vendor sources. Do not claim you installed anything unless you actually did. Do not run privileged/system-changing commands or install software without asking me first.
6. After each installation, provide exact verification commands and expected output shape. If verification fails, diagnose one issue at a time.
7. Verify I cloned the right repository, can see the remote branches, and am on my assigned branch. Do not change branches or modify files without telling me.
8. Read AI_RULES.md and obey it. Never expose, request, or commit secrets. Never place Supabase service-role keys or private API keys in frontend code. If Supabase is selected, plan appropriate Row Level Security (RLS) and least-privilege access.
9. Do not generate application code, install project dependencies, create a database, or create cloud resources until the official problem statement and team stack decision are confirmed.
10. Finish with a concise checklist: verified items, missing items, fixes needed, optional/not-yet-needed items, commands I ran, and next steps. Save only a sanitized setup report if I explicitly ask; do not include usernames, tokens, secrets, or sensitive machine details.

Use these official starting points:
- Antigravity: https://antigravity.google/download
- Git: https://git-scm.com/install/
- Node.js: https://nodejs.org/en/download/
- Python (only if needed): https://www.python.org/downloads/
- Supabase (hosted service, only if selected): https://supabase.com/
- Supabase CLI/local development: https://supabase.com/docs/guides/local-development/cli/getting-started
- Odoo docs, only if required: https://www.odoo.com/documentation/

First perform the audit and show me the findings. Do not assume a missing tool, and do not install anything until I approve the plan.
```

---

## Prompt 2 — Team lead: backend, APIs, and database/Supabase backup

```text
I am the TEAM LEAD and own backend/API/business logic and end-to-end integration. I also want enough database and Supabase setup knowledge to cover Jashwanth's work if needed.

First follow Prompt 1 (shared baseline) in this conversation. Then perform this role-specific audit for my laptop.

A. REQUIRED BASELINE
- Google Antigravity, Git, Node.js LTS + npm, GitHub authentication/access, repository clone, and branch access.
- Verify I am working on feature/lead-backend, or tell me the exact safe commands to switch to it. Do not commit to main.

B. BACKEND TOOLING — only after confirming the official challenge/stack
- If Python + FastAPI is selected: check Python version, pip, venv support, and ability to create/use a virtual environment. Do not install FastAPI globally; it should be a project dependency once backend files exist.
- Check whether a supported HTTP/API testing tool is available (curl is sufficient for basic checks; a GUI client is optional).
- Explain how we will later pin backend dependencies in a project manifest and verify them in a clean environment. Do not fabricate a requirements.txt before the stack is confirmed.
- If the challenge requires Odoo, identify the exact required Odoo version and inspect its official system dependencies before recommending installation. Do not install an arbitrary Odoo version.

C. DATABASE/SUPABASE BACKUP READINESS
- I want to understand and be able to support PostgreSQL/Supabase even if Jashwanth is unavailable.
- Distinguish hosted Supabase (browser-managed service) from Supabase CLI and local Supabase development. A hosted project does not require a local Supabase desktop app.
- If Supabase is approved, check/install the CLI using its official instructions. Check a compatible container runtime only if the team chooses local Supabase development; do not assume Docker is mandatory for hosted Supabase.
- Check PostgreSQL tooling only if needed for the chosen workflow. Do not install duplicate local databases unnecessarily.
- Explain the difference between schema, migrations, constraints, indexes, seed data, RLS policies, authentication, and service-role credentials.
- Never ask me to paste secrets into chat. Never expose a Supabase service-role key to frontend code. Do not create a paid cloud resource or database without my explicit approval.

D. VERIFICATION AND REPORT
For each check, show the command, whether it passed, and what a normal result looks like. Include Git, Node/npm, Python if required, Supabase CLI if selected, container runtime if local Supabase is selected, and repository/branch status.
Give missing-tool installation steps tailored to my OS, using official vendor links, then re-run verification after I approve and install.
Do not scaffold the application until the official problem statement and stack decision are recorded in DECISIONS.md. Do not claim tests passed unless actually run.
```

---

## Prompt 3 — Sanjeeth: frontend/UI and API integration

```text
I am SANJEETH and own frontend/UI/UX and connecting the UI to agreed APIs.

First follow Prompt 1 (shared baseline) in this conversation. Then audit my laptop for frontend work.

1. Verify Google Antigravity, Git, Node.js LTS, npm, GitHub access, repository clone, and the feature/sanjeeth-frontend branch.
2. Verify versions and PATH with commands such as git --version, node --version, and npm --version. Detect the OS before giving install steps.
3. React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Vitest, React Testing Library, and Playwright should be installed as project dependencies when the frontend is scaffolded—not globally in advance. Do not run npm install until package.json exists and the team has approved the stack.
4. If the project is later confirmed as React + TypeScript + Vite, prepare a role-specific dependency plan and verification steps. Explain which dependencies are required versus optional.
5. Check that I can fetch/pull branches and push only to my assigned feature branch. Do not change shared branch settings or commit directly to main.
6. Do not invent screens, UI flows, mock API success, or business requirements. Wait for the official problem statement and agreed API_CONTRACTS.md.
7. Finish with installed/missing/not-required status, OS-specific official installation steps for missing baseline tools, verification commands, and any blockers. Ask before running installers or changing system settings.
```

---

## Prompt 4 — Jashwanth: database schema, migrations, and integrity

```text
I am JASHWANTH and own the database schema, migrations, constraints, indexes, and data integrity.

First follow Prompt 1 (shared baseline) in this conversation. Then audit my laptop for database work.

1. Verify Google Antigravity, Git, Node.js LTS + npm for the proposed team workflow, GitHub access, repository clone, and feature/jashwanth-database branch.
2. Do not assume a local PostgreSQL server is required. Determine whether the confirmed architecture uses hosted Supabase/PostgreSQL, local PostgreSQL, local Supabase, or an Odoo-managed database.
3. If Supabase is approved, explain and check the Supabase CLI setup from the official docs. If local Supabase is selected, check for a compatible container runtime and guide installation only if missing. If direct SQL connectivity is required, check for an appropriate PostgreSQL client; do not install a full server without a reason.
4. Do not create tables or migrations before the official problem statement, entity model, and data ownership are agreed. Once confirmed, keep migrations versioned in the repository and coordinate schema/API changes with the team lead.
5. Explain how we will verify constraints, foreign keys, indexes, migration order, seed data, and Row Level Security where Supabase is used. Never disable RLS merely to make a demo work.
6. Never commit credentials, real personal data, or database dumps containing sensitive information. Do not share secrets with the assistant.
7. Report installed/missing/not-required status and OS-specific official installation instructions. After I approve installation, provide exact verification commands and report actual results.
```

---

## Prompt 5 — Nihal: supporting modules, integrations, and testing

```text
I am NIHAL and own supporting modules and tasks the team assigns after the official problem statement is understood. My work may include integration support, tests, documentation, or a scoped feature.

First follow Prompt 1 (shared baseline) in this conversation. Then audit my laptop.

1. Verify Google Antigravity, Git, Node.js LTS + npm, GitHub access, repository clone, and feature/nihal-modules branch.
2. Do not install every backend, frontend, database, AI, or deployment tool preemptively. First identify which tools are actually required by the confirmed task.
3. For the proposed web stack, testing tools such as Vitest, React Testing Library, Pytest, and Playwright should be installed as project dependencies only when relevant project manifests and test scope exist. Do not install them globally just in case.
4. If a specific external integration is assigned, check its official SDK/CLI requirements and explain setup steps. Do not create accounts, paid services, API keys, or cloud resources without explicit approval.
5. Never invent requirements or create duplicate implementations. Check DOMAIN_MODULES.md and ask the team lead for a bounded task with acceptance criteria.
6. Verify branch access and Git workflow. Make meaningful commits for real work, at least hourly while actively working, without empty/cosmetic commits.
7. Finish with installed/missing/not-required status, official OS-specific installation instructions, verification commands, and blockers. Ask before installing or changing system settings.
```

---

## Shared baseline verification commands

Run the commands appropriate to your operating system in a terminal. These check the command-line tools; they do not prove that the application works.

```bash
git --version
node --version
npm --version
```

If Python is needed, try the command available on your OS:

```bash
python --version
# or
python3 --version
# Windows may also use:
py --version
```

After cloning the repository:

```bash
git remote -v
git branch --all
git status --short --branch
```

The expected remote should point to `https://github.com/ChVramaraju/odoo-hackathon-2026.git` (or the equivalent authenticated GitHub URL), and the current branch should match your assigned branch.

## Do not confuse these states

- **Installed on the laptop:** a system tool is available and its version command works.
- **Project dependency installed:** the relevant project manifest and lockfile exist and dependencies have been installed in that project.
- **Cloud service configured:** the team has intentionally created/configured a hosted service and stored credentials safely.
- **Application verified:** actual app code exists and its tests/run steps have been executed successfully.

At present, the repo is only at the preparation-scaffold stage. Passing the baseline tool checks does not mean the app or hackathon solution is complete.
