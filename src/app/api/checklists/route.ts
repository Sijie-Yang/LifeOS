import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CHECKLIST_CATEGORIES,
  parseChecklistItems,
  parseChecklistRunItems,
  runProgress,
  snapshotRunItems,
  type ChecklistCategory,
} from "@/lib/checklists";

const runInclude = {
  template: { select: { id: true, title: true, category: true, color: true } },
  project: { select: { id: true, name: true } },
  travel: { select: { id: true, title: true } },
  contact: { select: { id: true, name: true } },
} as const;

function mapTemplate(t: {
  id: string;
  category: string;
  title: string;
  description: string | null;
  color: string;
  sortOrder: number;
  items: string;
  isActive: boolean;
  _count: { runs: number };
  runs: Array<{ status: string }>;
}) {
  const items = parseChecklistItems(t.items);
  const activeRuns = t.runs.filter((r) => r.status === "active").length;
  return {
    id: t.id,
    category: t.category,
    title: t.title,
    description: t.description,
    color: t.color,
    sortOrder: t.sortOrder,
    itemCount: items.length,
    items,
    isActive: t.isActive,
    runCount: t._count.runs,
    activeRunCount: activeRuns,
  };
}

function mapRun(r: {
  id: string;
  title: string;
  status: string;
  notes: string | null;
  items: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  projectId: string | null;
  travelId: string | null;
  contactId: string | null;
  template: { id: string; title: string; category: string; color: string };
  project: { id: string; name: string } | null;
  travel: { id: string; title: string } | null;
  contact: { id: string; name: string } | null;
}) {
  const items = parseChecklistRunItems(r.items);
  const progress = runProgress(items);
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    notes: r.notes,
    items,
    progress,
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    projectId: r.projectId,
    travelId: r.travelId,
    contactId: r.contactId,
    template: r.template,
    project: r.project,
    travel: r.travel,
    contact: r.contact,
  };
}

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const templateId = request.nextUrl.searchParams.get("templateId");

  const templates = await prisma.checklistTemplate.findMany({
    where: {
      isActive: true,
      ...(category ? { category } : {}),
    },
    include: {
      _count: { select: { runs: true } },
      runs: { select: { status: true } },
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
  });

  const mappedTemplates = templates.map(mapTemplate);

  const categories = CHECKLIST_CATEGORIES.map((c) => {
    const inCat = mappedTemplates.filter((t) => t.category === c.id);
    const primary = inCat[0] ?? null;
    return {
      ...c,
      templateId: primary?.id ?? null,
      templateCount: inCat.length,
      runCount: inCat.reduce((s, t) => s + t.runCount, 0),
      activeRunCount: inCat.reduce((s, t) => s + t.activeRunCount, 0),
    };
  });

  // Resolve template by id or by category (1 category = 1 template)
  let resolvedTemplateId = templateId;
  if (!resolvedTemplateId && category) {
    resolvedTemplateId =
      mappedTemplates.find((t) => t.category === category)?.id ?? null;
  }

  let runs: ReturnType<typeof mapRun>[] = [];
  if (resolvedTemplateId) {
    const list = await prisma.checklistRun.findMany({
      where: { templateId: resolvedTemplateId },
      include: runInclude,
      orderBy: { createdAt: "desc" },
    });
    runs = list.map(mapRun);
  }

  return NextResponse.json({
    categories,
    templates: mappedTemplates,
    runs,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = body.action as string;

  // Create a new run from template
  if (action === "start" || !action) {
    const templateId = body.templateId as string;
    if (!templateId) {
      return NextResponse.json({ error: "templateId required" }, { status: 400 });
    }
    const template = await prisma.checklistTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      return NextResponse.json({ error: "template not found" }, { status: 404 });
    }
    const defs = parseChecklistItems(template.items);
    const title =
      (body.title as string)?.trim() ||
      `${template.title} · ${new Date().toISOString().slice(0, 10)}`;

    const run = await prisma.checklistRun.create({
      data: {
        templateId,
        title,
        notes: body.notes?.trim() || null,
        items: JSON.stringify(snapshotRunItems(defs)),
        projectId: body.projectId || null,
        travelId: body.travelId || null,
        contactId: body.contactId || null,
        status: "active",
      },
      include: runInclude,
    });
    return NextResponse.json(mapRun(run), { status: 201 });
  }

  // Create custom template
  if (action === "createTemplate") {
    const category = (body.category || "other") as ChecklistCategory;
    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }
    const items = Array.isArray(body.items) ? body.items : [];
    const t = await prisma.checklistTemplate.create({
      data: {
        category,
        title,
        description: body.description?.trim() || null,
        color: body.color || checklistCategoryMetaFallback(category),
        sortOrder: body.sortOrder ?? 99,
        items: JSON.stringify(items),
      },
      include: {
        _count: { select: { runs: true } },
        runs: { select: { status: true } },
      },
    });
    return NextResponse.json(mapTemplate(t), { status: 201 });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

function checklistCategoryMetaFallback(category: string) {
  const hit = CHECKLIST_CATEGORIES.find((c) => c.id === category);
  return hit?.color ?? "#71717a";
}
