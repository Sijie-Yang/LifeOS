import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isLifePowerKey } from "@/lib/life-powers";

type Params = { params: Promise<{ key: string }> };

/** 把项目选入 / 移出某一力：{ projectId, selected } */
export async function PUT(request: NextRequest, { params }: Params) {
  const { key } = await params;
  if (!isLifePowerKey(key)) {
    return NextResponse.json({ error: "未知的力" }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as { projectId?: unknown; selected?: unknown } | null;
  if (typeof body?.projectId !== "string" || typeof body.selected !== "boolean") {
    return NextResponse.json({ error: "需要 projectId 与 selected" }, { status: 400 });
  }
  const project = await prisma.project.findUnique({ where: { id: body.projectId }, select: { power: true } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  // 移出时只清自己这一力，避免误清别的力
  if (!body.selected && project.power !== key) {
    return NextResponse.json({ ok: true, power: project.power });
  }
  const power = body.selected ? key : null;
  await prisma.project.update({ where: { id: body.projectId }, data: { power } });
  return NextResponse.json({ ok: true, power });
}
