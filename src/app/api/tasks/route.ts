import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateString } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const filter = request.nextUrl.searchParams.get("filter") || "open";
  const today = toDateString();

  const inboxScope = { OR: [{ projectId: null }, { meetingId: { not: null } }] };
  const where =
    filter === "today"
      ? {
          completed: false,
          cancelled: false,
          AND: [inboxScope, { OR: [{ dueDate: today }, { scheduledDate: today }] }],
        }
      : filter === "overdue"
        ? { completed: false, cancelled: false, dueDate: { lt: today }, AND: [inboxScope] }
        : filter === "done"
          ? { completed: true, AND: [inboxScope] }
          : filter === "all"
            ? inboxScope
            : { completed: false, cancelled: false, AND: [inboxScope] };

  const tasks = await prisma.taskItem.findMany({
    where,
    include: {
      project: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      meeting: { select: { id: true, title: true, meetingDate: true } },
    },
    orderBy: [
      { completed: "asc" },
      { priority: "desc" },
      { dueDate: "asc" },
      { sortOrder: "asc" },
    ],
  });

  const counts = {
    open: await prisma.taskItem.count({
      where: { completed: false, cancelled: false, AND: [inboxScope] },
    }),
    today: await prisma.taskItem.count({
      where: {
        completed: false,
        cancelled: false,
        AND: [inboxScope, { OR: [{ dueDate: today }, { scheduledDate: today }] }],
      },
    }),
    overdue: await prisma.taskItem.count({
      where: { completed: false, cancelled: false, dueDate: { lt: today }, AND: [inboxScope] },
    }),
  };

  return NextResponse.json({ tasks, counts });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const task = await prisma.taskItem.create({
    data: {
      title: body.title,
      dueDate: body.dueDate || null,
      scheduledDate: body.scheduledDate || null,
      priority: body.priority || "MEDIUM",
      projectId: body.projectId || null,
      goalId: body.goalId || null,
      contactId: body.contactId || null,
      meetingId: body.meetingId || null,
      noteId: body.noteId || null,
      sortOrder: body.sortOrder ?? 0,
      source: body.source || null,
      emailRemind: body.emailRemind !== undefined ? Boolean(body.emailRemind) : true,
    },
    include: {
      project: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      meeting: { select: { id: true, title: true } },
    },
  });
  return NextResponse.json(task, { status: 201 });
}
