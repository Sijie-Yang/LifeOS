import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const kr = await prisma.goalKeyResult.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
  });

  return NextResponse.json(kr);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.goalKeyResult.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
