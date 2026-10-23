import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const notes = await prisma.note.findMany({
    include: {
      project: true,
    },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(notes);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const note = await prisma.note.create({
    data: {
      title: body.title,
      content: body.content || null,
      type: body.type || "note",
      projectId: body.projectId || null,
      pinned: body.pinned ?? false,
      sortOrder: body.sortOrder ?? 0,
    },
    include: { project: true },
  });
  return NextResponse.json(note, { status: 201 });
}
