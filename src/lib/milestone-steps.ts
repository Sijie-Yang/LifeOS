import { format } from "date-fns";
import {
  mapStepsToDates,
  type ProjectPlanFields,
  type ProjectPlanStepDto,
} from "@/lib/project-plan";

export type DerivedMilestone = {
  id: string;
  stepId: string;
  title: string;
  dueDate: string | null;
  completed: boolean;
  sortOrder: number;
  derived: true;
};

export function getDerivedMilestonesFromPlan(
  project: ProjectPlanFields,
  steps: ProjectPlanStepDto[],
  today: string = format(new Date(), "yyyy-MM-dd")
): DerivedMilestone[] {
  const flagged = steps.filter((s) => s.isMilestone);
  if (flagged.length === 0) return [];

  const { byDate } = mapStepsToDates(project, steps, today);
  const mappedDateByStepId = new Map<string, string>();
  for (const [date, mappedSteps] of Object.entries(byDate)) {
    for (const step of mappedSteps) {
      if (!step.done) mappedDateByStepId.set(step.id, date);
    }
  }

  return flagged
    .map((step) => ({
      id: `step:${step.id}`,
      stepId: step.id,
      title: step.title,
      dueDate: step.done ? step.doneDate : mappedDateByStepId.get(step.id) ?? null,
      completed: step.done,
      sortOrder: step.sortOrder,
      derived: true as const,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function isDerivedMilestoneId(id: string): boolean {
  return id.startsWith("step:");
}

export function stepIdFromDerivedMilestoneId(id: string): string | null {
  return isDerivedMilestoneId(id) ? id.slice(5) : null;
}

type DbMilestone = {
  id: string;
  projectId: string;
  title: string;
  dueDate: Date | null;
  completed: boolean;
  sortOrder: number;
  childProjectId: string | null;
  childProject?: unknown;
  createdAt: Date;
};

export function mergeMilestonesWithDerived<
  T extends DbMilestone,
>(
  project: ProjectPlanFields & { planActive: boolean },
  dbMilestones: T[],
  steps: ProjectPlanStepDto[],
  today: string = format(new Date(), "yyyy-MM-dd")
) {
  const dbWithFlag = dbMilestones.map((m) => ({ ...m, derived: false as const }));

  if (!project.planActive || steps.length === 0) {
    return dbWithFlag;
  }

  const derived = getDerivedMilestonesFromPlan(project, steps, today);
  const merged = [
    ...dbWithFlag,
    ...derived.map((d) => ({
      id: d.id,
      projectId: project.id,
      title: d.title,
      dueDate: d.dueDate ? new Date(`${d.dueDate}T12:00:00`) : null,
      completed: d.completed,
      sortOrder: d.sortOrder,
      childProjectId: null,
      childProject: null,
      createdAt: new Date(),
      derived: true as const,
      stepId: d.stepId,
    })),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  return merged;
}
