import type { PrismaClient, Project, ProjectMilestone } from "@prisma/client";
import { syncProjectProgress } from "@/lib/reminders";

type MilestoneWithChild = ProjectMilestone & {
  childProject?: Pick<Project, "id" | "name" | "status" | "progress" | "targetDate"> | null;
};

export function isMilestoneCompleted(m: MilestoneWithChild): boolean {
  if (m.childProject) return m.childProject.status === "COMPLETED" || m.completed;
  return m.completed;
}

export async function wouldCreateSubProjectCycle(
  prisma: PrismaClient,
  parentProjectId: string,
  childProjectId: string
): Promise<boolean> {
  if (parentProjectId === childProjectId) return true;

  let current: string | null = parentProjectId;
  const visited = new Set<string>();

  while (current) {
    if (current === childProjectId) return true;
    if (visited.has(current)) break;
    visited.add(current);

    const link: { projectId: string } | null = await prisma.projectMilestone.findFirst({
      where: { childProjectId: current },
      select: { projectId: true },
    });
    current = link?.projectId ?? null;
  }

  return false;
}

export async function syncSubProjectMilestonesForChild(
  prisma: PrismaClient,
  childProjectId: string,
  status: string
) {
  const completed = status === "COMPLETED";
  const links = await prisma.projectMilestone.findMany({
    where: { childProjectId },
    select: { id: true, projectId: true, completed: true },
  });

  for (const link of links) {
    if (link.completed === completed) continue;
    await prisma.projectMilestone.update({
      where: { id: link.id },
      data: { completed },
    });
    await syncProjectProgress(prisma, link.projectId);
  }
}

export async function validateSubProjectLink(
  prisma: PrismaClient,
  parentProjectId: string,
  childProjectId: string
): Promise<string | null> {
  if (parentProjectId === childProjectId) return "不能将项目关联自身";

  const child = await prisma.project.findUnique({
    where: { id: childProjectId },
    select: { id: true, name: true },
  });
  if (!child) return "子项目不存在";

  const existing = await prisma.projectMilestone.findFirst({
    where: { childProjectId },
    select: { projectId: true },
  });
  if (existing && existing.projectId !== parentProjectId) {
    return "该项目已是其他项目的子项目";
  }

  if (await wouldCreateSubProjectCycle(prisma, parentProjectId, childProjectId)) {
    return "不能形成循环的子项目关系";
  }

  return null;
}
