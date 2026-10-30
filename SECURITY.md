# Security Policy

## Scope
This is a hackathon project. Security measures should match the actual features and data handled, and must not be represented as a formal audit or certification.

## Reporting a concern
Tell the team lead privately about suspected exposed credentials, authorization flaws, unsafe data handling, or dependency vulnerabilities. Do not publish live secrets or sensitive personal information in a public issue.

## Secret handling
- Keep local credentials in an ignored `.env` file or an approved secret manager.
- Commit only placeholder variable names in `.env.example`.
- Rotate any credential that is accidentally exposed; deleting a file in a later commit does not remove it from Git history.
- Do not put server-side secrets in frontend variables or bundles.
- Never share passwords or tokens in chat, screenshots, issues, or commits.

## Access and data
- Enforce permissions on the server and/or through correctly tested database policies.
- Use least-privilege credentials and synthetic demo data.
- Validate inputs and avoid logging secrets or sensitive payloads.
- Use payment, AI, or other provider sandbox modes when available.
- Follow event rules and applicable requirements for any personal or regulated data.

## Before demo/submission
- [ ] Check repository history and current files for accidental secrets.
- [ ] Verify authorization for each role and protected operation.
- [ ] Confirm no production credentials or private datasets are bundled.
- [ ] Document known security limitations honestly.
