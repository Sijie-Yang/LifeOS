import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; contactId: string }> };

export async function DELETE(_: Request, { params }: Params) {
  const { id, contactId } = await params;
  await prisma.goalContact.deleteMany({
    where: { goalId: id, contactId },
  });
  return NextResponse.json({ ok: true });
}
