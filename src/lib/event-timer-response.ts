import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { TimerError } from "./event-timer-service";

export function timerErrorResponse(error: unknown) {
  if (error instanceof TimerError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
    return NextResponse.json({ error: "事件计时表不存在，请先备份数据库，再运行 npx prisma migrate deploy" }, { status: 503 });
  }
  return NextResponse.json({ error: "计时保存或加载失败，请重试；已有计时记录仍保留。" }, { status: 500 });
}
