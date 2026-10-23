import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { exportFullBackup, restoreFromBackup } from "@/lib/backup-restore";
import { validateFullBackup } from "@/lib/backup-format";

export async function GET() {
  const data = await exportFullBackup();
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="lifeos-backup-${format(new Date(), "yyyy-MM-dd")}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  let body;
  try { body = validateFullBackup(await request.json()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "无效备份" }, { status: 400 }); }
  try {
    await restoreFromBackup(body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "恢复失败，事务已回滚。请检查备份版本和关联数据；原数据保持不变。" }, { status: 409 });
  }
}
