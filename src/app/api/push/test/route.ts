import { NextResponse } from "next/server";
import { pushConfigured, sendPush } from "@/lib/push";
import { runPushTick } from "@/lib/push-tick";

/** POST：发一条测试推送，并立刻跑一次检查（返回这次推了什么） */
export async function POST() {
  if (!pushConfigured()) return NextResponse.json({ ok: false, error: "没有配置 NTFY_TOPIC" }, { status: 400 });
  const test = await sendPush({ title: "✅ LifeOS 推送已连上", message: "以后计时到点、会议前 10 分钟、早上汇总、晚上复盘都会推到这里。", tags: ["white_check_mark"] });
  const tick = await runPushTick();
  return NextResponse.json({ ok: test.ok, error: test.error, tick });
}
