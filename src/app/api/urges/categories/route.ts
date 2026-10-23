import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_URGE_CATEGORIES } from "@/lib/urges";

export async function GET() {
  const categories = await prisma.urgeCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ categories });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const maxOrder = await prisma.urgeCategory.aggregate({ _max: { sortOrder: true } });

  const category = await prisma.urgeCategory.create({
    data: {
      name: body.name.trim(),
      color: body.color || DEFAULT_URGE_CATEGORIES[0].color,
      isPrivate: Boolean(body.isPrivate),
      goal: body.goal?.trim() || null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(category, { status: 201 });
}
