import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseChecklistRunItems,
  runProgress,
  type ChecklistRunItem,
} from "@/lib/checklists";

const runInclude = {
  template: { select: { id: true, title: true, category: true, color: true } },
  project: { select: { id: true, name: true } },
  travel: { select: { id: true, title: true } },
  contact: { select: { id: true, name: true } },
} as const;

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
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    notes: r.notes,
    items,
    progress: runProgress(items),
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

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const run = await prisma.checklistRun.findUnique({
    where: { id },
    include: runInclude,
  });
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(mapRun(run));
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await request.json();
  const existing = await prisma.checklistRun.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  let items = parseChecklistRunItems(existing.items);
  const data: {
    title?: string;
    notes?: string | null;
    status?: string;
    items?: string;
    completedAt?: Date | null;
    projectId?: string | null;
    travelId?: string | null;
    contactId?: string | null;
  } = {};

  if (body.title !== undefined) data.title = String(body.title).trim() || existing.title;
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
  if (body.projectId !== undefined) data.projectId = body.projectId || null;
  if (body.travelId !== undefined) data.travelId = body.travelId || null;
  if (body.contactId !== undefined) data.contactId = body.contactId || null;

  if (body.itemId !== undefined && body.done !== undefined) {
    const now = new Date().toISOString();
    items = items.map((it) =>
      it.id === body.itemId
        ? { ...it, done: Boolean(body.done), doneAt: body.done ? now : null }
        : it
    );
    data.items = JSON.stringify(items);
  }

  if (Array.isArray(body.items)) {
    items = body.items as ChecklistRunItem[];
    data.items = JSON.stringify(items);
  }

  if (body.status !== undefined) {
    data.status = body.status;
    if (body.status === "done") data.completedAt = new Date();
    if (body.status === "active") data.completedAt = null;
  } else if (data.items) {
    const { done, total } = runProgress(items);
    if (total > 0 && done === total) {
      data.status = "done";
      data.completedAt = new Date();
    } else if (existing.status === "done" && done < total) {
      data.status = "active";
      data.completedAt = null;
    }
  }

  const run = await prisma.checklistRun.update({
    where: { id },
    data,
    include: runInclude,
  });
  return NextResponse.json(mapRun(run));
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  await prisma.checklistRun.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
