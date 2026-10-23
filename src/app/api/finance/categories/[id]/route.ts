import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const category = await prisma.financeCategory.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.budget !== undefined && { budget: body.budget }),
    },
  });

  return NextResponse.json(category);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.financeCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
