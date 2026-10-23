import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const data: { name?: string; color?: string } = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "分类名称不能为空" }, { status: 400 });
    }
    const dup = await prisma.projectCategory.findFirst({
      where: { name, NOT: { id } },
    });
    if (dup) {
      return NextResponse.json({ error: "分类名称已存在" }, { status: 409 });
    }
    data.name = name;
  }
  if (body.color !== undefined) data.color = body.color;

  const category = await prisma.projectCategory.update({ where: { id }, data });
  return NextResponse.json(category);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.projectCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
