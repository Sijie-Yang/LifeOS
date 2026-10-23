import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapPhase, serializePhaseBody } from "@/lib/life-strategy";

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.title) {
    return NextResponse.json({ error: "缺少 title" }, { status: 400 });
  }

  const maxOrder = await prisma.lifeStrategyPhase.aggregate({ _max: { sortOrder: true } });
  const phase = await prisma.lifeStrategyPhase.create({
    data: {
      title: body.title,
      summary: body.summary || null,
      status: body.status || "planned",
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      timeSplit: JSON.stringify(body.timeSplit ?? {}),
      priorities: JSON.stringify(body.priorities ?? []),
      doList: JSON.stringify(body.doList ?? []),
      dontList: JSON.stringify(body.dontList ?? []),
      content: body.content || null,
      sortOrder: body.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(mapPhase(phase), { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  const phase = await prisma.lifeStrategyPhase.update({
    where: { id: body.id },
    data: serializePhaseBody(body),
  });
  return NextResponse.json(mapPhase(phase));
}
