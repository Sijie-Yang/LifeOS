import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const includeRelations = {
  contacts: { include: { contact: { select: { id: true, name: true } } } },
  project: { select: { id: true, name: true } },
  goal: { select: { id: true, title: true } },
} as const;

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const opportunity = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      contacts: { include: { contact: true } },
      project: true,
      goal: true,
    },
  });
  if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(opportunity);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  if (body.contactIds !== undefined) {
    await prisma.opportunityContact.deleteMany({ where: { opportunityId: id } });
    const ids: string[] = body.contactIds || [];
    if (ids.length) {
      await prisma.opportunityContact.createMany({
        data: ids.map((contactId) => ({ opportunityId: id, contactId })),
      });
    }
  }

  const opportunity = await prisma.opportunity.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: String(body.title).trim() }),
      ...(body.lane === "career" || body.lane === "life" ? { lane: body.lane } : {}),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.deadline !== undefined && { deadline: body.deadline || null }),
      ...(body.source !== undefined && { source: body.source || null }),
      ...(body.nextAction !== undefined && { nextAction: body.nextAction || null }),
      ...(body.pushedDate !== undefined && {
        pushedDate: typeof body.pushedDate === "string" && /^(undo:)?\d{4}-\d{2}-\d{2}$/.test(body.pushedDate) ? body.pushedDate : null,
      }),
      ...(body.notes !== undefined && { notes: body.notes || null }),
      ...(body.emailRemind !== undefined && { emailRemind: Boolean(body.emailRemind) }),
      ...(body.projectId !== undefined && { projectId: body.projectId || null }),
      ...(body.goalId !== undefined && { goalId: body.goalId || null }),
    },
    include: includeRelations,
  });

  return NextResponse.json(opportunity);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.opportunity.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
