import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const links = await prisma.projectContact.findMany({
    where: { projectId: id },
    include: { contact: { include: { category: true } } },
  });
  return NextResponse.json(links);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const link = await prisma.projectContact.create({
    data: {
      projectId: id,
      contactId: body.contactId,
      role: body.role || null,
    },
    include: { contact: { include: { category: true } } },
  });
  return NextResponse.json(link, { status: 201 });
}
