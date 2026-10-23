import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const links = await prisma.goalContact.findMany({
    where: { goalId: id },
    include: { contact: { include: { category: true } } },
  });
  return NextResponse.json(links);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.goalContact.findUnique({
    where: { goalId_contactId: { goalId: id, contactId: body.contactId } },
  });
  if (existing) {
    return NextResponse.json({ error: "联系人已关联" }, { status: 400 });
  }

  const link = await prisma.goalContact.create({
    data: {
      goalId: id,
      contactId: body.contactId,
      role: body.role || null,
    },
    include: { contact: { include: { category: true } } },
  });
  return NextResponse.json(link, { status: 201 });
}
