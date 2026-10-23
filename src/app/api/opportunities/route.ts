import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const includeRelations = {
  contacts: { include: { contact: { select: { id: true, name: true } } } },
  project: { select: { id: true, name: true } },
  goal: { select: { id: true, title: true } },
} as const;

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const upcoming = request.nextUrl.searchParams.get("upcoming") === "1";
  const lane = request.nextUrl.searchParams.get("lane");
  const today = new Date().toISOString().slice(0, 10);

  const opportunities = await prisma.opportunity.findMany({
    where: {
      ...(lane === "career" || lane === "life" ? { lane } : {}),
      ...(status ? { status } : {}),
      ...(upcoming
        ? {
            deadline: { gte: today },
            status: { in: ["Watching", "Active"] },
          }
        : {}),
    },
    include: includeRelations,
    orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ opportunities });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const contactIds: string[] = body.contactIds || [];

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "标题必填" }, { status: 400 });
  }

  const lane = body.lane === "life" ? "life" : "career";

  const opportunity = await prisma.opportunity.create({
    data: {
      title: body.title.trim(),
      lane,
      category: body.category || (lane === "life" ? "Social" : "Other"),
      status: body.status || "Watching",
      priority: body.priority || "MEDIUM",
      deadline: body.deadline || null,
      source: body.source || null,
      nextAction: body.nextAction || null,
      notes: body.notes || null,
      emailRemind: body.emailRemind !== undefined ? Boolean(body.emailRemind) : true,
      projectId: body.projectId || null,
      goalId: body.goalId || null,
      contacts: contactIds.length
        ? { create: contactIds.map((contactId: string) => ({ contactId })) }
        : undefined,
    },
    include: includeRelations,
  });

  return NextResponse.json(opportunity, { status: 201 });
}
