import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const contactedAt = body.contactedAt ? new Date(body.contactedAt) : new Date();

  if (!Number.isFinite(contactedAt.getTime()) || contactedAt.getTime() > Date.now()) {
    return NextResponse.json({ error: "联系时间需为有效的过去或当前时间" }, { status: 400 });
  }
  if (!await prisma.contact.findUnique({ where: { id }, select: { id: true } })) {
    return NextResponse.json({ error: "联系人不存在" }, { status: 404 });
  }

  const [log] = await prisma.$transaction([
    prisma.contactLog.create({
      data: {
        contactId: id,
        type: body.type || "message",
        content: body.content || null,
        contactedAt,
      },
    }),
    prisma.contact.updateMany({
      where: { id, OR: [{ lastContactAt: null }, { lastContactAt: { lt: contactedAt } }] },
      data: { lastContactAt: contactedAt },
    }),
  ]);

  return NextResponse.json(log, { status: 201 });
}
