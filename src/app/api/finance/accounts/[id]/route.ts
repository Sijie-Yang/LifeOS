import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const account = await prisma.financeAccount.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.balance !== undefined && { balance: body.balance }),
      ...(body.currency !== undefined && { currency: body.currency }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  return NextResponse.json(account);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.financeAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
