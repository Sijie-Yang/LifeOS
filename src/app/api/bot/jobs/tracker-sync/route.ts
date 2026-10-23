import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { runAlign } from "@/lib/align-apply";
import { parseCsv, planTrackerSync } from "@/lib/tracker-sync";

function defaultTrackerCsv(): string {
  return process.env.LIFEOS_JOB_TRACKER_CSV || path.join(process.cwd(), "data", "job-tracker.csv");
}

/**
 * POST { csvPath?, csv?, dryRun?, source? } → { counts, matched, created, ambiguous, align }
 * csvPath 默认 $LIFEOS_JOB_TRACKER_CSV，未设置时为 data/job-tracker.csv。dryRun 默认 true。ambiguous 的行不生成操作，需要人决定。
 */
export async function POST(request: NextRequest) {
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const text =
    typeof body.csv === "string"
      ? body.csv
      : await fs.readFile(typeof body.csvPath === "string" ? body.csvPath : defaultTrackerCsv(), "utf8");
  const rows = parseCsv(text);
  const opps = await prisma.opportunity.findMany({
    where: { lane: "career" },
    select: { id: true, title: true, status: true, priority: true, deadline: true, source: true, category: true },
  });
  const plan = planTrackerSync(rows, opps);
  const align = await runAlign({ ops: plan.ops, dryRun: body.dryRun, source: typeof body.source === "string" ? body.source : "求职" });
  return NextResponse.json({
    counts: { rows: rows.length, matched: plan.matched.length, created: plan.created.length, ambiguous: plan.ambiguous.length, ops: plan.ops.length },
    matched: plan.matched,
    created: plan.created,
    ambiguous: plan.ambiguous,
    align,
  });
}
