import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HEALTH_TIP_CATEGORIES, mapHealthTip } from "@/lib/health";

export async function GET() {
  const tips = await prisma.healthTip.findMany({
    orderBy: [{ pinned: "desc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(tips.map(mapHealthTip));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const category = String(body.category || "body");
  if (!HEALTH_TIP_CATEGORIES.includes(category as (typeof HEALTH_TIP_CATEGORIES)[number])) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const tip = await prisma.healthTip.create({
    data: {
      category,
      title: String(body.title).trim(),
      content: String(body.content || "").trim(),
      pinned: Boolean(body.pinned),
      sortOrder: Number(body.sortOrder) || 0,
    },
  });

  return NextResponse.json(mapHealthTip(tip));
}
