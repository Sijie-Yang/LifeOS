import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const travel = await prisma.travel.findUnique({
    where: { id },
    include: {
      companions: { include: { contact: true } },
      project: true,
    },
  });
  if (!travel) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(travel);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  if (body.companionIds !== undefined) {
    await prisma.travelCompanion.deleteMany({ where: { travelId: id } });
    const ids: string[] = body.companionIds || [];
    if (ids.length) {
      await prisma.travelCompanion.createMany({
        data: ids.map((contactId) => ({ travelId: id, contactId })),
      });
    }
  }

  const travel = await prisma.travel.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.startDate !== undefined && { startDate: body.startDate }),
      ...(body.endDate !== undefined && { endDate: body.endDate || null }),
      ...(body.destination !== undefined && { destination: body.destination || null }),
      ...(body.timezone !== undefined && { timezone: body.timezone }),
      ...(body.purpose !== undefined && { purpose: body.purpose || null }),
      ...(body.content !== undefined && { content: body.content || null }),
      ...(body.projectId !== undefined && { projectId: body.projectId || null }),
    },
    include: {
      companions: { include: { contact: { select: { id: true, name: true } } } },
      project: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(travel);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.travel.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
