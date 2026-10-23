import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapEntry } from "@/lib/life-strategy";
import { toDateString } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.title || !body.content) {
    return NextResponse.json({ error: "缺少 title 或 content" }, { status: 400 });
  }

  const entry = await prisma.lifeStrategyEntry.create({
    data: {
      phaseId: body.phaseId || null,
      date: body.date || toDateString(),
      title: body.title,
      content: body.content,
      source: body.source || null,
      tags: JSON.stringify(body.tags ?? []),
      sortOrder: body.sortOrder ?? 0,
    },
  });
  return NextResponse.json(mapEntry(entry), { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  const entry = await prisma.lifeStrategyEntry.update({
    where: { id: body.id },
    data: {
      ...(body.phaseId !== undefined && { phaseId: body.phaseId || null }),
      ...(body.date !== undefined && { date: String(body.date) }),
      ...(body.title !== undefined && { title: String(body.title) }),
      ...(body.content !== undefined && { content: String(body.content) }),
      ...(body.source !== undefined && { source: body.source || null }),
      ...(body.tags !== undefined && { tags: JSON.stringify(body.tags ?? []) }),
      ...(body.sortOrder !== undefined && { sortOrder: Number(body.sortOrder) }),
    },
  });
  return NextResponse.json(mapEntry(entry));
}
