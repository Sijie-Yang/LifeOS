import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.dueDate !== undefined) data.dueDate = body.dueDate || null;
  if (body.scheduledDate !== undefined) data.scheduledDate = body.scheduledDate || null;
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.projectId !== undefined) data.projectId = body.projectId || null;
  if (body.contactId !== undefined) data.contactId = body.contactId || null;
  if (body.meetingId !== undefined) data.meetingId = body.meetingId || null;
  if (body.cancelled !== undefined) data.cancelled = body.cancelled;
  if (body.emailRemind !== undefined) data.emailRemind = Boolean(body.emailRemind);
  if (body.completed !== undefined) {
    data.completed = body.completed;
    data.completedAt = body.completed ? new Date() : null;
  }

  const task = await prisma.taskItem.update({
    where: { id },
    data,
    include: {
      project: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      meeting: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json(task);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.taskItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
