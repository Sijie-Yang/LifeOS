import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  deleteRecordPhotoFile,
  isRecordDomain,
  saveRecordPhoto,
  toRecordDto,
} from "@/lib/life-records";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const row = await prisma.lifeRecord.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json(toRecordDto(row));
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = await prisma.lifeRecord.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "未找到" }, { status: 404 });

  const contentType = request.headers.get("content-type") || "";
  const data: Record<string, unknown> = {};

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    if (form.has("title")) data.title = String(form.get("title") || "").trim();
    if (form.has("content")) {
      const c = String(form.get("content") || "").trim();
      data.content = c || null;
    }
    if (form.has("date")) data.date = String(form.get("date"));
    if (form.has("domain")) {
      const d = String(form.get("domain"));
      if (!isRecordDomain(d)) {
        return NextResponse.json({ error: "domain 无效" }, { status: 400 });
      }
      data.domain = d;
    }
    if (form.has("pinned")) data.pinned = String(form.get("pinned")) === "true";
    if (form.has("meta")) {
      try {
        data.meta = JSON.stringify(JSON.parse(String(form.get("meta"))));
      } catch {
        data.meta = JSON.stringify({ note: String(form.get("meta")) });
      }
    }
    const f = form.get("photo");
    if (f instanceof File && f.size > 0) {
      const domain = (data.domain as string) || existing.domain;
      const date = (data.date as string) || existing.date;
      if (!isRecordDomain(domain)) {
        return NextResponse.json({ error: "domain 无效" }, { status: 400 });
      }
      deleteRecordPhotoFile(existing.photoPath);
      const saved = await saveRecordPhoto({ id, date, domain, file: f });
      data.photoPath = saved.photoPath;
      data.photoMime = saved.photoMime;
    }
  } else {
    const body = await request.json();
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.content !== undefined) data.content = body.content?.trim() || null;
    if (body.date !== undefined) data.date = body.date;
    if (body.domain !== undefined) {
      if (!isRecordDomain(body.domain)) {
        return NextResponse.json({ error: "domain 无效" }, { status: 400 });
      }
      data.domain = body.domain;
    }
    if (body.pinned !== undefined) data.pinned = Boolean(body.pinned);
    if (body.meta !== undefined) data.meta = JSON.stringify(body.meta ?? {});
  }

  if (data.title === "") {
    return NextResponse.json({ error: "标题必填" }, { status: 400 });
  }

  const updated = await prisma.lifeRecord.update({ where: { id }, data });
  return NextResponse.json(toRecordDto(updated));
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = await prisma.lifeRecord.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "未找到" }, { status: 404 });
  deleteRecordPhotoFile(existing.photoPath);
  await prisma.lifeRecord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
