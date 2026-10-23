import {
  HABIT_POWER_BASE,
  LIFE_POWERS,
  LIFE_POWER_META,
  isHabitPowerValue,
  isLifePowerKey,
  type HabitPowerValue,
  type LifePowerKey,
} from "@/lib/life-powers";
import { parsePlanScore } from "@/lib/day-record";
import { parseClockTime, parseWellnessScore } from "@/lib/wellness-scores";

/**
 * 对齐在和 Claude 的对话里完成：/api/plan/align 给出上下文 + prompt，Claude 产出一组 JSON 操作，
 * 先预览、确认后应用。顺延不需要操作：没做完的步骤会自动排到下一个工作日。
 * - daily：记录今天做了什么
 * - projects：开工时逐项目对齐（约 15 分钟）
 */
export type AlignMode = "daily" | "projects";

export type AlignOp =
  /** 把一个已有步骤记为今天完成 */
  | { op: "complete_step"; stepId: string; note?: string }
  /** 计划外的工作：在项目下新建一条今天已完成的步骤 */
  | { op: "log_work"; projectId: string; title: string; note?: string }
  /** 习惯打卡 */
  | { op: "check_habit"; habitId: string; level?: "full" | "minimum" }
  /** 项目哪几天推进（0=周日 … 6=周六） */
  | { op: "set_rhythm"; projectId: string; workdays: number[] }
  /** 暂停 / 恢复排程 */
  | { op: "pause_project"; projectId: string }
  | { op: "resume_project"; projectId: string }
  /** 项目归哪一力（null = 不进九力） */
  | { op: "set_power"; projectId: string; power: LifePowerKey | null }
  /** 给项目追加一个待办步骤（排到队尾，自动排程） */
  | { op: "add_step"; projectId: string; title: string; detail?: string }
  /** 撤销：把已完成的步骤改回未完成（重新进入自动排程） */
  | { op: "uncomplete_step"; stepId: string }
  /** 撤销：取消当天的习惯打卡 */
  | { op: "uncheck_habit"; habitId: string }
  /** 删掉一个不再需要的待办步骤（已完成的不能删） */
  | { op: "remove_step"; stepId: string }
  /** 复盘：当天计划完成度 0–100 + 理由 / 审查结论 / 明天的改进 */
  | { op: "set_day_score"; score: number; note?: string }
  /** 习惯锁定到哪一力（base = 生活底盘） */
  | { op: "set_habit_power"; habitId: string; power: HabitPowerValue }
  /** 新建项目（bot 集成）。不写 description；同名未归档项目已存在则报错 */
  | {
      op: "create_project";
      name: string;
      category?: string;
      power?: LifePowerKey | null;
      planActive?: boolean;
      workdays?: number[];
      tags?: string[];
    }
  /** 新建习惯（bot 集成）。schedule=anytime 不排时段，任何时间可打卡 */
  | {
      op: "create_habit";
      name: string;
      schedule?: "anytime" | "weekly";
      daysOfWeek?: number[];
      projectName?: string;
      power?: HabitPowerValue;
      minimumVersion?: string;
      cue?: string;
    }
  /** 改项目字段（白名单；永不写 description） */
  | { op: "update_project"; projectId: string; set: ProjectPatch }
  /** 人脉 */
  | { op: "create_contact"; set: ContactPatch & { name: string } }
  | { op: "update_contact"; contactId: string; set: ContactPatch }
  | { op: "log_contact"; contactId: string; type?: string; content?: string }
  /** 机会 / 求职 */
  | { op: "create_opportunity"; set: OpportunityPatch & { title: string } }
  | { op: "update_opportunity"; opportunityId: string; set: OpportunityPatch }
  /** 早上计划：今日意图 + ≤3 个优先级（覆盖当天 DailyPlan；同标题保留原 id 和完成状态） */
  | { op: "set_day_plan"; intention?: string | null; priorities?: PlanPriority[] }
  /** 今日必做（≤3，覆盖）：habit / task 用 id，自由文本用 priority */
  | { op: "set_must_do"; items: MustDoInput[] }
  /** 当天日志字段（白名单）：反思、精力 / 内耗、作息、运动、身体 */
  | { op: "update_day_log"; set: DayLogPatch }
  /** 记录段批注：做了的写多做了什么，没做的写原因（空字符串 = 删） */
  | { op: "record_note"; kind: "step" | "task" | "habit"; id: string; text: string }
  /** 记录段：计划外多做的、不挂项目的事（挂项目的用 log_work） */
  | { op: "add_extra"; title: string }
  /** 关账：closedAt = 现在；note 写 closeNote（反思为空时也写进反思） */
  | { op: "close_day"; note?: string }
  /** 任务（TaskItem） */
  | { op: "create_task"; set: TaskPatch & { title: string } }
  | { op: "complete_task"; taskId: string }
  /** 周计划 / 周复盘（weekStart = 周一，不给按对齐日推） */
  | { op: "set_week_plan"; weekStart?: string; intention?: string | null; priorities?: PlanPriority[] }
  | { op: "set_week_review"; weekStart?: string; set: WeekReviewPatch }
  /** bot 日报存档：一天一条 Note「Bot 日报 · <date>」（ingest 自动生成，覆盖） */
  | { op: "save_bot_digest"; content: string };

export type PlanPriority = { title: string; projectId?: string | null; completed?: boolean };
export type MustDoInput = { type: "habit" | "task"; id: string } | { type: "priority"; title: string; done?: boolean };
export type DayLogPatch = Partial<{
  reflection: string | null; energyMorning: number | null; drainMorning: number | null; urgeMorning: number | null;
  energyEvening: number | null; drainEvening: number | null; wakeTime: string | null; plannedSleepTime: string | null;
  sleepTime: string | null; weightKg: number | null; waistCm: number | null; exerciseStartTime: string | null;
  exerciseMinutes: number | null; exerciseCalories: number | null; bodyNote: string | null;
}>;
export type TaskPatch = Partial<{
  title: string; dueDate: string | null; scheduledDate: string | null; priority: string;
  projectId: string | null; contactId: string | null; emailRemind: boolean;
}>;
export type WeekReviewPatch = Partial<{ wins: string | null; improvements: string | null; nextFocus: string | null }>;

export type ProjectPatch = Partial<{
  name: string; status: string; priority: string; tags: string[]; power: LifePowerKey | null;
  planActive: boolean; workdays: number[]; pinned: boolean; targetDate: string | null; wishFinishTime: string | null;
}>;
export type ContactPatch = Partial<{
  name: string; email: string | null; phone: string | null; company: string | null; position: string | null;
  institution: string | null; city: string | null; notes: string | null; tags: string[]; importance: number;
  contactFrequencyDays: number; responseLevel: number | null; category: string | null; lastContactAt: string | null;
}>;
export type OpportunityPatch = Partial<{
  title: string; lane: "career" | "life"; category: string; status: string; priority: string;
  deadline: string | null; source: string | null; nextAction: string | null; notes: string | null; projectId: string | null;
}>;

export const PROJECT_STATUSES = ["IDEA", "PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
export const OPPORTUNITY_STATUSES = ["Watching", "Active", "Passed", "Won", "Archived"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

type FieldSpec =
  | "str" | "nstr" | "tags" | "bool" | "days" | "int" | "nint" | "date" | "power"
  /** 1–5 打分 / HH:mm / 数字 / YYYY-MM-DD，均可 null */
  | "score" | "clock" | "num" | "day"
  | readonly string[];
const PROJECT_FIELDS: Record<string, FieldSpec> = {
  name: "str", status: PROJECT_STATUSES, priority: PRIORITIES, tags: "tags", power: "power",
  planActive: "bool", workdays: "days", pinned: "bool", targetDate: "date", wishFinishTime: "nstr",
};
const CONTACT_FIELDS: Record<string, FieldSpec> = {
  name: "str", email: "nstr", phone: "nstr", company: "nstr", position: "nstr", institution: "nstr", city: "nstr",
  notes: "nstr", tags: "tags", importance: "int", contactFrequencyDays: "int", responseLevel: "nint",
  category: "nstr", lastContactAt: "date",
};
const DAY_LOG_FIELDS: Record<string, FieldSpec> = {
  reflection: "nstr", energyMorning: "score", drainMorning: "score", urgeMorning: "score",
  energyEvening: "score", drainEvening: "score", wakeTime: "clock", plannedSleepTime: "clock", sleepTime: "clock",
  weightKg: "num", waistCm: "num", exerciseStartTime: "clock", exerciseMinutes: "nint", exerciseCalories: "nint",
  bodyNote: "nstr",
};
const TASK_FIELDS: Record<string, FieldSpec> = {
  title: "str", dueDate: "day", scheduledDate: "day", priority: PRIORITIES, projectId: "nstr", contactId: "nstr",
  emailRemind: "bool",
};
const WEEK_REVIEW_FIELDS: Record<string, FieldSpec> = { wins: "nstr", improvements: "nstr", nextFocus: "nstr" };
const OPPORTUNITY_FIELDS: Record<string, FieldSpec> = {
  title: "str", lane: ["career", "life"], category: "str", status: OPPORTUNITY_STATUSES, priority: PRIORITIES,
  deadline: "nstr", source: "nstr", nextAction: "nstr", notes: "nstr", projectId: "nstr",
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 按白名单校验 set；未知字段（含 description）报错 */
export function parsePatch(raw: unknown, spec: Record<string, FieldSpec>): { patch: Record<string, unknown> | null; error: string | null } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { patch: null, error: "set 需要是对象" };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const t = spec[k];
    if (!t) return { patch: null, error: `不允许改字段：${k}` };
    const bad = () => ({ patch: null, error: `字段 ${k} 值不合法` });
    if (Array.isArray(t)) { if (typeof v !== "string" || !t.includes(v)) return { patch: null, error: `${k} 需为 ${t.join("/")}` }; out[k] = v; }
    else if (t === "str") { if (typeof v !== "string" || !v.trim()) return bad(); out[k] = v.trim(); }
    else if (t === "nstr") { if (v !== null && typeof v !== "string") return bad(); out[k] = typeof v === "string" && v.trim() ? v.trim() : null; }
    else if (t === "tags") { if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) return bad(); out[k] = v; }
    else if (t === "bool") { if (typeof v !== "boolean") return bad(); out[k] = v; }
    else if (t === "days") { const d = dayList(v); if (!d) return bad(); out[k] = d; }
    else if (t === "int") { if (!Number.isInteger(v)) return bad(); out[k] = v; }
    else if (t === "nint") { if (v !== null && !Number.isInteger(v)) return bad(); out[k] = v; }
    else if (t === "date") { if (v !== null && (typeof v !== "string" || Number.isNaN(Date.parse(v)))) return bad(); out[k] = v; }
    else if (t === "power") { if (v !== null && !isLifePowerKey(v as string)) return bad(); out[k] = v; }
    else if (t === "score") { const n = parseWellnessScore(v); if (v !== null && n === null) return bad(); out[k] = n; }
    else if (t === "clock") { const c = parseClockTime(v); if (v !== null && c === null) return bad(); out[k] = c; }
    else if (t === "num") { if (v !== null && (typeof v !== "number" || !Number.isFinite(v))) return bad(); out[k] = v; }
    else if (t === "day") { if (v !== null && (typeof v !== "string" || !DAY_RE.test(v))) return bad(); out[k] = v; }
  }
  if (Object.keys(out).length === 0) return { patch: null, error: "set 为空" };
  return { patch: out, error: null };
}

export const ALIGN_OPS = [
  "complete_step",
  "log_work",
  "check_habit",
  "set_rhythm",
  "pause_project",
  "resume_project",
  "set_power",
  "add_step",
  "uncomplete_step",
  "uncheck_habit",
  "remove_step",
  "set_day_score",
  "set_habit_power",
  "create_project",
  "create_habit",
  "update_project",
  "create_contact",
  "update_contact",
  "log_contact",
  "create_opportunity",
  "update_opportunity",
  "set_day_plan",
  "set_must_do",
  "update_day_log",
  "record_note",
  "add_extra",
  "close_day",
  "create_task",
  "complete_task",
  "set_week_plan",
  "set_week_review",
  "save_bot_digest",
] as const;

export const MAX_PLAN_PRIORITIES = 3;

/** priorities：[{ title, projectId?, completed? }] 或字符串数组；最多 3 个 */
export function parsePriorityList(v: unknown): PlanPriority[] | null {
  if (!Array.isArray(v)) return null;
  const out: PlanPriority[] = [];
  for (const x of v) {
    if (typeof x === "string" && x.trim()) out.push({ title: x.trim() });
    else if (x && typeof x === "object" && typeof (x as PlanPriority).title === "string" && (x as PlanPriority).title.trim()) {
      const r = x as PlanPriority;
      out.push({
        title: r.title.trim(),
        ...(typeof r.projectId === "string" && r.projectId.trim() ? { projectId: r.projectId.trim() } : {}),
        ...(typeof r.completed === "boolean" ? { completed: r.completed } : {}),
      });
    } else return null;
  }
  return out.length > MAX_PLAN_PRIORITIES ? null : out;
}

function parseMustDoList(v: unknown): MustDoInput[] | null {
  if (!Array.isArray(v) || v.length > 3) return null;
  const out: MustDoInput[] = [];
  for (const x of v) {
    const r = (x ?? {}) as Record<string, unknown>;
    if ((r.type === "habit" || r.type === "task") && typeof r.id === "string" && r.id.trim()) out.push({ type: r.type, id: r.id.trim() });
    else if (r.type === "priority" && typeof r.title === "string" && r.title.trim()) {
      out.push({ type: "priority", title: r.title.trim(), ...(typeof r.done === "boolean" ? { done: r.done } : {}) });
    } else return null;
  }
  return out;
}

function dayList(v: unknown): number[] | null {
  return Array.isArray(v)
    ? [...new Set(v.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : null;
}

export type AlignContext = {
  date: string;
  mode: AlignMode;
  /** 今天自动排到的步骤（已顺延） */
  todaySteps: Array<{ stepId: string; projectId: string; projectName: string; title: string; done: boolean }>;
  habits: Array<{ habitId: string; name: string; power: string | null; checked: boolean }>;
  projects: Array<{
    projectId: string;
    name: string;
    category: string | null;
    power: string | null;
    planActive: boolean;
    workdays: number[];
    done: number;
    total: number;
    doneThisWeek: number;
    lastDoneDate: string | null;
    /** 接下来自动排的步骤 */
    upcoming: Array<{ stepId: string; title: string; date: string }>;
  }>;
};

const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** 从 LLM 回复里取出 JSON：支持裸 JSON、```json 代码块、{ ops: [...] } 或数组 */
export function extractOpsJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? text).trim();
  const start = body.search(/[[{]/);
  if (start < 0) throw new Error("没找到 JSON");
  return JSON.parse(body.slice(start));
}

/** 校验并规整操作；未知或不完整的操作进 errors，不会被执行 */
export function parseAlignOps(input: unknown): { ops: AlignOp[]; errors: string[] } {
  const list = Array.isArray(input)
    ? input
    : input && typeof input === "object" && Array.isArray((input as { ops?: unknown }).ops)
      ? (input as { ops: unknown[] }).ops
      : null;
  if (!list) return { ops: [], errors: ["需要一个操作数组，或 { \"ops\": [...] }"] };

  const allowed = new Set<string>(ALIGN_OPS);
  const ops: AlignOp[] = [];
  const errors: string[] = [];
  list.forEach((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const op = str(r.op);
    const at = `#${i + 1}`;
    if (!op || !allowed.has(op)) {
      errors.push(`${at} 不支持的操作：${op ?? "（空）"}`);
      return;
    }
    const note = str(r.note) ?? undefined;
    const patchOp = (spec: Record<string, FieldSpec>, required?: string) => {
      const { patch, error } = parsePatch(r.set, spec);
      if (error) return void errors.push(`${at} ${op}：${error}`);
      if (required && !patch![required]) return void errors.push(`${at} ${op} 的 set 缺 ${required}`);
      return patch!;
    };
    switch (op) {
      case "set_day_plan":
      case "set_week_plan": {
        const weekStart = op === "set_week_plan" ? str(r.weekStart) : null;
        if (weekStart && !DAY_RE.test(weekStart)) return void errors.push(`${at} ${op} weekStart 需为 YYYY-MM-DD`);
        const hasIntention = "intention" in r;
        if (hasIntention && r.intention !== null && typeof r.intention !== "string") return void errors.push(`${at} ${op} intention 需为字符串或 null`);
        const priorities = r.priorities === undefined ? undefined : parsePriorityList(r.priorities);
        if (priorities === null) return void errors.push(`${at} ${op} priorities 需为 ≤3 个 { title, projectId? }`);
        if (!hasIntention && !priorities) return void errors.push(`${at} ${op} 需要 intention 或 priorities`);
        const base = {
          ...(hasIntention ? { intention: str(r.intention) } : {}),
          ...(priorities ? { priorities } : {}),
        };
        ops.push(op === "set_week_plan" ? { op, ...(weekStart ? { weekStart } : {}), ...base } : { op, ...base });
        return;
      }
      case "set_must_do": {
        const items = parseMustDoList(r.items);
        if (!items) return void errors.push(`${at} set_must_do items 需为 ≤3 个 {type:habit|task,id} 或 {type:priority,title}`);
        ops.push({ op, items });
        return;
      }
      case "update_day_log": {
        const set = patchOp(DAY_LOG_FIELDS);
        if (set) ops.push({ op, set: set as DayLogPatch });
        return;
      }
      case "record_note": {
        const kind = r.kind;
        const id = str(r.id);
        if ((kind !== "step" && kind !== "task" && kind !== "habit") || !id || typeof r.text !== "string") {
          return void errors.push(`${at} record_note 需要 kind（step/task/habit）、id、text`);
        }
        ops.push({ op, kind, id, text: r.text.trim() });
        return;
      }
      case "add_extra": {
        const title = str(r.title);
        if (!title) return void errors.push(`${at} add_extra 缺 title`);
        ops.push({ op, title });
        return;
      }
      case "close_day":
        ops.push({ op, ...(note ? { note } : {}) });
        return;
      case "create_task": {
        const set = patchOp(TASK_FIELDS, "title");
        if (set) ops.push({ op, set: set as TaskPatch & { title: string } });
        return;
      }
      case "complete_task": {
        const taskId = str(r.taskId);
        if (!taskId) return void errors.push(`${at} complete_task 缺 taskId`);
        ops.push({ op, taskId });
        return;
      }
      case "set_week_review": {
        const weekStart = str(r.weekStart);
        if (weekStart && !DAY_RE.test(weekStart)) return void errors.push(`${at} set_week_review weekStart 需为 YYYY-MM-DD`);
        const set = patchOp(WEEK_REVIEW_FIELDS);
        if (set) ops.push({ op, ...(weekStart ? { weekStart } : {}), set: set as WeekReviewPatch });
        return;
      }
      case "save_bot_digest": {
        const content = str(r.content);
        if (!content) return void errors.push(`${at} save_bot_digest 缺 content`);
        ops.push({ op, content });
        return;
      }
      case "update_project": {
        const projectId = str(r.projectId);
        if (!projectId) return void errors.push(`${at} update_project 缺 projectId`);
        const set = patchOp(PROJECT_FIELDS);
        if (set) ops.push({ op, projectId, set: set as ProjectPatch });
        return;
      }
      case "create_contact": {
        const set = patchOp(CONTACT_FIELDS, "name");
        if (set) ops.push({ op, set: set as ContactPatch & { name: string } });
        return;
      }
      case "update_contact": {
        const contactId = str(r.contactId);
        if (!contactId) return void errors.push(`${at} update_contact 缺 contactId`);
        const set = patchOp(CONTACT_FIELDS);
        if (set) ops.push({ op, contactId, set: set as ContactPatch });
        return;
      }
      case "log_contact": {
        const contactId = str(r.contactId);
        if (!contactId) return void errors.push(`${at} log_contact 缺 contactId`);
        ops.push({ op, contactId, ...(str(r.type) ? { type: str(r.type)! } : {}), ...(str(r.content) ? { content: str(r.content)! } : {}) });
        return;
      }
      case "create_opportunity": {
        const set = patchOp(OPPORTUNITY_FIELDS, "title");
        if (set) ops.push({ op, set: set as OpportunityPatch & { title: string } });
        return;
      }
      case "update_opportunity": {
        const opportunityId = str(r.opportunityId);
        if (!opportunityId) return void errors.push(`${at} update_opportunity 缺 opportunityId`);
        const set = patchOp(OPPORTUNITY_FIELDS);
        if (set) ops.push({ op, opportunityId, set: set as OpportunityPatch });
        return;
      }
      case "complete_step": {
        const stepId = str(r.stepId);
        if (!stepId) return void errors.push(`${at} complete_step 缺 stepId`);
        ops.push({ op, stepId, ...(note ? { note } : {}) });
        return;
      }
      case "uncomplete_step":
      case "remove_step": {
        const stepId = str(r.stepId);
        if (!stepId) return void errors.push(`${at} ${op} 缺 stepId`);
        ops.push({ op, stepId });
        return;
      }
      case "set_day_score": {
        const score = parsePlanScore(r.score);
        if (score == null) return void errors.push(`${at} set_day_score 需要 0–100 的 score`);
        ops.push({ op, score, ...(note ? { note } : {}) });
        return;
      }
      case "set_habit_power": {
        const habitId = str(r.habitId);
        const power = str(r.power);
        if (!habitId || !isHabitPowerValue(power)) {
          return void errors.push(`${at} set_habit_power 需要 habitId，power 为九力 key 或 base`);
        }
        ops.push({ op, habitId, power });
        return;
      }
      case "uncheck_habit": {
        const habitId = str(r.habitId);
        if (!habitId) return void errors.push(`${at} uncheck_habit 缺 habitId`);
        ops.push({ op, habitId });
        return;
      }
      case "log_work": {
        const projectId = str(r.projectId);
        const title = str(r.title);
        if (!projectId || !title) return void errors.push(`${at} log_work 需要 projectId 和 title`);
        ops.push({ op, projectId, title, ...(note ? { note } : {}) });
        return;
      }
      case "check_habit": {
        const habitId = str(r.habitId);
        if (!habitId) return void errors.push(`${at} check_habit 缺 habitId`);
        ops.push({ op, habitId, level: r.level === "minimum" ? "minimum" : "full" });
        return;
      }
      case "set_rhythm": {
        const projectId = str(r.projectId);
        const days = Array.isArray(r.workdays)
          ? [...new Set(r.workdays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
          : null;
        if (!projectId || !days) return void errors.push(`${at} set_rhythm 需要 projectId 和 workdays（0–6）`);
        ops.push({ op, projectId, workdays: days });
        return;
      }
      case "pause_project":
      case "resume_project": {
        const projectId = str(r.projectId);
        if (!projectId) return void errors.push(`${at} ${op} 缺 projectId`);
        ops.push({ op, projectId });
        return;
      }
      case "set_power": {
        const projectId = str(r.projectId);
        const power = r.power === null || r.power === "" ? null : str(r.power);
        if (!projectId || (power !== null && !isLifePowerKey(power))) {
          return void errors.push(`${at} set_power 需要 projectId，power 为九力 key 或 null`);
        }
        ops.push({ op, projectId, power: power as LifePowerKey | null });
        return;
      }
      case "add_step": {
        const projectId = str(r.projectId);
        const title = str(r.title);
        if (!projectId || !title) return void errors.push(`${at} add_step 需要 projectId 和 title`);
        ops.push({ op, projectId, title, ...(str(r.detail) ? { detail: str(r.detail)! } : {}) });
        return;
      }
      case "create_project": {
        const name = str(r.name);
        if (!name) return void errors.push(`${at} create_project 缺 name`);
        if ("description" in r) return void errors.push(`${at} create_project 不允许写 description`);
        const power = r.power === null || r.power === undefined || r.power === "" ? null : str(r.power);
        if (power !== null && !isLifePowerKey(power)) return void errors.push(`${at} create_project power 需为九力 key 或 null`);
        const workdays = r.workdays === undefined ? undefined : dayList(r.workdays);
        if (workdays === null) return void errors.push(`${at} create_project workdays 需为 0–6 数组`);
        const tags = Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string" && t.trim() !== "") : undefined;
        ops.push({
          op,
          name,
          ...(str(r.category) ? { category: str(r.category)! } : {}),
          ...(power ? { power: power as LifePowerKey } : {}),
          ...(typeof r.planActive === "boolean" ? { planActive: r.planActive } : {}),
          ...(workdays ? { workdays } : {}),
          ...(tags?.length ? { tags } : {}),
        });
        return;
      }
      case "create_habit": {
        const name = str(r.name);
        if (!name) return void errors.push(`${at} create_habit 缺 name`);
        const schedule = r.schedule === "weekly" ? "weekly" : "anytime";
        const daysOfWeek = r.daysOfWeek === undefined ? undefined : dayList(r.daysOfWeek);
        if (daysOfWeek === null || (daysOfWeek && daysOfWeek.length === 0)) {
          return void errors.push(`${at} create_habit daysOfWeek 需为非空 0–6 数组`);
        }
        const power = str(r.power);
        if (power && !isHabitPowerValue(power)) return void errors.push(`${at} create_habit power 需为九力 key 或 base`);
        ops.push({
          op,
          name,
          schedule,
          ...(daysOfWeek ? { daysOfWeek } : {}),
          ...(str(r.projectName) ? { projectName: str(r.projectName)! } : {}),
          ...(power ? { power: power as HabitPowerValue } : {}),
          ...(str(r.minimumVersion) ? { minimumVersion: str(r.minimumVersion)! } : {}),
          ...(str(r.cue) ? { cue: str(r.cue)! } : {}),
        });
        return;
      }
    }
  });
  return { ops, errors };
}

function rhythm(days: number[]): string {
  if (days.length === 0) return "未设推进日";
  if (days.length === 7) return "每天";
  return `周${[1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => WEEKDAY[d]).join("")}`;
}

function powerLabel(power: string | null): string {
  return isLifePowerKey(power) ? LIFE_POWER_META[power].label : power === "base" ? "生活底盘" : "未归力";
}

/** 给外部 LLM 的完整 prompt：角色、规则、上下文、输出格式 */
export function buildAlignPrompt(ctx: AlignContext): string {
  const daily = ctx.mode === "daily";
  const lines: string[] = [];
  lines.push(
    daily
      ? `你是我的 LifeOS 记录助手。今天是 ${ctx.date}。我会用自然语言告诉你今天实际做了什么，请把它们对到下面的项目步骤和习惯上。`
      : `你是我的 LifeOS 开工助手。今天是 ${ctx.date}。花 15 分钟和我逐个过一遍项目（先过今天排到的）：每个项目问我一两个问题，再决定节奏、暂停、归属的力，以及要不要补步骤。`
  );
  lines.push("");
  lines.push("## 规则");
  lines.push("- 只用下面出现过的 id，不要编造。对不上的事情先问我，或者用 log_work 记到最相关的项目。");
  lines.push("- 没做完的步骤**不用处理**：系统会自动顺延到该项目的下一个工作日。");
  lines.push("- 记错了可以撤销：uncomplete_step 把步骤改回未完成，uncheck_habit 取消打卡；不再需要的待办步骤用 remove_step 删掉。");
  if (daily) {
    lines.push("- 我做了某个已排的步骤 → complete_step；做了计划外的事 → log_work（一句话标题，动词开头）。");
    lines.push("- 一件事只对一次；拿不准就先列出你的理解让我确认，再给最终 JSON。");
  } else {
    lines.push("- 节奏用 set_rhythm（0=周日 … 6=周六）。一天里全部项目步骤最好不超过 6 个，帮我按优先级取舍。");
    lines.push("- 15 分钟内过不完就停，没过到的项目留给明天。");
    lines.push("- 不想推进的项目 pause_project；要回来的 resume_project。归属用 set_power。");
    lines.push("- 步骤快用完或不清楚下一步时，用 add_step 补 1–3 个具体步骤（动词开头，半天内可完成）。");
  }
  lines.push("");

  if (daily || ctx.todaySteps.some((s) => s.done)) {
    lines.push("## 今天自动排到的步骤");
    if (ctx.todaySteps.length === 0) lines.push("（无）");
    for (const s of ctx.todaySteps) {
      lines.push(`- [${s.done ? "x" : " "}] stepId=${s.stepId} · ${s.projectName} · ${s.title}`);
    }
    lines.push("");
  }
  if (daily) {
    lines.push("## 今天的习惯");
    for (const h of ctx.habits) {
      lines.push(`- [${h.checked ? "x" : " "}] habitId=${h.habitId} · ${h.name}（${powerLabel(h.power)}）`);
    }
    lines.push("");
  }

  lines.push(daily ? "## 进行中的项目（计划外工作对到这里）" : "## 项目清单（今天排到的在前，逐个过）");
  for (const p of ctx.projects) {
    const head = `- projectId=${p.projectId} · ${p.name}${p.category ? `（${p.category}）` : ""} · ${powerLabel(p.power)} · ${p.planActive ? rhythm(p.workdays) : "已暂停"}`;
    lines.push(daily ? head : `${head} · 进度 ${p.done}/${p.total} · 本周完成 ${p.doneThisWeek} · 上次推进 ${p.lastDoneDate ?? "从未"}`);
    for (const u of p.upcoming.slice(0, daily ? 1 : 3)) {
      lines.push(`  - 下一步 stepId=${u.stepId} · ${u.date} · ${u.title}`);
    }
  }
  lines.push("");

  lines.push("## 输出格式");
  lines.push("确认后，只输出一个 ```json 代码块：");
  lines.push("```json");
  lines.push('{ "ops": [');
  lines.push('  { "op": "complete_step", "stepId": "…", "note": "可选：观察到什么" },');
  lines.push('  { "op": "log_work", "projectId": "…", "title": "做了什么", "note": "可选" },');
  lines.push('  { "op": "check_habit", "habitId": "…" },');
  lines.push('  { "op": "uncomplete_step", "stepId": "…" },');
  lines.push(daily ? '  { "op": "uncheck_habit", "habitId": "…" }' : '  { "op": "uncheck_habit", "habitId": "…" },');
  if (!daily) {
    lines.push('  { "op": "remove_step", "stepId": "…" },');
    lines.push('  { "op": "set_rhythm", "projectId": "…", "workdays": [1, 3, 5] },');
    lines.push('  { "op": "pause_project", "projectId": "…" },');
    lines.push('  { "op": "resume_project", "projectId": "…" },');
    lines.push(`  { "op": "set_power", "projectId": "…", "power": "${LIFE_POWERS.map((p) => p.key).join(" | ")} | null" },`);
    lines.push('  { "op": "add_step", "projectId": "…", "title": "下一步做什么", "detail": "可选" }');
  }
  lines.push("] }");
  lines.push("```");
  lines.push("");
  lines.push(daily ? "现在先问我：今天做了什么？" : "现在从第一个项目开始。");
  return lines.join("\n");
}

function fmtSet(set: Record<string, unknown>, skip: string[] = []): string {
  return Object.entries(set)
    .filter(([k]) => !skip.includes(k))
    .map(([k, v]) => `${k}=${typeof v === "string" ? (v.length > 40 ? v.slice(0, 40) + "…" : v) : JSON.stringify(v)}`)
    .join("，");
}

/** 预览：把操作翻成一句人话 */
export function describeOp(
  op: AlignOp,
  names: {
    step: (id: string) => string | null;
    project: (id: string) => string | null;
    habit: (id: string) => string | null;
    contact?: (id: string) => string | null;
    opportunity?: (id: string) => string | null;
    task?: (id: string) => string | null;
  }
): string {
  const P = (id: string) => names.project(id) ?? `未知项目 ${id}`;
  switch (op.op) {
    case "complete_step":
      return `完成步骤：${names.step(op.stepId) ?? `未知步骤 ${op.stepId}`}${op.note ? `（${op.note}）` : ""}`;
    case "log_work":
      return `补记到 ${P(op.projectId)}：${op.title}`;
    case "check_habit":
      return `习惯打卡：${names.habit(op.habitId) ?? `未知习惯 ${op.habitId}`}${op.level === "minimum" ? "（最小版）" : ""}`;
    case "set_rhythm":
      return `${P(op.projectId)} 节奏 → ${rhythm(op.workdays)}`;
    case "pause_project":
      return `暂停 ${P(op.projectId)}`;
    case "resume_project":
      return `恢复 ${P(op.projectId)}`;
    case "set_power":
      return `${P(op.projectId)} 归属 → ${powerLabel(op.power)}`;
    case "add_step":
      return `给 ${P(op.projectId)} 加步骤：${op.title}`;
    case "uncomplete_step":
      return `撤销完成：${names.step(op.stepId) ?? `未知步骤 ${op.stepId}`}`;
    case "uncheck_habit":
      return `取消打卡：${names.habit(op.habitId) ?? `未知习惯 ${op.habitId}`}`;
    case "remove_step":
      return `删除步骤：${names.step(op.stepId) ?? `未知步骤 ${op.stepId}`}`;
    case "set_day_score":
      return `计划完成度 → ${op.score}${op.note ? `（${op.note.split("\n")[0]}）` : ""}`;
    case "set_habit_power":
      return `习惯 ${names.habit(op.habitId) ?? `未知习惯 ${op.habitId}`} 归属 → ${op.power === HABIT_POWER_BASE ? "生活底盘" : powerLabel(op.power)}`;
    case "create_project":
      return `新建项目：${op.name}${op.category ? `（${op.category}）` : ""} · ${powerLabel(op.power ?? null)} · ${op.planActive ? rhythm(op.workdays ?? [1, 2, 3, 4, 5]) : "未启用排程"}`;
    case "update_project":
      return `改项目 ${P(op.projectId)}：${fmtSet(op.set)}`;
    case "create_contact":
      return `新建联系人：${op.set.name}${Object.keys(op.set).length > 1 ? `（${fmtSet(op.set)}）` : ""}`;
    case "update_contact":
      return `改联系人 ${names.contact?.(op.contactId) ?? op.contactId}：${fmtSet(op.set)}`;
    case "log_contact":
      return `记联系 ${names.contact?.(op.contactId) ?? op.contactId}：${op.type ?? "message"}${op.content ? ` · ${op.content}` : ""}`;
    case "create_opportunity":
      return `新建机会：${op.set.title}${Object.keys(op.set).length > 1 ? `（${fmtSet(op.set, ["title"])}）` : ""}`;
    case "update_opportunity":
      return `改机会 ${names.opportunity?.(op.opportunityId) ?? op.opportunityId}：${fmtSet(op.set)}`;
    case "set_day_plan":
    case "set_week_plan": {
      const head = op.op === "set_day_plan" ? "今日计划" : `周计划${op.weekStart ? ` ${op.weekStart}` : ""}`;
      const parts = [
        op.intention !== undefined ? `意图：${op.intention ?? "（清空）"}` : null,
        op.priorities ? `优先级：${op.priorities.map((p) => p.title).join(" / ") || "（清空）"}` : null,
      ].filter(Boolean);
      return `${head} → ${parts.join("；")}`;
    }
    case "set_must_do":
      return `今日必做 → ${op.items.map((i) => (i.type === "priority" ? i.title : i.type === "habit" ? names.habit(i.id) ?? i.id : names.task?.(i.id) ?? i.id)).join(" / ") || "（清空）"}`;
    case "update_day_log":
      return `日志：${fmtSet(op.set)}`;
    case "record_note": {
      const label = op.kind === "step" ? names.step(op.id) : op.kind === "habit" ? names.habit(op.id) : names.task?.(op.id);
      return `批注 ${label ?? op.id}：${op.text || "（删除）"}`;
    }
    case "add_extra":
      return `计划外多做：${op.title}`;
    case "close_day":
      return `关账${op.note ? `：${op.note.split("\n")[0]}` : ""}`;
    case "create_task":
      return `新建任务：${op.set.title}${Object.keys(op.set).length > 1 ? `（${fmtSet(op.set, ["title"])}）` : ""}`;
    case "complete_task":
      return `完成任务：${names.task?.(op.taskId) ?? op.taskId}`;
    case "set_week_review":
      return `周复盘${op.weekStart ? ` ${op.weekStart}` : ""}：${fmtSet(op.set)}`;
    case "save_bot_digest":
      return `存档 bot 日报（${op.content.split("\n").length} 行）`;
    case "create_habit":
      return `新建习惯：${op.name} · ${op.schedule === "weekly" ? rhythm(op.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6]) : "随时（anytime）"}${op.projectName ? ` · 挂到 ${op.projectName}` : ""}`;
  }
}
