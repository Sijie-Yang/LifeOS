import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      attendees: { include: { contact: true } },
      referrer: true,
      project: true,
      tasks: { orderBy: [{ completed: "asc" }, { sortOrder: "asc" }] },
    },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(meeting);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  if (body.attendeeIds !== undefined) {
    await prisma.meetingAttendee.deleteMany({ where: { meetingId: id } });
    const ids: string[] = body.attendeeIds || [];
    if (ids.length) {
      await prisma.meetingAttendee.createMany({
        data: ids.map((contactId) => ({ meetingId: id, contactId })),
      });
    }
  }

  const meeting = await prisma.meeting.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.meetingDate !== undefined && { meetingDate: body.meetingDate }),
      ...(body.meetingTime !== undefined && { meetingTime: body.meetingTime || null }),
      ...(body.timezone !== undefined && { timezone: body.timezone }),
      ...(body.durationMin !== undefined && { durationMin: body.durationMin || null }),
      ...(body.meetingFormat !== undefined && { meetingFormat: body.meetingFormat || null }),
      ...(body.location !== undefined && { location: body.location || null }),
      ...(body.purpose !== undefined && { purpose: body.purpose || null }),
      ...(body.content !== undefined && { content: body.content || null }),
      ...(body.logDate !== undefined && { logDate: body.logDate || null }),
      ...(body.projectId !== undefined && { projectId: body.projectId || null }),
      ...(body.referrerId !== undefined && { referrerId: body.referrerId || null }),
    },
    include: {
      attendees: { include: { contact: { select: { id: true, name: true } } } },
      referrer: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(meeting);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.meeting.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
