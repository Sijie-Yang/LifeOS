import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  applyCatchUpToToday,
  applyPushBackN,
  applyPushForward,
  resolvePushBackSkipDate,
  toggleExtraDate,
  toggleSkipDate,
  type ProjectPlanFields,
  type ProjectPlanStepDto,
} from "@/lib/project-plan";
import { toDateString } from "@/lib/utils";

function toPlanFields(project: {
  id: string;
  name: string;
  planActive: boolean;
  planWorkdays: string;
  planAnchorDate: string | null;
  planSkipDates: string;
  planExtraDates: string;
  startDate: Date | null;
}): ProjectPlanFields {
  return {
    id: project.id,
    name: project.name,
    planActive: project.planActive,
    planWorkdays: project.planWorkdays,
    planAnchorDate: project.planAnchorDate,
    planSkipDates: project.planSkipDates,
    planExtraDates: project.planExtraDates,
    startDate: project.startDate,
  };
}

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const configUpdate: {
    planActive?: boolean;
    planWorkdays?: string;
    planAnchorDate?: string | null;
    planSkipDates?: string;
    planExtraDates?: string;
  } = {};

  if (body.planActive !== undefined) configUpdate.planActive = Boolean(body.planActive);
  if (body.planWorkdays !== undefined) {
    configUpdate.planWorkdays =
      typeof body.planWorkdays === "string"
        ? body.planWorkdays
        : JSON.stringify(body.planWorkdays);
  }
  if (body.planAnchorDate !== undefined) {
    configUpdate.planAnchorDate = body.planAnchorDate || null;
  }

  const { date, action, days } = body as {
    date?: string;
    action?: string;
    days?: number;
  };
  const fields = toPlanFields(project);
  const today = toDateString();

  if (action === "catchUp") {
    const steps: ProjectPlanStepDto[] = (
      await prisma.projectPlanStep.findMany({
        where: { projectId: id },
        orderBy: { sortOrder: "asc" },
      })
    ).map((s) => ({
      id: s.id,
      projectId: s.projectId,
      sortOrder: s.sortOrder,
      title: s.title,
      detail: s.detail,
      estMinutes: s.estMinutes,
      milestoneId: s.milestoneId,
      isMilestone: s.isMilestone,
      done: s.done,
      doneDate: s.doneDate,
      scheduledDate: s.scheduledDate,
    }));
    const result = applyCatchUpToToday(fields, steps, today);
    if (result.kind === "noop") {
      const msg =
        result.reason === "no_open"
          ? "没有未完成步骤"
          : "该项目没有可用工作日（检查计划工作日 / 是否全被跳过）";
      return NextResponse.json({ error: msg, skippedDates: [] }, { status: 400 });
    }
    configUpdate.planSkipDates = result.planSkipDates;
  } else if (date && action) {
    if (action === "skip") {
      configUpdate.planSkipDates = toggleSkipDate(project.planSkipDates, date, true);
    } else if (action === "unskip") {
      configUpdate.planSkipDates = toggleSkipDate(project.planSkipDates, date, false);
    } else if (action === "addExtra") {
      configUpdate.planExtraDates = toggleExtraDate(project.planExtraDates, date, true);
    } else if (action === "removeExtra") {
      configUpdate.planExtraDates = toggleExtraDate(project.planExtraDates, date, false);
    } else if (action === "pushBack") {
      const n = typeof days === "number" && days > 1 ? days : 1;
      if (n > 1) {
        const result = applyPushBackN(fields, date, n);
        if (result.skippedDates.length === 0) {
          return NextResponse.json({ error: "No later workday to skip" }, { status: 400 });
        }
        configUpdate.planSkipDates = result.planSkipDates;
      } else {
        const skipDate = resolvePushBackSkipDate(fields, date);
        if (!skipDate) {
          return NextResponse.json({ error: "No later workday to skip" }, { status: 400 });
        }
        configUpdate.planSkipDates = toggleSkipDate(project.planSkipDates, skipDate, true);
      }
    } else if (action === "pushForward") {
      const result = applyPushForward(fields, date, today);
      if (result.kind === "unskip") {
        configUpdate.planSkipDates = result.planSkipDates;
      } else if (result.kind === "anchor") {
        configUpdate.planAnchorDate = result.planAnchorDate;
      } else {
        return NextResponse.json({ error: "Already at earliest slot" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  }

  const updated = await prisma.project.update({
    where: { id },
    data: configUpdate,
    include: {
      category: { select: { color: true } },
      planSteps: { orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json(updated);
}
