import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.pomodoroSession.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  }

  const endedAt = body.endedAt ? new Date(body.endedAt) : new Date();
  const status = body.status as string;

  let actualMinutes = body.actualMinutes as number | undefined;
  if (actualMinutes === undefined && status === "completed") {
    actualMinutes = Math.max(1, Math.round((endedAt.getTime() - existing.startedAt.getTime()) / 60000));
  }

  const session = await prisma.pomodoroSession.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(actualMinutes !== undefined && { actualMinutes }),
      ...(body.distractions !== undefined && { distractions: Number(body.distractions) }),
      ...(body.breakQuality !== undefined && { breakQuality: body.breakQuality == null ? null : Number(body.breakQuality) }),
      ...(body.preEnergy !== undefined && { preEnergy: body.preEnergy == null ? null : Number(body.preEnergy) }),
      endedAt,
    },
    include: {
      habit: { select: { id: true, name: true, color: true, startTime: true, endTime: true } },
    },
  });

  return NextResponse.json(session);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.pomodoroSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
