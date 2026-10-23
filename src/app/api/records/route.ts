import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isRecordDomain,
  saveRecordPhoto,
  toRecordDto,
  type RecordDomain,
} from "@/lib/life-records";
import { toDateString } from "@/lib/utils";

function buildStats(
  rows: Array<{ date: string; domain: string; photoPath: string | null }>
) {
  const byDomain: Record<string, { count: number; withPhoto: number }> = {};
  const daySet = new Set<string>();
  for (const r of rows) {
    daySet.add(r.date);
    if (!byDomain[r.domain]) byDomain[r.domain] = { count: 0, withPhoto: 0 };
    byDomain[r.domain].count += 1;
    if (r.photoPath) byDomain[r.domain].withPhoto += 1;
  }

  // last 28 days streak of any record
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = toDateString(d);
    if (daySet.has(key)) streak += 1;
    else break;
  }

  const days28: Array<{ date: string; count: number }> = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = toDateString(d);
    days28.push({
      date: key,
      count: rows.filter((r) => r.date === key).length,
    });
  }

  return {
    total: rows.length,
    withPhoto: rows.filter((r) => r.photoPath).length,
    activeDays: daySet.size,
    streak,
    byDomain,
    days28,
  };
}

export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain");
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 80), 200);

  const where = {
    ...(domain && isRecordDomain(domain) ? { domain } : {}),
    ...(from || to
      ? {
          date: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [records, allForStats] = await Promise.all([
    prisma.lifeRecord.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
    }),
    prisma.lifeRecord.findMany({
      where: from || to ? where : undefined,
      select: { date: true, domain: true, photoPath: true },
    }),
  ]);

  return NextResponse.json({
    records: records.map(toRecordDto),
    stats: buildStats(allForStats),
  });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  let date = toDateString();
  let domain: RecordDomain = "research";
  let title = "";
  let content: string | null = null;
  let meta: Record<string, unknown> = {};
  let pinned = false;
  let file: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    date = String(form.get("date") || date);
    const d = String(form.get("domain") || "");
    if (!isRecordDomain(d)) {
      return NextResponse.json({ error: "domain 无效" }, { status: 400 });
    }
    domain = d;
    title = String(form.get("title") || "").trim();
    content = String(form.get("content") || "").trim() || null;
    pinned = String(form.get("pinned") || "") === "true";
    const metaRaw = form.get("meta");
    if (typeof metaRaw === "string" && metaRaw.trim()) {
      try {
        meta = JSON.parse(metaRaw);
      } catch {
        meta = { note: metaRaw };
      }
    }
    // convenience flat fields
    const subject = String(form.get("subject") || "").trim();
    const detail = String(form.get("detail") || "").trim();
    if (subject) meta.subject = subject;
    if (detail) meta.detail = detail;
    const f = form.get("photo");
    if (f instanceof File && f.size > 0) file = f;
  } else {
    const body = await request.json();
    date = body.date || date;
    if (!isRecordDomain(body.domain || "")) {
      return NextResponse.json({ error: "domain 无效" }, { status: 400 });
    }
    domain = body.domain;
    title = String(body.title || "").trim();
    content = body.content?.trim() || null;
    meta = body.meta && typeof body.meta === "object" ? body.meta : {};
    pinned = Boolean(body.pinned);
  }

  if (!title) {
    return NextResponse.json({ error: "标题必填" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日期格式应为 YYYY-MM-DD" }, { status: 400 });
  }

  const created = await prisma.lifeRecord.create({
    data: {
      date,
      domain,
      title,
      content,
      meta: JSON.stringify(meta),
      pinned,
    },
  });

  if (file) {
    try {
      const saved = await saveRecordPhoto({
        id: created.id,
        date,
        domain,
        file,
      });
      const updated = await prisma.lifeRecord.update({
        where: { id: created.id },
        data: { photoPath: saved.photoPath, photoMime: saved.photoMime },
      });
      return NextResponse.json(toRecordDto(updated), { status: 201 });
    } catch (e) {
      await prisma.lifeRecord.delete({ where: { id: created.id } }).catch(() => {});
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "图片保存失败" },
        { status: 400 }
      );
    }
  }

  return NextResponse.json(toRecordDto(created), { status: 201 });
}
