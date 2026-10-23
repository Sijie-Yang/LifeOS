import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildProjectLoopResult,
  todayString,
  type ProjectLoopProjectInput,
} from "@/lib/project-loop";

export async function GET() {
  const asOf = todayString();
  const projects = await prisma.project.findMany({
    where: {
      status: { not: "ARCHIVED" },
    },
    select: {
      id: true,
      name: true,
      status: true,
      planActive: true,
      category: { select: { name: true, color: true } },
      planSteps: {
        select: {
          id: true,
          title: true,
          detail: true,
          done: true,
          doneDate: true,
          isMilestone: true,
          sortOrder: true,
          feedback: true,
          correction: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const input: ProjectLoopProjectInput[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    planActive: p.planActive,
    categoryName: p.category?.name ?? null,
    color: p.category?.color ?? "#6366f1",
    steps: p.planSteps,
  }));

  return NextResponse.json(buildProjectLoopResult(input, asOf));
}
