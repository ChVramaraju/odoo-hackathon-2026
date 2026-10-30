# Developer Setup Guide

This is the shared setup plan for the team. Install only the tools required for the chosen implementation. The official hackathon brief takes precedence over this proposed stack.

## 1. Required for the proposed web stack

### Google Antigravity IDE
Install the IDE version matching your operating system from the official [Antigravity download page](https://antigravity.google/download). All teammates should open the repository folder in Antigravity and read AI_RULES.md before asking an agent to edit files.

### Git
Install Git from the official [Git downloads page](https://git-scm.com/install/). Git is required for cloning, branches, commits, and pushing to GitHub.

### Node.js LTS (includes npm)
Install a currently supported LTS release from [nodejs.org](https://nodejs.org/en/download/). Node.js/npm are needed for the proposed React, TypeScript, Vite, Tailwind CSS, and frontend test toolchain. Use the same supported Node major version across the team.

Verify:
```bash
git --version
node --version
npm --version
```

### GitHub access
Sign in to GitHub and ensure you have repository collaborator access. The repository owner should use the GitHub account invited to the project. Do not share passwords or tokens with teammates or AI assistants.

## 2. Needed only if selected by the final architecture

### Python
Install a currently supported Python 3 release from [python.org](https://www.python.org/downloads/) only if we implement a FastAPI/Python backend, Python scripts, or Python-based AI/ML logic. Create a virtual environment per the backend README once backend code exists.

Verify:
```bash
python --version
```
On some systems, use `python3 --version` or `py --version`.

### Supabase
Create a project at [supabase.com](https://supabase.com/) if the team confirms Supabase for hosted PostgreSQL, authentication, storage, or realtime features. No desktop app is required to use hosted Supabase; it is managed online.

The Supabase CLI is useful for versioned migrations and local development. Follow the [official CLI setup guide](https://supabase.com/docs/guides/local-development/cli/getting-started). Local Supabase development requires a compatible container runtime such as Docker Desktop; install it only if we need the full local Supabase stack.

### Odoo development tools
If the official brief requires an Odoo module or Odoo server integration, follow the official documentation for the target Odoo version and its Python/system dependencies. Do not install an arbitrary Odoo version before confirming the challenge's required version and deployment environment.

## 3. What does NOT need a separate download right now

- **React, Vite, TypeScript, Tailwind CSS, shadcn/ui:** these are installed as project dependencies with npm when the frontend is scaffolded. Do not install them globally.
- **FastAPI, Pydantic, SQLAlchemy, Pytest:** these are Python project dependencies only if a Python backend is selected.
- **Supabase hosted database:** managed online service; CLI/container runtime are needed only for specific local workflows.
- **Playwright and Vitest:** add as project dependencies when the frontend and test strategy are set.
- **API keys:** do not create provider keys until the relevant integration is required. Store secrets locally, never in Git.

## 4. Clone and open the repository

Open a terminal and run:
```bash
git clone https://github.com/ChVramaraju/odoo-hackathon-2026.git
cd odoo-hackathon-2026
git branch --all
```

Then open the folder in Antigravity. Before implementation begins, read README.md, TEAM_WORKFLOW.md, and AI_RULES.md.

## 5. Check out your assigned branch

Use the branch assigned to you:

Team lead:
```bash
git switch feature/lead-backend
```

Sanjeeth:
```bash
git switch feature/sanjeeth-frontend
```

Jashwanth:
```bash
git switch feature/jashwanth-database
```

Nihal:
```bash
git switch feature/nihal-modules
```

If a branch is not present locally after cloning, refresh remote branch references:
```bash
git fetch origin
git switch --track origin/feature/your-branch-name
```
Replace the branch name with the exact branch assigned to you. Do not commit directly to main for ordinary feature work.

## 6. Current readiness

The repository currently contains documentation, templates, and a documentation-presence workflow. It does **not** yet contain a frontend package.json, backend dependency file, database schema, deployment config, or runnable application. Therefore, there are no application start commands yet.

After the official problem statement is confirmed, the team should scaffold only the selected application components, pin dependency versions, add lockfiles, write actual setup commands, and verify them from a clean clone.
