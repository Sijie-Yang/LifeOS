import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveLibraryFile } from "@/lib/library";

type Params = { params: Promise<{ id: string }> };

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".epub": "application/epub+zip",
  ".html": "text/html",
  ".htm": "text/html",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const doc = await prisma.libraryDocument.findUnique({ where: { id } });
  if (!doc?.relativePath) {
    return NextResponse.json({ error: "No file linked" }, { status: 404 });
  }

  let abs: string;
  try {
    abs = resolveLibraryFile(doc.relativePath);
  } catch {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  if (!fs.existsSync(abs)) {
    return NextResponse.json({ error: "File missing on disk" }, { status: 404 });
  }

  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const filename = path.basename(abs);

  return new NextResponse(buf, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${ext === ".html" || ext === ".htm" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, max-age=60",
    },
  });
}
