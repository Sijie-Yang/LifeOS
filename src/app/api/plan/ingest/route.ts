import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateString } from "@/lib/utils";
import { runAlign } from "@/lib/align-apply";
import {
  collectTomorrow,
  habitOpsFromReport,
  parseBotReport,
  reportHasText,
  summarizeReports,
  type BotReport,
} from "@/lib/bot-report";
import { loadReports } from "@/lib/bot-report-files";

/**
 * Bot 日报汇总（见 docs/bot-integration.md）
 * - GET  ?date=YYYY-MM-DD → 读目录里的日报，返回合并预览（等同 POST dryRun）
 * - POST { date?, reports?, dryRun?, digest? } → { summary, bots, perBot, digest, tomorrow, needsUser, errors, applied }
 *   reports 不给时读 $LIFEOS_BOT_REPORTS_DIR/<date>/*.json（默认 ~/Documents/lifeos-bot-reports）。
 *   dryRun 默认 true；false 时按 bot 逐个应用，每个 bot 的新项目带 tag bot:<name>。
 * 自动生成的操作（也只在 dryRun:false 时写）：
 *   - 每个 bot 的 habits[]（习惯名）→ check_habit（proposed_ops 里已有的不重复）
 *   - 全部日报的 done / habits / blockers / needs_user / tomorrow → save_bot_digest（Note「Bot 日报 · <date>」，
 *     挂到当天 DailyLog.noteId 若为空）。digest:false 关掉。
 */

async function ingest(body: Record<string, unknown>) {
  const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : toDateString();
  const dryRun = body.dryRun !== false;
  const wantDigest = body.digest !== false;

  const reports: BotReport[] = [];
  const errors: string[] = [];
  let files: string[] = [];
  if (Array.isArray(body.reports)) {
    for (const item of body.reports) {
      const { report, error } = parseBotReport(item, date);
      if (error) errors.push(error);
      else if (report!.date !== date) errors.push(`${report!.bot} 的日报日期 ${report!.date} ≠ ${date}，跳过`);
      else reports.push(report!);
    }
  } else {
    const loaded = await loadReports(date);
    reports.push(...loaded.reports);
    errors.push(...loaded.errors);
    files = loaded.files;
  }

  const habits = await prisma.habit.findMany({ where: { isActive: true }, select: { id: true, name: true } });

  const perBot = [];
  for (const r of reports) {
    const auto = habitOpsFromReport(r, habits);
    errors.push(...auto.errors);
    const res = await runAlign({ date, ops: [...r.proposed_ops, ...auto.ops], dryRun, source: r.bot });
    perBot.push({ bot: r.bot, autoOps: auto.ops.length, ...res });
  }

  const summary = summarizeReports(reports);
  let digest: { preview: string[]; errors: string[]; applied: number } | null = null;
  if (wantDigest && reports.some(reportHasText)) {
    digest = await runAlign({ date, ops: [{ op: "save_bot_digest", content: summary }], dryRun, source: "ingest" });
    errors.push(...digest.errors);
  }

  const missing = expectedBots(date).filter((b) => !reports.some((r) => r.bot === b));
  return {
    date,
    dryRun,
    files,
    bots: reports.map((r) => r.bot),
    missingBots: missing,
    summary,
    needsUser: reports.flatMap((r) => r.needs_user.map((x) => `[${r.bot}] ${x}`)),
    tomorrow: collectTomorrow(reports),
    preview: [...perBot.flatMap((b) => b.preview), ...(digest?.preview ?? [])],
    perBot,
    digest,
    errors: [...errors, ...perBot.flatMap((b) => b.errors.map((e) => `[${b.bot}] ${e}`))],
    applied: perBot.reduce((n, b) => n + b.applied, 0) + (digest?.applied ?? 0),
  };
}

/**
 * 这一天应该交日报的 bot（只用于提醒，不影响合并）。
 * 由 LIFEOS_EXPECTED_BOTS 配置，逗号分隔；可用 `@星期数字` 限定日子（0=周日，每位一个），
 * 例：`research,learning,writer@135`（writer 只在周一三五交）。未配置时不提示缺交。
 */
function expectedBots(date: string): string[] {
  const dow = new Date(`${date}T12:00:00`).getDay();
  const raw = process.env.LIFEOS_EXPECTED_BOTS ?? "";
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const [name, days] = entry.split("@");
      if (!name?.trim()) return [];
      if (!days) return [name.trim()];
      return days.includes(String(dow)) ? [name.trim()] : [];
    });
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  return NextResponse.json(await ingest({ date: q.get("date") ?? undefined, dryRun: true, digest: q.get("digest") !== "0" }));
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "需要 JSON body" }, { status: 400 });
  return NextResponse.json(await ingest(body));
}
