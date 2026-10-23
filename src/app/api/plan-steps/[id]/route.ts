import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { syncProjectProgress } from "@/lib/reminders";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.projectPlanStep.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const today = format(new Date(), "yyyy-MM-dd");
  const data: {
    title?: string;
    detail?: string | null;
    done?: boolean;
    doneDate?: string | null;
    isMilestone?: boolean;
    feedback?: string | null;
    correction?: string | null;
    scheduledDate?: string | null;
    estMinutes?: number | null;
    sortOrder?: number;
  } = {};

  if (body.title !== undefined) data.title = String(body.title).trim() || existing.title;
  if (body.detail !== undefined) data.detail = body.detail?.trim() || null;
  if (body.feedback !== undefined) data.feedback = body.feedback?.trim() || null;
  if (body.correction !== undefined) data.correction = body.correction?.trim() || null;

  if (body.done !== undefined) {
    data.done = Boolean(body.done);
    if (data.done) {
      data.doneDate = body.doneDate ?? today;
    } else {
      data.doneDate = null;
    }
  }

  if (body.isMilestone !== undefined) {
    data.isMilestone = Boolean(body.isMilestone);
  }
  if (body.scheduledDate !== undefined) {
    data.scheduledDate = body.scheduledDate ? String(body.scheduledDate).slice(0, 10) : null;
  }
  if (body.estMinutes !== undefined) {
    data.estMinutes = body.estMinutes == null || body.estMinutes === "" ? null : Number(body.estMinutes);
  }
  if (body.sortOrder !== undefined) {
    data.sortOrder = Number(body.sortOrder);
  }

  const step = await prisma.projectPlanStep.update({
    where: { id },
    data,
  });

  if (body.done !== undefined || body.isMilestone !== undefined) {
    await syncProjectProgress(prisma, existing.projectId);
  }

  return NextResponse.json(step);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await prisma.projectPlanStep.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.projectPlanStep.delete({ where: { id } });
  await syncProjectProgress(prisma, existing.projectId);
  return NextResponse.json({ ok: true });
}
