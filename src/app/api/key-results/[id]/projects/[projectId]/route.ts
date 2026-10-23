import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; projectId: string }> };

export async function DELETE(_: Request, { params }: Params) {
  const { id, projectId } = await params;
  await prisma.goalKeyResultProject.deleteMany({
    where: { keyResultId: id, projectId },
  });
  return NextResponse.json({ ok: true });
}
