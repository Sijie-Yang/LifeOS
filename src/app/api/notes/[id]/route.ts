import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const note = await prisma.note.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.content !== undefined && { content: body.content || null }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.readingTag !== undefined && { readingTag: body.readingTag || null }),
      ...(body.projectId !== undefined && { projectId: body.projectId || null }),
      ...(body.pinned !== undefined && { pinned: body.pinned }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
    include: { project: true },
  });
  return NextResponse.json(note);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.note.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
