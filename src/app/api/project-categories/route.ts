import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pickCategoryColor } from "@/lib/project-categories";

export async function GET() {
  const categories = await prisma.projectCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: true } } },
  });
  return NextResponse.json(
    categories.map(({ _count, ...cat }) => ({ ...cat, projectCount: _count.projects }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = String(body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "分类名称不能为空" }, { status: 400 });
  }

  const existing = await prisma.projectCategory.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "分类名称已存在" }, { status: 409 });
  }

  const count = await prisma.projectCategory.count();
  const category = await prisma.projectCategory.create({
    data: { name, color: body.color || pickCategoryColor(count) },
  });
  return NextResponse.json(category, { status: 201 });
}
