import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateCircle } from "@/lib/contact-maintenance";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  let data;
  try { data = validateCircle(await request.json()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "无效输入" }, { status: 400 }); }
  if (!await prisma.contactCategory.findUnique({ where: { id } })) return NextResponse.json({ error: "圈子不存在" }, { status: 404 });
  if (await prisma.contactCategory.findFirst({ where: { name: data.name, id: { not: id } } })) return NextResponse.json({ error: "已有同名圈子" }, { status: 409 });
  return NextResponse.json(await prisma.contactCategory.update({ where: { id }, data }));
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  // The relation uses SetNull: members and their history are preserved.
  await prisma.contactCategory.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
