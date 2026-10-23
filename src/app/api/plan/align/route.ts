import { NextRequest, NextResponse } from "next/server";
import { format, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { isHabitScheduledOnDateForHabit } from "@/lib/reminders";
import { toDateString, CLOSED_PROJECT_STATUSES } from "@/lib/utils";
import { mapStepsToDates } from "@/lib/project-plan";
import { buildAlignPrompt, type AlignContext, type AlignMode } from "@/lib/align-ops";
import { runAlign } from "@/lib/align-apply";

/**
 * 对齐在和 Claude 的对话里完成（见 docs/lifeos-align.md）：
 * - GET  ?mode=daily|projects&date=YYYY-MM-DD → { context, prompt }
 * - POST { date?, ops | text, dryRun?, source? } → { preview, errors, applied }（逻辑在 lib/align-apply.ts）
 *   text = LLM 原样回复（含 ```json 代码块）；dryRun 默认 true，只预览不写库。
 */

function parseMode(value: unknown): AlignMode {
  return value === "projects" ? "projects" : "daily";
}

function parseWorkdays(value: string): number[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((d): d is number => Number.isInteger(d)) : [];
  } catch {
    return [];
  }
}

async function buildContext(date: string, mode: AlignMode): Promise<AlignContext> {
  const today = toDateString();
  const weekAgo = format(subDays(new Date(`${date}T12:00:00`), 6), "yyyy-MM-dd");
  const [projects, habits, checkIns] = await Promise.all([
    prisma.project.findMany({
      where: {
        status: { notIn: CLOSED_PROJECT_STATUSES },
        archiveDate: null,
        ...(mode === "daily" ? { planActive: true } : { planSteps: { some: {} } }),
      },
      include: {
        category: { select: { name: true, color: true } },
        planSteps: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: [{ planActive: "desc" }, { pinned: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.habit.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.habitCheckIn.findMany({ where: { date, completed: true }, select: { habitId: true } }),
  ]);
  const checked = new Set(checkIns.map((c) => c.habitId));

  const todaySteps: AlignContext["todaySteps"] = [];
  const rows: AlignContext["projects"] = [];
  for (const p of projects) {
    const { byDate } = mapStepsToDates(p, p.planSteps, today);
    for (const s of byDate[date] ?? []) {
      todaySteps.push({ stepId: s.id, projectId: p.id, projectName: p.name, title: s.title, done: s.done });
    }
    const doneDates = p.planSteps.map((s) => s.doneDate).filter((d): d is string => Boolean(d)).sort();
    rows.push({
      projectId: p.id,
      name: p.name,
      category: p.category?.name ?? null,
      power: p.power,
      planActive: p.planActive,
      workdays: parseWorkdays(p.planWorkdays),
      done: p.planSteps.filter((s) => s.done).length,
      total: p.planSteps.length,
      doneThisWeek: doneDates.filter((d) => d >= weekAgo && d <= date).length,
      lastDoneDate: doneDates.at(-1) ?? null,
      upcoming: Object.entries(byDate)
        .flatMap(([d, steps]) => steps.filter((s) => !s.done).map((s) => ({ stepId: s.id, title: s.title, date: d })))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 3),
    });
  }

  // 逐项目对齐：今天排到的项目先过
  const scheduledToday = new Set(todaySteps.map((st) => st.projectId));
  if (mode === "projects") {
    rows.sort((a, b) => Number(scheduledToday.has(b.projectId)) - Number(scheduledToday.has(a.projectId)));
  }

  return {
    date,
    mode,
    todaySteps,
    habits: habits
      .filter((h) => isHabitScheduledOnDateForHabit(h, date))
      .map((h) => ({ habitId: h.id, name: h.name, power: h.power, checked: checked.has(h.id) })),
    projects: rows,
  };
}

export async function GET(request: NextRequest) {
  const mode = parseMode(request.nextUrl.searchParams.get("mode"));
  const date = request.nextUrl.searchParams.get("date") || toDateString();
  const context = await buildContext(date, mode);
  return NextResponse.json({ context, prompt: buildAlignPrompt(context) });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "需要 JSON body" }, { status: 400 });
  const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : undefined;
  return NextResponse.json(await runAlign({ ...body, source }));
}
