import { NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { CLOSED_PROJECT_STATUSES, toDateString } from "@/lib/utils";
import { mapStepsToDates, type ProjectPlanStepDto } from "@/lib/project-plan";
import { projectHealth, sortByHealth, type ProjectHealthInput } from "@/lib/project-health";

/** 项目总览：每个进行中项目的健康度 / 紧急度（开工「逐项目对齐」下面用） */
export async function GET() {
  const today = toDateString();
  const projects = await prisma.project.findMany({
    where: { status: { notIn: CLOSED_PROJECT_STATUSES }, archiveDate: null, OR: [{ planActive: true }, { planSteps: { some: { done: false } } }] },
    include: {
      category: { select: { name: true, color: true } },
      planSteps: { orderBy: { sortOrder: "asc" } },
      milestones: { where: { completed: false }, select: { title: true, dueDate: true } },
    },
  });

  const items = projects.map((p) => {
    const steps: ProjectPlanStepDto[] = p.planSteps.map((s) => ({
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
    const { byDate } = mapStepsToDates(
      {
        id: p.id,
        name: p.name,
        planActive: p.planActive,
        planWorkdays: p.planWorkdays,
        planAnchorDate: p.planAnchorDate,
        planSkipDates: p.planSkipDates,
        planExtraDates: p.planExtraDates,
        startDate: p.startDate,
        category: p.category,
      },
      steps,
      today
    );
    const dateOf = new Map<string, string>();
    for (const [d, list] of Object.entries(byDate)) for (const s of list) dateOf.set(s.id, d);
    const open = steps.filter((s) => !s.done);
    const openDated = open.map((s) => ({ s, d: dateOf.get(s.id) })).filter((x): x is { s: ProjectPlanStepDto; d: string } => Boolean(x.d));
    openDated.sort((a, b) => a.d.localeCompare(b.d));
    const doneDates = steps.map((s) => s.doneDate).filter((d): d is string => Boolean(d)).sort();
    const milestoneCandidates = [
      ...p.milestones.map((m) => ({ title: m.title, date: m.dueDate ? format(m.dueDate, "yyyy-MM-dd") : null })),
      ...openDated.filter((x) => x.s.isMilestone).map((x) => ({ title: x.s.title, date: x.d })),
    ].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));

    const input: ProjectHealthInput = {
      id: p.id,
      name: p.name,
      power: p.power,
      planActive: p.planActive,
      done: steps.length - open.length,
      total: steps.length,
      lastDoneDate: doneDates.at(-1) ?? null,
      lastActivityDate: p.planSteps.length
        ? format(new Date(Math.max(...p.planSteps.map((s) => s.updatedAt.getTime()))), "yyyy-MM-dd")
        : null,
      nextStepDate: openDated[0]?.d ?? null,
      nextStepTitle: openDated[0]?.s.title ?? null,
      scheduledToday: openDated.some((x) => x.d === today),
      targetDate: p.targetDate ? format(p.targetDate, "yyyy-MM-dd") : null,
      projectedFinish: open.length && openDated.length === open.length ? openDated.at(-1)!.d : null,
      nextMilestone: milestoneCandidates[0] ?? null,
    };
    return { ...projectHealth(input, today), color: p.category?.color ?? null };
  });

  return NextResponse.json({ today, items: sortByHealth(items) });
}
