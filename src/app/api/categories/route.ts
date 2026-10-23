import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { validateCircle } from "@/lib/contact-maintenance";

export async function GET() {
  const categories = await prisma.contactCategory.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  let data;
  try { data = validateCircle(await request.json()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "无效输入" }, { status: 400 }); }
  if (await prisma.contactCategory.findFirst({ where: { name: data.name } })) {
    return NextResponse.json({ error: "已有同名圈子" }, { status: 409 });
  }
  const category = await prisma.contactCategory.create({ data });
  return NextResponse.json(category, { status: 201 });
}
