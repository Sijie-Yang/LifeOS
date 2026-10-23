import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.urgeEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
