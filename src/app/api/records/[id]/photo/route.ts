import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveRecordPhoto } from "@/lib/life-records";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const row = await prisma.lifeRecord.findUnique({ where: { id } });
  if (!row?.photoPath) {
    return NextResponse.json({ error: "无照片" }, { status: 404 });
  }

  try {
    const abs = resolveRecordPhoto(row.photoPath);
    if (!fs.existsSync(abs)) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }
    const buf = fs.readFileSync(abs);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": row.photoMime || "image/jpeg",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "读取失败" }, { status: 500 });
  }
}
