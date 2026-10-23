import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const upcoming = request.nextUrl.searchParams.get("upcoming") === "1";
  const today = new Date().toISOString().slice(0, 10);

  const travels = await prisma.travel.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(upcoming
        ? {
            OR: [{ endDate: { gte: today } }, { endDate: null, startDate: { gte: today } }],
            status: { in: ["Planned", "Confirmed", "InProgress"] },
          }
        : {}),
    },
    include: {
      companions: { include: { contact: { select: { id: true, name: true } } } },
      project: { select: { id: true, name: true } },
    },
    orderBy: [{ startDate: "desc" }],
  });

  return NextResponse.json({ travels });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const companionIds: string[] = body.companionIds || [];

  const travel = await prisma.travel.create({
    data: {
      title: body.title,
      category: body.category || "Leisure",
      status: body.status || "Planned",
      priority: body.priority || "MEDIUM",
      startDate: body.startDate,
      endDate: body.endDate || null,
      destination: body.destination || null,
      timezone: body.timezone || "GMT+8",
      purpose: body.purpose || null,
      content: body.content || null,
      projectId: body.projectId || null,
      companions: companionIds.length
        ? { create: companionIds.map((contactId: string) => ({ contactId })) }
        : undefined,
    },
    include: {
      companions: { include: { contact: { select: { id: true, name: true } } } },
      project: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(travel, { status: 201 });
}
