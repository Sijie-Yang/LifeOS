import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTags, stringifyTags } from "@/lib/library";

type Params = { params: Promise<{ id: string }> };

const includeRelations = {
  projects: {
    include: { project: { select: { id: true, name: true, status: true } } },
  },
} as const;

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const document = await prisma.libraryDocument.findUnique({
    where: { id },
    include: includeRelations,
  });
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...document, tags: parseTags(document.tags) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  if (body.projectIds !== undefined) {
    await prisma.libraryDocumentProject.deleteMany({ where: { documentId: id } });
    const ids: string[] = body.projectIds || [];
    if (ids.length) {
      await prisma.libraryDocumentProject.createMany({
        data: ids.map((projectId) => ({
          documentId: id,
          projectId,
          role: body.role || null,
        })),
      });
    }
  }

  const document = await prisma.libraryDocument.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: String(body.title).trim() }),
      ...(body.authors !== undefined && { authors: body.authors || null }),
      ...(body.year !== undefined && { year: body.year || null }),
      ...(body.kind !== undefined && { kind: body.kind }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.relativePath !== undefined && {
        relativePath: body.relativePath
          ? String(body.relativePath).trim().replace(/\\/g, "/")
          : null,
      }),
      ...(body.sourceUrl !== undefined && { sourceUrl: body.sourceUrl || null }),
      ...(body.doi !== undefined && { doi: body.doi || null }),
      ...(body.whySelected !== undefined && { whySelected: body.whySelected || null }),
      ...(body.notes !== undefined && { notes: body.notes || null }),
      ...(body.tags !== undefined && {
        tags: stringifyTags(Array.isArray(body.tags) ? body.tags : []),
      }),
      ...(body.pinned !== undefined && { pinned: Boolean(body.pinned) }),
    },
    include: includeRelations,
  });

  return NextResponse.json({ ...document, tags: parseTags(document.tags) });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.libraryDocument.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
