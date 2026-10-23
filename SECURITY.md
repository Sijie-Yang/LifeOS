# Security and data boundaries

LifeOS currently supports local, single-user use on a trusted machine. There is no application login, per-user authorization, workspace isolation, or encrypted database. The standard `dev` and `start` commands listen only on `127.0.0.1`. This does not turn the app into a hardened security boundary against malicious local processes, browser-origin attacks, or untrusted imported content.

Do not expose this preview directly to the internet or shared LAN. Public hosting requires a separate review of authentication, authorization, cross-origin writes, upload limits, rate limiting, session handling and deployment secrets. A UI privacy toggle or the finance viewing reminder is not access control.

## Data handling

- `.env`, local databases, `data/` and backup directories are excluded from Git. Ignoring a path does not erase it from Git history.
- JSON backups contain private data, including finance records and settings, and are not encrypted. They omit photo/document binary contents and local Agent logs.
- Agent integration reads local Codex/Cursor files when enabled. New installations opt out in `.env.example`.
- HTML documents in the library are downloaded with sandbox and `nosniff` headers. Library/photo path resolution rejects traversal and symbolic-link escapes from the configured root.
- Email is optional. `EMAIL_DRY_RUN=1` prevents delivery even when credentials exist. Avoid logging private recipient/content data during development.
- Imports and maintenance scripts may write data. Use database copies and keep a verified backup.

## Known dependency findings

As of 2026-10-22, `npm audit` reports 5 high-severity findings, all from `braces` pulled in by `eslint-config-next` (development lint tooling, not shipped to the browser or server; no fixed release upstream). `deepmerge-ts` is pinned to 8.x through `overrides` to clear the Prisma config advisory. Do not run `npm audit fix --force`: it proposes downgrading the Next.js lint config to 14.x.

## Reporting

Please report vulnerabilities privately through GitHub's "Report a vulnerability" button on the repository's Security tab (private vulnerability reporting). Do not upload live data, credentials or exploit details to a public issue. Only the latest commit on `main` receives fixes.

This document describes current limits, not a completed security audit or a guarantee of safety.
