import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const noteOrder = [
  { pinned: "desc" as const },
  { sortOrder: "asc" as const },
  { updatedAt: "desc" as const },
];

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const notes = await prisma.note.findMany({
    where: { projectId: id },
    orderBy: noteOrder,
  });
  return NextResponse.json(notes);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const maxSort = await prisma.note.aggregate({
    where: { projectId: id },
    _max: { sortOrder: true },
  });

  const note = await prisma.note.create({
    data: {
      title: body.title || "未命名笔记",
      content: body.content ?? null,
      type: body.type || "note",
      projectId: id,
      pinned: body.pinned ?? false,
      sortOrder: body.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(note, { status: 201 });
}
