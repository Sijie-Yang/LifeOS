import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const categories = await prisma.financeCategory.findMany({
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const maxOrder = await prisma.financeCategory.aggregate({ _max: { sortOrder: true } });

  const category = await prisma.financeCategory.create({
    data: {
      name: body.name,
      type: body.type,
      color: body.color || "#6366f1",
      budget: body.budget ?? null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(category, { status: 201 });
}
