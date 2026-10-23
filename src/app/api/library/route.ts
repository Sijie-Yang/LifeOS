import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ensureLibraryRoot,
  guessTitleFromFilename,
  parseTags,
  READING_LIBRARY_ROOT,
  scanLibraryFiles,
  stringifyTags,
} from "@/lib/library";

const includeRelations = {
  projects: {
    include: { project: { select: { id: true, name: true, status: true } } },
  },
} as const;

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const projectId = request.nextUrl.searchParams.get("projectId");
  const scan = request.nextUrl.searchParams.get("scan") === "1";

  ensureLibraryRoot();

  if (scan) {
    const files = scanLibraryFiles();
    const linked = await prisma.libraryDocument.findMany({
      where: { relativePath: { not: null } },
      select: { relativePath: true, id: true, title: true },
    });
    const byPath = new Map(linked.map((d) => [d.relativePath!, d]));
    return NextResponse.json({
      root: READING_LIBRARY_ROOT,
      files: files.map((f) => ({
        ...f,
        linked: byPath.has(f.relativePath),
        documentId: byPath.get(f.relativePath)?.id ?? null,
        documentTitle: byPath.get(f.relativePath)?.title ?? null,
      })),
    });
  }

  const documents = await prisma.libraryDocument.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(projectId
        ? { projects: { some: { projectId } } }
        : {}),
    },
    include: includeRelations,
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({
    root: READING_LIBRARY_ROOT,
    documents: documents.map((d) => ({
      ...d,
      tags: parseTags(d.tags),
    })),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const projectIds: string[] = body.projectIds || [];

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "标题必填" }, { status: 400 });
  }

  const relativePath =
    typeof body.relativePath === "string" && body.relativePath.trim()
      ? body.relativePath.trim().replace(/\\/g, "/")
      : null;

  if (relativePath) {
    const exists = await prisma.libraryDocument.findFirst({
      where: { relativePath },
    });
    if (exists) {
      return NextResponse.json(
        { error: "该文件已在文献库中", id: exists.id },
        { status: 409 }
      );
    }
  }

  const title =
    body.title.trim() ||
    (relativePath ? guessTitleFromFilename(relativePath.split("/").pop() || "") : "Untitled");

  const document = await prisma.libraryDocument.create({
    data: {
      title,
      authors: body.authors || null,
      year: body.year || null,
      kind: body.kind || "paper",
      status: body.status || "to_read",
      relativePath,
      sourceUrl: body.sourceUrl || null,
      doi: body.doi || null,
      whySelected: body.whySelected || null,
      notes: body.notes || null,
      tags: stringifyTags(Array.isArray(body.tags) ? body.tags : []),
      pinned: Boolean(body.pinned),
      projects: projectIds.length
        ? {
            create: projectIds.map((projectId: string) => ({
              projectId,
              role: body.role || null,
            })),
          }
        : undefined,
    },
    include: includeRelations,
  });

  return NextResponse.json(
    { ...document, tags: parseTags(document.tags) },
    { status: 201 }
  );
}
