import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const upcoming = request.nextUrl.searchParams.get("upcoming") === "1";
  const today = new Date().toISOString().slice(0, 10);

  const meetings = await prisma.meeting.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(upcoming ? { meetingDate: { gte: today }, status: { in: ["Scheduled", "Tentative"] } } : {}),
    },
    include: {
      attendees: { include: { contact: { select: { id: true, name: true } } } },
      referrer: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: [{ meetingDate: "desc" }, { meetingTime: "asc" }],
  });

  return NextResponse.json({ meetings });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const attendeeIds: string[] = body.attendeeIds || [];

  const meeting = await prisma.meeting.create({
    data: {
      title: body.title,
      category: body.category || "Other",
      status: body.status || "Scheduled",
      priority: body.priority || "MEDIUM",
      meetingDate: body.meetingDate,
      meetingTime: body.meetingTime || null,
      timezone: body.timezone || "GMT+8",
      durationMin: body.durationMin || null,
      meetingFormat: body.meetingFormat || null,
      location: body.location || null,
      purpose: body.purpose || null,
      content: body.content || null,
      logDate: body.logDate || null,
      projectId: body.projectId || null,
      referrerId: body.referrerId || null,
      attendees: attendeeIds.length
        ? { create: attendeeIds.map((contactId: string) => ({ contactId })) }
        : undefined,
    },
    include: {
      attendees: { include: { contact: { select: { id: true, name: true } } } },
      referrer: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(meeting, { status: 201 });
}
