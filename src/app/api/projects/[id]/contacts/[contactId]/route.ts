import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; contactId: string }> };

export async function DELETE(_: Request, { params }: Params) {
  const { id, contactId } = await params;
  await prisma.projectContact.deleteMany({
    where: { projectId: id, contactId },
  });
  return NextResponse.json({ ok: true });
}
