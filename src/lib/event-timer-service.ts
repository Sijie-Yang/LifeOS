import { Prisma, type EventTimer, type PrismaClient } from "@prisma/client";
import { effectiveTimerStatus, timerSegments, type EventTimerDto } from "./event-timers";
import { timeFillCategory, type TimeFillCategoryId } from "./time-fills";

export class TimerError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function timerDto(row: EventTimer): EventTimerDto {
  let segments: EventTimerDto["segments"] = [];
  try {
    const raw: unknown = JSON.parse(row.segments);
    if (Array.isArray(raw)) segments = raw.filter((s) => s && typeof s.start === "string" && typeof s.end === "string");
  } catch { /* preserve the record, but do not allocate invalid intervals */ }
  return { ...row, category: row.category as TimeFillCategoryId, mode: row.mode as EventTimerDto["mode"],
    status: row.status as EventTimerDto["status"], startedAt: row.startedAt.toISOString(), runningSince: row.runningSince?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null, segments };
}

type Source = { title: string; href: string; projectName: string | null };
async function resolveSource(tx: Prisma.TransactionClient, eventId: string): Promise<Source> {
  const [kind, id, date, extra] = eventId.split(":");
  if (!id || extra || (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) throw new TimerError("无效事件");
  const project = { select: { name: true } } as const;
  let source: Source | null = null;
  if (kind === "routine" || kind === "focus") {
    const row = await tx.habit.findUnique({ where: { id }, include: { project } });
    if (row) source = { title: row.name, href: "/habits", projectName: row.project?.name ?? null };
  } else if (kind === "task") {
    const row = await tx.taskItem.findUnique({ where: { id }, include: { project } });
    if (row) source = { title: row.title, href: "/tasks", projectName: row.project?.name ?? null };
  } else if (kind === "step") {
    const row = await tx.projectPlanStep.findUnique({ where: { id }, include: { project } });
    if (row) source = { title: row.title, href: `/projects?id=${row.projectId}`, projectName: row.project.name };
  } else if (kind === "meeting") {
    const row = await tx.meeting.findUnique({ where: { id }, include: { project } });
    if (row) source = { title: row.title, href: `/meetings?id=${id}`, projectName: row.project?.name ?? null };
  } else if (kind === "contact") {
    const row = await tx.contactLog.findUnique({ where: { id }, include: { contact: true } });
    if (row) source = { title: `联系 · ${row.contact.name}`, href: `/contacts?id=${row.contactId}`, projectName: null };
  } else if (kind === "sop") {
    const row = await tx.checklistRun.findUnique({ where: { id }, include: { project } });
    if (row) source = { title: row.title, href: `/checklists?run=${id}`, projectName: row.project?.name ?? null };
  } else if (kind === "block") {
    const row = await tx.dayScheduleBlock.findUnique({ where: { id }, include: { task: { include: { project } }, habit: { include: { project } } } });
    if (row) source = { title: row.title, href: `/timeline?scale=day&date=${row.date}`, projectName: row.task?.project?.name ?? row.habit?.project?.name ?? null };
  }
  if (!source) throw new TimerError("事件不存在，刷新事件流后重试", 404);
  return source;
}

function freeSource(title: unknown): Source {
  const t = typeof title === "string" ? title.trim() : "";
  if (!t || t.length > 80) throw new TimerError("请写一个 1–80 字的事件名");
  return { title: t, href: "/stream", projectName: null };
}

function completedData(timer: EventTimerDto, now: number) {
  const segments = timerSegments(timer, now);
  const endedAt = effectiveTimerStatus(timer, now) === "completed" && segments.length ? new Date(segments.at(-1)!.end) : new Date(now);
  return { status: "completed", activeKey: null, runningSince: null, segments: JSON.stringify(segments), endedAt };
}

export async function startEventTimer(client: PrismaClient, input: unknown, now = Date.now()): Promise<EventTimerDto> {
  if (!input || typeof input !== "object") throw new TimerError("无效请求");
  const body = input as Record<string, unknown>;
  if (typeof body.eventId !== "string" || body.eventId.length > 250 || typeof body.requestId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(body.requestId)) throw new TimerError("事件或请求标识无效");
  if (body.mode !== "fixed" && body.mode !== "free") throw new TimerError("请选择定时或自由计时");
  if (!timeFillCategory(typeof body.category === "string" ? body.category : null)) throw new TimerError("请选择时间分类");
  if (typeof body.autoAllocate !== "boolean") throw new TimerError("请选择是否自动分配时间块");
  const seconds = body.mode === "fixed" ? Number(body.minutes) * 60 : null;
  if (seconds !== null && (!Number.isInteger(seconds) || seconds < 60 || seconds > 240 * 60)) throw new TimerError("定时时长为 1–240 分钟");
  const eventId = body.eventId, id = body.requestId;
  try {
    return await client.$transaction(async (tx) => {
      const replay = await tx.eventTimer.findUnique({ where: { id } });
      if (replay) {
        if (replay.eventId !== eventId) throw new TimerError("请求标识已用于其他事件", 409);
        return timerDto(replay);
      }
      // 自由计时：不挂任何事件（「洗衣服 45 分钟」），标题由用户给
      const source = eventId.startsWith("free:") ? freeSource(body.title) : await resolveSource(tx, eventId);
      const active = await tx.eventTimer.findUnique({ where: { activeKey: eventId } });
      if (active) {
        const timer = timerDto(active);
        if (effectiveTimerStatus(timer, now) !== "completed") return timer;
        await tx.eventTimer.update({ where: { id: active.id }, data: completedData(timer, now) });
      }
      return timerDto(await tx.eventTimer.create({ data: {
        id, eventId, eventKind: eventId.split(":")[0], ...source, category: body.category as string,
        autoAllocate: body.autoAllocate as boolean, mode: body.mode as string, durationSeconds: seconds,
        startedAt: new Date(now), runningSince: new Date(now), activeKey: eventId,
      } }));
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await client.eventTimer.findUnique({ where: { activeKey: eventId } });
      if (existing) return timerDto(existing);
    }
    throw error;
  }
}

/** 补记一件已经发生的事（「10:00–10:30 吃面」）：直接存成一条已完成的自由计时，进事件流的「临时」 */
export async function recordEventTimer(client: PrismaClient, input: unknown): Promise<EventTimerDto> {
  if (!input || typeof input !== "object") throw new TimerError("无效请求");
  const body = input as Record<string, unknown>;
  const source = freeSource(body.title);
  const start = new Date(String(body.start ?? ""));
  const end = new Date(String(body.end ?? ""));
  if (Number.isNaN(+start) || Number.isNaN(+end) || end < start) throw new TimerError("开始 / 结束时间无效");
  if (+end - +start > 16 * 3600_000) throw new TimerError("一条最长 16 小时");
  if (!timeFillCategory(typeof body.category === "string" ? body.category : null)) throw new TimerError("请选择时间分类");
  const id = crypto.randomUUID();
  const projectName = typeof body.projectName === "string" && body.projectName.trim() ? body.projectName.trim() : null;
  return timerDto(await client.eventTimer.create({ data: {
    id, eventId: `free:${id}`, eventKind: "free", ...source, projectName, category: body.category as string,
    autoAllocate: body.autoAllocate !== false, mode: "free", durationSeconds: null, status: "completed",
    startedAt: start, endedAt: end, activeKey: null, runningSince: null,
    segments: JSON.stringify(+end > +start ? [{ start: start.toISOString(), end: end.toISOString() }] : []),
  } }));
}

export async function updateEventTimer(client: PrismaClient, id: string, input: unknown, now = Date.now()): Promise<EventTimerDto> {
  if (!input || typeof input !== "object") throw new TimerError("无效请求");
  const body = input as Record<string, unknown>;
  if (!["pause", "resume", "stop", "cancel", "settings"].includes(body.action as string)) throw new TimerError("无效计时操作");
  return client.$transaction(async (tx) => {
    const row = await tx.eventTimer.findUnique({ where: { id } });
    if (!row) throw new TimerError("计时记录不存在", 404);
    const timer = timerDto(row);
    if (body.action === "settings") {
      if (body.category !== undefined && !timeFillCategory(typeof body.category === "string" ? body.category : null)) throw new TimerError("无效分类");
      if (body.autoAllocate !== undefined && typeof body.autoAllocate !== "boolean") throw new TimerError("无效自动分配设置");
      return timerDto(await tx.eventTimer.update({ where: { id }, data: {
        ...(typeof body.category === "string" ? { category: body.category } : {}),
        ...(typeof body.autoAllocate === "boolean" ? { autoAllocate: body.autoAllocate } : {}),
      } }));
    }
    if (timer.status === "completed" || timer.status === "cancelled") return timer;
    if (effectiveTimerStatus(timer, now) === "completed") return timerDto(await tx.eventTimer.update({ where: { id }, data: completedData(timer, now) }));
    if (body.action === "pause") {
      if (timer.status === "paused") return timer;
      return timerDto(await tx.eventTimer.update({ where: { id }, data: { status: "paused", runningSince: null, segments: JSON.stringify(timerSegments(timer, now)) } }));
    }
    if (body.action === "resume") {
      if (timer.status === "running") return timer;
      return timerDto(await tx.eventTimer.update({ where: { id }, data: { status: "running", runningSince: new Date(now) } }));
    }
    return timerDto(await tx.eventTimer.update({ where: { id }, data: {
      ...completedData(timer, now), ...(body.action === "cancel" ? { status: "cancelled" } : {}),
    } }));
  });
}
