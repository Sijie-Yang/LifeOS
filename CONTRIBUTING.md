# Contributing to LifeOS

LifeOS is a local, single-user development preview released under the [MIT License](LICENSE). By contributing you agree that your contribution is licensed under the same terms.

## Local workflow

Follow the fresh-install steps in [README](README.md), using a separate database and fictional demo data. Never use your live LifeOS database for tests. Read `AGENTS.md`; for Next.js changes, check the installed guides under `node_modules/next/dist/docs/` instead of assuming older APIs.

Before submitting a change, run:

```bash
npm run check
npm run test:backup
npm run privacy:scan
npm run build
```

The GitHub Actions configuration runs those same checks against a fresh database. Full `npm run lint` still reports historical findings. `lint:baseline` blocks new findings by file, rule and severity; do not increase the baseline to hide a regression. When fixing a finding, lower its count in `docs/lint-baseline.json`. The end goal is to delete the baseline and gate on clean lint.

## Scope and architecture

- Prefer improvements to the core goal → project → today → review workflow before adding another top-level module.
- Keep framework route handlers thin. Put domain calculations and validation in `src/lib/`, with meaningful tests for data integrity and edge cases.
- Use shared UI primitives and `PageState` utilities. Writes must check the HTTP result, retain form contents on failure, show an actionable error, and invalidate affected read caches only after success.
- Handle loading, empty, error and populated states. Check mobile widths and keyboard interaction, not only desktop screenshots.
- Avoid hardcoded personal IDs, absolute home paths, career plans, emails or machine-specific assumptions. Optional integrations need explicit configuration and useful empty states.
- Add tests for date boundaries, relation integrity, financial calculations and concurrent saves when those behaviors change. Do not add snapshots that only repeat implementation details.

## Database changes

`prisma/migrations/0_init` is the schema baseline; `db:init` applies it to an empty database with `prisma migrate deploy`. Add schema changes as new migrations (`npx prisma migrate dev --create-only` against a scratch database), review the SQL, and test the upgrade on a copy of a populated database. Never reset data or run `db push` against a live database as a shortcut.

Backup format 2.0 validates the full schema: changing fields or models also requires a backup compatibility decision. The recovery test covers every current model and rollback on invalid relationships.

Photo and document contents live outside SQLite. State explicitly whether a feature touches filesystem assets, whether cleanup can remove original files, and how backup/restore behaves.

## Pull requests and issues

Explain the user-visible problem, resulting behavior, validation and remaining limits. Use synthetic fixtures, with no private data in logs or screenshots. Do not attach `.env`, databases, backups, personal Agent transcripts, or customer/contact details.

Known gaps worth picking up: consistent save/error handling across pages (projects, tasks, notes, finance, review), clearing the lint baseline, splitting very large page components, keyboard and screen-reader support in the shared modal, and a converter for 1.x JSON backups. Security reports should follow [SECURITY](SECURITY.md), not public issue templates containing sensitive reproduction data.
