# Private overlay (`private/`)

LifeOS ships neutral, fictional defaults. Your own content — people, life plan, habit
names, copy for private features, one-off scripts, personal docs — lives in a git-ignored
`private/` folder next to the code, so one checkout serves both your daily use and the
public repository.

## How it works

`tsconfig.json` maps `@/*` to `./private/src/*` first and `./src/*` second. Every
`@/lib/...` or `@/components/...` import therefore picks up `private/src/<same path>` when
that file exists, and the public file otherwise. Next.js and `tsc` follow the same
mapping. `npm test` does not: it runs with `tsconfig.test.json`, which maps `@/*` to `src/*`
only, so the tests always check the public defaults whether or not `private/` exists.

- Override a module: copy it to `private/src/<same path>` and edit the copy. Keep the
  exports the rest of the code imports.
- Small knobs (morning habit names, power-map keywords) live in
  `src/lib/personal-config.ts`; override that one file instead of larger modules.
- Route files under `src/app/` are not overridable this way; personal behaviour there is
  configured through `.env` (for example `LIFEOS_EXPECTED_BOTS`,
  `LIFEOS_JOB_TRACKER_CSV`) or through the modules they import.
- Anything else private (scripts, seed data, docs, exports) can sit anywhere under
  `private/`; run scripts with `npx tsx private/scripts/<name>.ts`.
- Notes for coding agents that should stay local go in `CLAUDE.local.md` (git-ignored).

## Keeping it out of git

`private/`, `CLAUDE.local.md`, `.env*`, databases, `backups/`, `data/` and `artifacts/` are
git-ignored, and `npm run privacy:scan` fails if any of them is ever tracked.

Before pushing, `npm run privacy:check` exports the committed tree, runs the privacy scan
and, when `prisma/dev.db` exists, checks that no real contact name or email and no habit,
project or opportunity title from your database appears in it. Enable it as a pre-push hook
once per clone:

```bash
git config core.hooksPath .githooks
```

Personal terms to always reject go in `.privacy-denylist`; generic titles that may appear
in code (for example a project called "Library") go in `.privacy-allowlist`. Both files are
git-ignored.
