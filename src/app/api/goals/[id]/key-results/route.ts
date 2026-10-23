import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const maxOrder = await prisma.goalKeyResult.aggregate({
    where: { goalId: id },
    _max: { sortOrder: true },
  });

  const kr = await prisma.goalKeyResult.create({
    data: {
      goalId: id,
      title: body.title,
      completed: body.completed ?? false,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(kr, { status: 201 });
}
