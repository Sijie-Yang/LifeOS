# LifeOS 对齐

帮用户对齐计划（逐项目过一遍、记录今天做了什么、晚上复盘）时，按 `docs/lifeos-align.md` 调 `/api/plan/align`：先 GET 取上下文，和用户确认后 POST 预览（`dryRun` 默认 `true`），用户同意后再 `dryRun:false` 应用。bot 集成见 `docs/bot-integration.md`。

# Commits

Commits in this repository are authored by the maintainer. Do not add AI or agent co-author trailers, session trailers or "generated with" footers to commits or pull requests.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
