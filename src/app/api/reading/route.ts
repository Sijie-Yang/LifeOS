import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  LEARNING_PROJECT_NAME,
  READING_PROJECT_KEYS,
  READING_PROJECT_MATCH,
  buildReadingFocus,
  inferReadingTag,
  resolveReadingLane,
  resolveStepLane,
  type ReadingNoteDto,
  type ReadingProjectDto,
  type ReadingProjectKey,
} from "@/lib/reading";
import { mapStepsToDates, type ProjectPlanFields } from "@/lib/project-plan";
import { toDateString } from "@/lib/utils";

const LANE_PRIORITY: Record<ReadingProjectKey, string> = {
  "deep-books": "HIGH",
  "info-reading": "MEDIUM",
  "science-info": "MEDIUM",
};

function mapNote(
  row: {
    id: string;
    title: string;
    content: string | null;
    type: string;
    readingTag: string | null;
    pinned: boolean;
    sortOrder: number;
    updatedAt: Date;
    projectId: string | null;
    project: { id: string; name: string } | null;
  },
  key: ReadingNoteDto["projectKey"]
): ReadingNoteDto {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    type: row.type,
    readingTag: row.readingTag,
    pinned: row.pinned,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
    projectId: row.projectId!,
    projectKey: key,
    projectName: row.project?.name ?? LEARNING_PROJECT_NAME,
  };
}

async function loadLearningProject() {
  const include = {
    _count: { select: { notes: true } },
    planSteps: { orderBy: { sortOrder: "asc" as const } },
  };
  return (
    (await prisma.project.findFirst({
      where: { name: LEARNING_PROJECT_NAME },
      include,
    })) ??
    (await prisma.project.findFirst({
      where: { name: { contains: "深读书" } },
      include,
    }))
  );
}

export async function GET() {
  const project = await loadLearningProject();
  if (!project) {
    return NextResponse.json({ projects: [], notes: [], focus: [] });
  }

  const projects: ReadingProjectDto[] = [
    {
      key: "deep-books",
      id: project.id,
      name: project.name,
      progress: project.progress,
      noteCount: project._count.notes,
    },
  ];

  const notes = await prisma.note.findMany({
    where: { projectId: project.id },
    include: { project: { select: { id: true, name: true } } },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });

  const mapped: ReadingNoteDto[] = notes
    .filter((n) => n.projectId)
    .map((n) => mapNote(n, resolveReadingLane(n) ?? "learning"));

  const today = toDateString();
  const fields: ProjectPlanFields = {
    id: project.id,
    name: project.name,
    planActive: project.planActive,
    planWorkdays: project.planWorkdays,
    planAnchorDate: project.planAnchorDate,
    planSkipDates: project.planSkipDates,
    planExtraDates: project.planExtraDates,
    startDate: project.startDate,
  };
  const dateMap = mapStepsToDates(fields, project.planSteps, today).byDate;
  const stepDate = new Map<string, string>();
  for (const [date, steps] of Object.entries(dateMap)) {
    for (const s of steps) stepDate.set(s.id, date);
  }

  const stepsByLane: Record<ReadingProjectKey, typeof project.planSteps> = {
    "deep-books": [],
    "info-reading": [],
    "science-info": [],
  };
  for (const step of project.planSteps) {
    const lane = resolveStepLane(step.title);
    if (lane) stepsByLane[lane].push(step);
  }

  const focusProjects = READING_PROJECT_KEYS.map((key) => ({
    key,
    id: project.id,
    priority: LANE_PRIORITY[key],
    steps: stepsByLane[key].map((s) => ({
      id: s.id,
      title: s.title,
      sortOrder: s.sortOrder,
      done: s.done,
      mappedDate: stepDate.get(s.id) ?? null,
    })),
  }));

  const focus = buildReadingFocus(focusProjects, mapped);

  return NextResponse.json({ projects, notes: mapped, focus });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const projectKey = body.projectKey as ReadingProjectKey;
  const match = READING_PROJECT_MATCH[projectKey];
  if (!match) {
    return NextResponse.json({ error: "invalid projectKey" }, { status: 400 });
  }

  const project = await loadLearningProject();
  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const maxSort = await prisma.note.aggregate({
    where: { projectId: project.id },
    _max: { sortOrder: true },
  });

  const title = body.title?.trim() || "未命名摘录";
  const content = body.content ?? null;
  const readingTag =
    body.readingTag?.trim() ||
    inferReadingTag(projectKey, title, content) ||
    null;

  const note = await prisma.note.create({
    data: {
      title,
      content,
      type: "note",
      readingTag,
      projectId: project.id,
      pinned: Boolean(body.pinned),
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    include: { project: { select: { id: true, name: true } } },
  });

  return NextResponse.json(mapNote(note, projectKey), { status: 201 });
}
