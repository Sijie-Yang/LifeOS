import { prisma } from "@/lib/prisma";
import { isHabitCheckInAllowedOnDate, syncProjectProgress } from "@/lib/reminders";
import { toDateString } from "@/lib/utils";
import { suggestHabitPower } from "@/lib/life-powers";
import { applyHabitScheduleSync } from "@/lib/habit-schedule-sync";
import { randomUUID } from "crypto";
import { addDays, format, subDays } from "date-fns";
import { describeOp, extractOpsJson, parseAlignOps, type AlignOp, type PlanPriority } from "@/lib/align-ops";
import { getWeekStart } from "@/lib/reminders";
import { parseRecordExtras, parseRecordNotes, recordKey, setRecordNote } from "@/lib/day-record";
import { normalizeMustDo, type MustDoItem } from "@/lib/accountability";
import { parsePriorities, serializePriorities, type WeeklyPriority } from "@/lib/weekly-plan";
import { sleepDurationHours } from "@/lib/sleep-window";

export const BOT_DIGEST_NOTE_TYPE = "bot-digest";
export function botDigestTitle(date: string): string {
  return `Bot 日报 · ${date}`;
}

/** 新优先级列表：同标题沿用旧 id / 完成状态 */
export function mergePriorities(prev: WeeklyPriority[], next: PlanPriority[]): WeeklyPriority[] {
  return next.map((p) => {
    const old = prev.find((o) => o.title === p.title);
    return {
      id: old?.id ?? randomUUID(),
      title: p.title,
      goalId: old?.goalId ?? null,
      projectId: p.projectId ?? old?.projectId ?? null,
      completed: p.completed ?? old?.completed ?? false,
    };
  });
}

/**
 * /api/plan/align POST 的核心逻辑，抽出来给 /api/plan/ingest（bot 日报）复用。
 * dryRun 默认 true：只返回 preview，不写库。
 */
export type AlignResult = { preview: string[]; errors: string[]; applied: number };

/** SQLite 被锁时（app 和脚本同时写）重试几次 */
export async function withSqliteRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const locked = /database is locked|SQLITE_BUSY|P1008|Socket timeout/i.test(msg);
      if (!locked || i >= tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 200 * 2 ** i));
    }
  }
}

function botTag(source: string | undefined): string[] {
  return source ? [`bot:${source}`] : [];
}

export async function runAlign(input: {
  date?: unknown;
  ops?: unknown;
  text?: unknown;
  dryRun?: unknown;
  /** 来源 bot（如 求职 / 学习 / Nick），写进新项目的 tags 和步骤 detail */
  source?: string;
}): Promise<AlignResult> {
  const date = typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : toDateString();
  const dryRun = input.dryRun !== false;
  const source = input.source;
  if (date > toDateString()) return { preview: [], errors: ["不能对齐未来的日期"], applied: 0 };

  let raw: unknown = input.ops;
  if (raw === undefined && typeof input.text === "string") {
    try {
      raw = extractOpsJson(input.text);
    } catch (e) {
      return { preview: [], errors: [`读不出 JSON：${e instanceof Error ? e.message : e}`], applied: 0 };
    }
  }
  const { ops, errors } = parseAlignOps(raw);

  // 校验 id 都存在
  const stepIds = ops.flatMap((o) =>
    "stepId" in o ? [o.stepId] : o.op === "record_note" && o.kind === "step" ? [o.id] : []
  );
  const habitIds = ops.flatMap((o) =>
    "habitId" in o
      ? [o.habitId]
      : o.op === "record_note" && o.kind === "habit"
        ? [o.id]
        : o.op === "set_must_do"
          ? o.items.flatMap((i) => (i.type === "habit" ? [i.id] : []))
          : []
  );
  const nestedProjectIds = ops.flatMap((o) =>
    o.op === "set_day_plan" || o.op === "set_week_plan"
      ? (o.priorities ?? []).flatMap((p) => (p.projectId ? [p.projectId] : []))
      : o.op === "create_task" && o.set.projectId
        ? [o.set.projectId]
        : []
  );
  const projectIds = [...ops.flatMap((o) => ("projectId" in o ? [o.projectId] : [])), ...nestedProjectIds];
  const taskIds = ops.flatMap((o) =>
    o.op === "complete_task"
      ? [o.taskId]
      : o.op === "record_note" && o.kind === "task"
        ? [o.id]
        : o.op === "set_must_do"
          ? o.items.flatMap((i) => (i.type === "task" ? [i.id] : []))
          : []
  );
  const taskContactIds = ops.flatMap((o) => (o.op === "create_task" && o.set.contactId ? [o.set.contactId] : []));
  const [steps, habits, projects] = await Promise.all([
    prisma.projectPlanStep.findMany({
      where: { id: { in: stepIds } },
      select: { id: true, title: true, done: true, projectId: true, project: { select: { name: true } } },
    }),
    prisma.habit.findMany({ where: { id: { in: habitIds } } }),
    prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true } }),
  ]);
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const habitMap = new Map(habits.map((h) => [h.id, h]));
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const dayBlocks = await prisma.dayScheduleBlock.findMany({
    where: { habitId: { in: habitIds }, date },
    select: { habitId: true, skipped: true },
  });
  const blockMap = new Map(dayBlocks.map((b) => [b.habitId, b]));

  // create_project / create_habit：按名字查重；分类、挂靠项目必须已存在（或同批新建）
  const newProjectNames = ops.flatMap((o) => (o.op === "create_project" ? [o.name] : []));
  const newHabitNames = ops.flatMap((o) => (o.op === "create_habit" ? [o.name] : []));
  const habitProjectNames = ops.flatMap((o) => (o.op === "create_habit" && o.projectName ? [o.projectName] : []));
  const categoryNames = ops.flatMap((o) => (o.op === "create_project" && o.category ? [o.category] : []));
  const [existingProjects, existingHabits, categories] = await Promise.all([
    prisma.project.findMany({
      where: { name: { in: [...newProjectNames, ...habitProjectNames] }, archiveDate: null },
      select: { id: true, name: true },
    }),
    prisma.habit.findMany({ where: { name: { in: newHabitNames } }, select: { id: true, name: true } }),
    prisma.projectCategory.findMany({ where: { name: { in: categoryNames } }, select: { id: true, name: true } }),
  ]);
  const projectByName = new Map(existingProjects.map((p) => [p.name, p.id]));
  const habitNames = new Set(existingHabits.map((h) => h.name));
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]));
  const batchProjects = new Set<string>();
  const batchHabits = new Set<string>();

  const contactIds = [...ops.flatMap((o) => ("contactId" in o ? [o.contactId] : [])), ...taskContactIds];
  const oppIds = ops.flatMap((o) => ("opportunityId" in o ? [o.opportunityId] : []));
  const contactCats = ops.flatMap((o) =>
    (o.op === "create_contact" || o.op === "update_contact") && o.set.category ? [o.set.category] : []
  );
  const [contacts, opps, contactCategories] = await Promise.all([
    prisma.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, name: true } }),
    prisma.opportunity.findMany({ where: { id: { in: oppIds } }, select: { id: true, title: true } }),
    prisma.contactCategory.findMany({ where: { name: { in: contactCats } }, select: { id: true, name: true } }),
  ]);
  const contactMap = new Map(contacts.map((c) => [c.id, c.name]));
  const oppMap = new Map(opps.map((o) => [o.id, o.title]));
  const contactCatByName = new Map(contactCategories.map((c) => [c.name, c.id]));
  const [tasks, dayLog] = await Promise.all([
    prisma.taskItem.findMany({ where: { id: { in: taskIds } }, select: { id: true, title: true, completed: true } }),
    prisma.dailyLog.findUnique({ where: { date }, select: { closedAt: true, recordExtras: true } }),
  ]);
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const extraTitles = new Set(parseRecordExtras(dayLog?.recordExtras).map((e) => e.title));

  const valid: AlignOp[] = [];
  for (const op of ops) {
    // 日计划 / 关账 / 任务 / 周复盘
    if (op.op === "set_day_plan" || op.op === "set_week_plan" || op.op === "create_task") {
      const missing = (op.op === "create_task" ? [op.set.projectId] : (op.priorities ?? []).map((p) => p.projectId))
        .filter((id): id is string => Boolean(id) && !projectMap.has(id!));
      if (missing.length) { errors.push(`没有这个项目：${missing.join(", ")}`); continue; }
      if (op.op === "create_task" && op.set.contactId && !contactMap.has(op.set.contactId)) {
        errors.push(`没有这个联系人：${op.set.contactId}`); continue;
      }
      valid.push(op);
      continue;
    }
    if (op.op === "set_must_do") {
      const bad = op.items.filter((i) => (i.type === "habit" && !habitMap.has(i.id)) || (i.type === "task" && !taskMap.has(i.id)));
      if (bad.length) { errors.push(`必做项对不上：${bad.map((i) => ("id" in i ? `${i.type}:${i.id}` : i.title)).join(", ")}`); continue; }
      valid.push(op);
      continue;
    }
    if (op.op === "record_note") {
      const ok = op.kind === "step" ? stepMap.has(op.id) : op.kind === "habit" ? habitMap.has(op.id) : taskMap.has(op.id);
      if (!ok) { errors.push(`批注对不上：${op.kind}:${op.id}`); continue; }
      valid.push(op);
      continue;
    }
    if (op.op === "complete_task") {
      const t = taskMap.get(op.taskId);
      if (!t) errors.push(`没有这个任务：${op.taskId}`);
      else if (t.completed) errors.push(`任务已完成：${t.title}`);
      else valid.push(op);
      continue;
    }
    if (op.op === "add_extra") {
      if (extraTitles.has(op.title)) errors.push(`计划外事项已记过：${op.title}`);
      else { extraTitles.add(op.title); valid.push(op); }
      continue;
    }
    if (op.op === "close_day" || op.op === "update_day_log" || op.op === "set_week_review" || op.op === "save_bot_digest") {
      valid.push(op);
      continue;
    }
    if ("contactId" in op && !contactMap.has(op.contactId)) { errors.push(`没有这个联系人：${op.contactId}`); continue; }
    if ("opportunityId" in op && !oppMap.has(op.opportunityId)) { errors.push(`没有这个机会：${op.opportunityId}`); continue; }
    if ((op.op === "create_contact" || op.op === "update_contact") && op.set.category && !contactCatByName.has(op.set.category)) {
      errors.push(`没有这个联系人圈子：${op.set.category}`); continue;
    }
    if (op.op === "create_project") {
      if (projectByName.has(op.name) || batchProjects.has(op.name)) errors.push(`项目已存在：${op.name}`);
      else if (op.category && !categoryByName.has(op.category)) errors.push(`没有这个分类：${op.category}（不会自动新建分类）`);
      else {
        batchProjects.add(op.name);
        valid.push(op);
      }
      continue;
    }
    if (op.op === "create_habit") {
      if (habitNames.has(op.name) || batchHabits.has(op.name)) errors.push(`习惯已存在：${op.name}`);
      else if (op.projectName && !projectByName.has(op.projectName) && !batchProjects.has(op.projectName)) {
        errors.push(`习惯要挂的项目不存在：${op.projectName}`);
      } else {
        batchHabits.add(op.name);
        valid.push(op);
      }
      continue;
    }
    if ("stepId" in op && !stepMap.has(op.stepId)) errors.push(`没有这个步骤：${op.stepId}`);
    else if (op.op === "uncomplete_step" && !stepMap.get(op.stepId)!.done) errors.push(`步骤本来就没完成：${stepMap.get(op.stepId)!.title}`);
    else if (op.op === "remove_step" && stepMap.get(op.stepId)!.done) {
      errors.push(`已完成的步骤不能删（先 uncomplete_step）：${stepMap.get(op.stepId)!.title}`);
    }
    else if ((op.op === "uncheck_habit" || op.op === "set_habit_power") && !habitMap.has(op.habitId)) {
      errors.push(`没有这个习惯：${op.habitId}`);
    }
    else if (op.op === "check_habit" && !habitMap.has(op.habitId)) errors.push(`没有这个习惯：${op.habitId}`);
    else if (op.op === "check_habit" && !habitMap.get(op.habitId)!.isActive) errors.push(`习惯已暂停：${habitMap.get(op.habitId)!.name}`);
    else if (
      op.op === "check_habit" &&
      !isHabitCheckInAllowedOnDate(habitMap.get(op.habitId)!, date, blockMap.get(op.habitId) ?? null)
    ) {
      errors.push(`${date} 不是「${habitMap.get(op.habitId)!.name}」的执行日`);
    }
    else if ("projectId" in op && !projectMap.has(op.projectId)) errors.push(`没有这个项目：${op.projectId}`);
    else valid.push(op);
  }

  const names = {
    step: (id: string) => {
      const s = stepMap.get(id);
      return s ? `${s.project.name} · ${s.title}${s.done ? "（已完成）" : ""}` : null;
    },
    project: (id: string) => projectMap.get(id)?.name ?? null,
    habit: (id: string) => habitMap.get(id)?.name ?? null,
    contact: (id: string) => contactMap.get(id) ?? null,
    opportunity: (id: string) => oppMap.get(id) ?? null,
    task: (id: string) => taskMap.get(id)?.title ?? null,
  };
  const preview = valid.map((op) => {
    const reclose = op.op === "close_day" && dayLog?.closedAt ? `（已于 ${format(dayLog.closedAt, "HH:mm")} 关过，将重新关账）` : "";
    return `${source ? `[${source}] ` : ""}${describeOp(op, names)}${reclose}`;
  });
  if (dryRun) return ({ preview, errors, applied: 0 });

  // 先建项目，再建习惯（习惯可挂同批新项目），最后其余操作
  const order = (o: AlignOp) => (o.op === "create_project" ? 0 : o.op === "create_habit" ? 1 : 2);
  const sorted = [...valid].sort((a, b) => order(a) - order(b));
  const touched = new Set<string>();
  for (const op of sorted) await withSqliteRetry(() => applyOne(op));
  for (const id of touched) await withSqliteRetry(() => syncProjectProgress(prisma, id));
  return { preview, errors, applied: valid.length };

  async function applyOne(op: AlignOp): Promise<void> {
    switch (op.op) {
      case "create_project": {
        const maxSort = await prisma.project.aggregate({ _max: { sortOrder: true } });
        // 注意：故意不写 description
        const created = await prisma.project.create({
          data: {
            name: op.name,
            categoryId: op.category ? categoryByName.get(op.category)! : null,
            power: op.power ?? null,
            planActive: op.planActive ?? false,
            planWorkdays: JSON.stringify(op.workdays ?? [1, 2, 3, 4, 5]),
            tags: JSON.stringify([...new Set([...(op.tags ?? []), ...botTag(source)])]),
            sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
          },
          select: { id: true },
        });
        projectByName.set(op.name, created.id);
        break;
      }
      case "update_project": {
        const { workdays, tags, targetDate, ...rest } = op.set;
        await prisma.project.update({
          where: { id: op.projectId },
          data: {
            ...rest, // 白名单里没有 description
            ...(workdays ? { planWorkdays: JSON.stringify(workdays) } : {}),
            ...(tags ? { tags: JSON.stringify(tags) } : {}),
            ...(targetDate !== undefined ? { targetDate: targetDate ? new Date(targetDate) : null } : {}),
          },
        });
        break;
      }
      case "create_contact":
      case "update_contact": {
        const { tags, category, lastContactAt, ...rest } = op.set;
        const data = {
          ...rest,
          ...(category !== undefined ? { categoryId: category ? contactCatByName.get(category)! : null } : {}),
          ...(lastContactAt !== undefined ? { lastContactAt: lastContactAt ? new Date(lastContactAt) : null } : {}),
        };
        if (op.op === "create_contact") {
          await prisma.contact.create({
            data: { ...data, name: op.set.name, tags: JSON.stringify([...new Set([...(tags ?? []), ...botTag(source)])]) },
          });
        } else {
          await prisma.contact.update({ where: { id: op.contactId }, data: { ...data, ...(tags ? { tags: JSON.stringify(tags) } : {}) } });
        }
        break;
      }
      case "log_contact": {
        const at = new Date(`${date}T12:00:00`);
        await prisma.contactLog.create({
          data: {
            contactId: op.contactId,
            type: op.type ?? "message",
            content: [source ? `[bot:${source}]` : null, op.content ?? null].filter(Boolean).join(" ") || null,
            contactedAt: at,
          },
        });
        await prisma.contact.update({ where: { id: op.contactId }, data: { lastContactAt: at } });
        break;
      }
      case "create_opportunity":
        await prisma.opportunity.create({
          data: { ...op.set, title: op.set.title, ...(source && !op.set.source ? { source: `bot:${source}` } : {}) },
        });
        break;
      case "update_opportunity":
        await prisma.opportunity.update({ where: { id: op.opportunityId }, data: op.set });
        break;
      case "create_habit": {
        const maxSort = await prisma.habit.aggregate({ _max: { sortOrder: true } });
        const habit = await prisma.habit.create({
          data: {
            name: op.name,
            projectId: op.projectName ? projectByName.get(op.projectName) ?? null : null,
            power: op.power ?? suggestHabitPower(op.name),
            frequency: "DAILY",
            scheduleMode: "none",
            daysOfWeek: JSON.stringify(op.schedule === "weekly" && op.daysOfWeek ? op.daysOfWeek : [1, 2, 3, 4, 5, 6, 0]),
            startTime: null,
            endTime: null,
            minimumVersion: op.minimumVersion ?? null,
            cue: op.cue ?? null,
            isActive: true,
            sortOrder: maxSort._max.sortOrder == null ? 0 : maxSort._max.sortOrder + 1,
          },
          select: { id: true, scheduleMode: true },
        });
        await applyHabitScheduleSync(prisma, habit.id, habit.scheduleMode);
        break;
      }
      case "complete_step": {
        const step = stepMap.get(op.stepId)!;
        await prisma.projectPlanStep.update({
          where: { id: op.stepId },
          data: { done: true, doneDate: date, ...(op.note ? { feedback: op.note } : {}) },
        });
        touched.add(step.projectId);
        break;
      }
      case "log_work":
      case "add_step": {
        const done = op.op === "log_work";
        // 补记排在最前（按完成日期落位）；新待办排在队尾（自动排程）
        const edge = await prisma.projectPlanStep.findFirst({
          where: { projectId: op.projectId },
          orderBy: { sortOrder: done ? "asc" : "desc" },
          select: { sortOrder: true },
        });
        await prisma.projectPlanStep.create({
          data: {
            projectId: op.projectId,
            title: op.title,
            detail: op.op === "log_work" ? `补记 · ${source ? `bot:${source}` : "LLM 对齐"}` : (op.detail ?? null),
            feedback: op.op === "log_work" ? (op.note ?? null) : null,
            sortOrder: (edge?.sortOrder ?? 0) + (done ? -1 : 1),
            done,
            doneDate: done ? date : null,
          },
        });
        touched.add(op.projectId);
        break;
      }
      case "check_habit":
        await prisma.habitCheckIn.upsert({
          where: { habitId_date: { habitId: op.habitId, date } },
          create: { habitId: op.habitId, date, completed: true, level: op.level ?? "full" },
          update: { completed: true, level: op.level ?? "full" },
        });
        break;
      case "uncomplete_step":
        await prisma.projectPlanStep.update({ where: { id: op.stepId }, data: { done: false, doneDate: null } });
        touched.add(stepMap.get(op.stepId)!.projectId);
        break;
      case "remove_step":
        await prisma.projectPlanStep.delete({ where: { id: op.stepId } });
        touched.add(stepMap.get(op.stepId)!.projectId);
        break;
      case "uncheck_habit":
        await prisma.habitCheckIn.deleteMany({ where: { habitId: op.habitId, date } });
        break;
      case "set_day_score":
        await prisma.dailyLog.upsert({
          where: { date },
          create: { date, planScore: op.score, planScoreNote: op.note ?? null },
          update: { planScore: op.score, planScoreNote: op.note ?? null },
        });
        break;
      case "set_day_plan": {
        const prev = await prisma.dailyPlan.findUnique({ where: { date } });
        const data = {
          ...(op.intention !== undefined ? { intention: op.intention } : {}),
          ...(op.priorities ? { priorities: serializePriorities(mergePriorities(parsePriorities(prev?.priorities), op.priorities)) } : {}),
        };
        await prisma.dailyPlan.upsert({ where: { date }, create: { date, ...data }, update: data });
        break;
      }
      case "set_week_plan": {
        const weekStart = op.weekStart ?? getWeekStart(new Date(`${date}T12:00:00`));
        const prev = await prisma.weeklyPlan.findUnique({ where: { weekStart } });
        const data = {
          ...(op.intention !== undefined ? { intention: op.intention } : {}),
          ...(op.priorities ? { priorities: serializePriorities(mergePriorities(parsePriorities(prev?.priorities), op.priorities)) } : {}),
        };
        await prisma.weeklyPlan.upsert({ where: { weekStart }, create: { weekStart, ...data }, update: data });
        break;
      }
      case "set_week_review": {
        const weekStart = op.weekStart ?? getWeekStart(new Date(`${date}T12:00:00`));
        await prisma.weeklyReview.upsert({ where: { weekStart }, create: { weekStart, ...op.set }, update: op.set });
        break;
      }
      case "set_must_do": {
        const items: MustDoItem[] = op.items.map((i) =>
          i.type === "priority" ? { type: "priority", id: randomUUID(), title: i.title, done: i.done ?? false } : i
        );
        const mustDo = JSON.stringify(normalizeMustDo(items));
        await prisma.dailyLog.upsert({ where: { date }, create: { date, mustDo }, update: { mustDo } });
        break;
      }
      case "update_day_log": {
        const data: Record<string, unknown> = { ...op.set };
        // 和 /api/daily-log 一致：起床时间 + 昨晚就寝 → 今天睡眠时长；就寝时间 → 明早睡眠时长
        if (op.set.wakeTime) {
          const prevNight = await prisma.dailyLog.findUnique({
            where: { date: format(subDays(new Date(`${date}T12:00:00`), 1), "yyyy-MM-dd") },
            select: { sleepTime: true },
          });
          const hours = sleepDurationHours(prevNight?.sleepTime ?? null, op.set.wakeTime);
          if (hours != null) data.sleepHours = hours;
        }
        await prisma.dailyLog.upsert({ where: { date }, create: { date, ...data }, update: data });
        if (op.set.sleepTime) {
          const next = format(addDays(new Date(`${date}T12:00:00`), 1), "yyyy-MM-dd");
          const nextMorning = await prisma.dailyLog.findUnique({ where: { date: next }, select: { wakeTime: true } });
          const hours = sleepDurationHours(op.set.sleepTime, nextMorning?.wakeTime ?? null);
          if (hours != null && nextMorning) await prisma.dailyLog.update({ where: { date: next }, data: { sleepHours: hours } });
        }
        break;
      }
      case "record_note": {
        const cur = await prisma.dailyLog.findUnique({ where: { date }, select: { recordNotes: true } });
        const recordNotes = JSON.stringify(setRecordNote(parseRecordNotes(cur?.recordNotes), recordKey(op.kind, op.id), op.text));
        await prisma.dailyLog.upsert({ where: { date }, create: { date, recordNotes }, update: { recordNotes } });
        break;
      }
      case "add_extra": {
        const cur = await prisma.dailyLog.findUnique({ where: { date }, select: { recordExtras: true } });
        const list = parseRecordExtras(cur?.recordExtras);
        if (!list.some((e) => e.title === op.title)) list.push({ id: randomUUID(), title: op.title });
        const recordExtras = JSON.stringify(list);
        await prisma.dailyLog.upsert({ where: { date }, create: { date, recordExtras }, update: { recordExtras } });
        break;
      }
      case "close_day": {
        const cur = await prisma.dailyLog.findUnique({ where: { date }, select: { reflection: true, closeNote: true } });
        const closeNote = op.note ?? cur?.reflection ?? cur?.closeNote ?? null;
        const data = {
          closedAt: new Date(),
          closeNote,
          ...(op.note && !cur?.reflection ? { reflection: op.note } : {}),
        };
        await prisma.dailyLog.upsert({ where: { date }, create: { date, ...data }, update: data });
        break;
      }
      case "create_task": {
        const { title, ...rest } = op.set;
        await prisma.taskItem.create({
          data: { title, ...rest, scheduledDate: rest.scheduledDate ?? null, source: source ? `bot:${source}` : "align" },
        });
        break;
      }
      case "complete_task":
        await prisma.taskItem.update({ where: { id: op.taskId }, data: { completed: true, completedAt: new Date() } });
        break;
      case "save_bot_digest": {
        const title = botDigestTitle(date);
        const existing = await prisma.note.findFirst({ where: { title, type: BOT_DIGEST_NOTE_TYPE }, select: { id: true } });
        const note = existing
          ? await prisma.note.update({ where: { id: existing.id }, data: { content: op.content }, select: { id: true } })
          : await prisma.note.create({ data: { title, type: BOT_DIGEST_NOTE_TYPE, content: op.content }, select: { id: true } });
        // 当天日志没挂笔记时挂上，方便在日页面找到
        const log = await prisma.dailyLog.findUnique({ where: { date }, select: { noteId: true } });
        if (!log) await prisma.dailyLog.create({ data: { date, noteId: note.id } });
        else if (!log.noteId) await prisma.dailyLog.update({ where: { date }, data: { noteId: note.id } });
        break;
      }
      case "set_habit_power":
        await prisma.habit.update({ where: { id: op.habitId }, data: { power: op.power } });
        break;
      case "set_rhythm":
        await prisma.project.update({ where: { id: op.projectId }, data: { planWorkdays: JSON.stringify(op.workdays) } });
        break;
      case "pause_project":
      case "resume_project":
        await prisma.project.update({ where: { id: op.projectId }, data: { planActive: op.op === "resume_project" } });
        break;
      case "set_power":
        await prisma.project.update({ where: { id: op.projectId }, data: { power: op.power } });
        break;
    }
  }
}
