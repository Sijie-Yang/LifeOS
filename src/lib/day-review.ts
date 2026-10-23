import { describeWellness } from "@/lib/wellness-scores";
import { recordKey, type RecordExtra, type RecordNotes } from "@/lib/day-record";
import type { LifePowersResult } from "@/lib/life-powers";

/**
 * 今日复盘：记录段「复制今日总结」生成的 prompt，贴给 Claude（Claude Code，在本仓库里）。
 * Claude 据此：调整项目进度 → 审查记录与九力 → 打计划完成度分并写回（set_day_score）→ 提出改进。
 * 这个 prompt 本身也是可进化的：Claude 发现流程该改时，会指出改这里。
 */
export type DayReviewInput = {
  date: string;
  closed: boolean;
  wellness: {
    lastNightBedtime: string | null;
    wakeTime: string | null;
    sleepHours: number | null;
    energyMorning: number | null;
    drainMorning: number | null;
    energyEvening: number | null;
    drainEvening: number | null;
    reflection: string | null;
    weightKg?: number | null;
    exerciseStartTime?: string | null;
    exerciseMinutes?: number | null;
    exerciseCalories?: number | null;
  };
  steps: Array<{ id: string; title: string; projectId: string; projectName: string; done: boolean }>;
  tasks: Array<{ id: string; title: string; completed: boolean }>;
  habits: Array<{ id: string; name: string; checked: boolean; level?: string | null; power?: string | null }>;
  notes: RecordNotes;
  extras: RecordExtra[];
  lifePowers: LifePowersResult | null;
  planScore: number | null;
  /** 冲动 · 转化 */
  urge?: {
    morning: number | null;
    today: Array<{ time: string; label: string; outcome: string; trigger: string | null }>;
    streak: number;
    brokeToday: boolean;
  } | null;
};

/** 没做、又没写原因的事项（生活底盘习惯不要求） */
export function missingReasons(input: Pick<DayReviewInput, "steps" | "tasks" | "habits" | "notes">): string[] {
  const out: string[] = [];
  for (const s of input.steps) if (!s.done && !input.notes[recordKey("step", s.id)]) out.push(s.title);
  for (const t of input.tasks) if (!t.completed && !input.notes[recordKey("task", t.id)]) out.push(t.title);
  for (const h of input.habits) {
    if (h.power !== "base" && !h.checked && !input.notes[recordKey("habit", h.id)]) out.push(h.name);
  }
  return out;
}

/**
 * prompt 里写给 Claude 的接口地址。这个模块会在浏览器里跑（「复制今日总结」），
 * 所以优先用当前页面的地址；服务端 / 测试里退回 LIFEOS_URL 或默认端口。
 */
function lifeosUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return (typeof process !== "undefined" && process.env?.LIFEOS_URL) || "http://127.0.0.1:3000";
}

function line(label: string, value: string | null | undefined) {
  return `- ${label}：${value ?? "未记录"}`;
}

export function buildDayReviewPrompt(input: DayReviewInput): string {
  const { date, wellness: w, notes } = input;
  const note = (kind: "step" | "task" | "habit", id: string) => notes[recordKey(kind, id)];
  const L: string[] = [];

  L.push(`# LifeOS 今日复盘 · ${date}`);
  L.push("");
  L.push(`你是我的 LifeOS 复盘助手（在 LifeOS 仓库里，接口在 ${lifeosUrl()}，规则见 docs/lifeos-align.md）。`);
  L.push("下面是我自己写完的今日总结。请按「要做的事」逐条处理，然后把结果写回系统。");
  L.push("");

  L.push("## 要做的事");
  L.push("1. **调项目进度**：按我的描述修正步骤状态。做了但没勾 → complete_step；勾了其实没做 → uncomplete_step；");
  L.push("   「多做的事」能对到项目的 → log_work；没做是因为步骤太大 / 不合理 → remove_step 或 add_step 拆小；");
  L.push("   连续顺延或不想做的项目 → set_rhythm / pause_project。需要项目全貌时先 GET /api/plan/align?mode=projects。");
  L.push("2. **审查记录**：打卡和我的描述是否矛盾（说没做却打了卡 → uncheck_habit；做了没打 → check_habit）。");
  L.push("3. **审查九力**：九力分数按「最近一次动作」自动衰减计算，不能直接改分，只能让输入变对：");
  L.push("   归属不对 → set_power（项目）/ set_habit_power（习惯，base = 生活底盘）；漏记 → log_work / check_habit。");
  L.push("   看「未进九力」里有没有该归入的；看有没有某一力的分数明显和今天实际不符。");
  L.push("4. **打计划完成度（0–100）**，用 set_day_score 写回，note 写三行：`分数理由` / `审查改了什么` / `明天的一条改进`。");
  L.push("   - 主线：今天排到的项目步骤和必做完成了多少（权重最高）");
  L.push("   - 没做的：原因合理（主动取舍、外部变化）少扣；拖延 / 逃避多扣");
  L.push("   - 多做的：有价值的加分，但不能抵掉主线没做");
  L.push("   - 锚点：90+ 全部完成还有余力 · 70–89 主线完成、少量合理顺延 · 50–69 一半左右 · <50 主线基本没推进");
  L.push("5. **自我进化**：结合精力 / 内耗 / 睡眠 / 运动 / 冲动转化（哪个时段、什么触发最多，哪种转移最管用），指出 1–2 个反复出现的模式（同一项目连续顺延、某习惯总不做、");
  L.push("   低精力日排太满…），给出对系统的具体调整（节奏、拆步骤、暂停、改习惯）。");
  L.push("   如果这个复盘流程本身该改，指出要改 src/lib/day-review.ts 的哪一条。");
  L.push("");
  L.push("流程：先把你的判断和 ops 列给我，POST 预览（dryRun 默认 true）；我确认后 dryRun:false 应用（date 填 " + date + "），最后告诉我今天的分数。");
  L.push("");

  L.push("## 状态");
  L.push(line("昨晚就寝 → 起床", `${w.lastNightBedtime ?? "?"} → ${w.wakeTime ?? "?"}`));
  L.push(line("睡眠", w.sleepHours != null ? `${w.sleepHours} 小时` : null));
  L.push(line("早上精力", describeWellness("energy", w.energyMorning)));
  L.push(line("早上内耗", describeWellness("drain", w.drainMorning)));
  L.push(line("晚上精力", describeWellness("energy", w.energyEvening)));
  L.push(line("晚上内耗", describeWellness("drain", w.drainEvening)));
  L.push(line("体重", w.weightKg != null ? `${w.weightKg} kg` : null));
  L.push(
    line(
      "运动",
      w.exerciseMinutes != null || w.exerciseCalories != null
        ? `${w.exerciseStartTime ? `${w.exerciseStartTime} 开始 · ` : ""}${w.exerciseMinutes ?? "?"} 分钟 · ${w.exerciseCalories ?? "?"} 千卡`
        : null
    )
  );
  if (input.urge) {
    const u = input.urge;
    const events = u.today.map((e) => `${e.time} ${e.label}${e.trigger ? `（${e.trigger}）` : ""}`).join("；");
    L.push(line("冲动强度（早）", describeWellness("urge", u.morning)));
    L.push(
      line(
        "冲动转化",
        `${u.today.length ? `${u.today.length} 次冲动：${events}` : "今天没有冲动记录"} · ${u.brokeToday ? "破戒" : "守住"} · 连续守住 ${u.streak} 天`
      )
    );
  }
  L.push(line("今日一句话", w.reflection));
  L.push(line("是否已关账", input.closed ? "已关账" : "未关账"));
  if (input.planScore != null) L.push(line("之前的计划完成度", String(input.planScore)));
  L.push("");

  const done = [
    ...input.steps.filter((s) => s.done).map((s) => ({ text: `[步骤 stepId=${s.id}] ${s.projectName} · ${s.title}`, n: note("step", s.id) })),
    ...input.tasks.filter((t) => t.completed).map((t) => ({ text: `[任务] ${t.title}`, n: note("task", t.id) })),
    ...input.habits
      .filter((h) => h.checked)
      .map((h) => ({ text: `[习惯 habitId=${h.id}] ${h.name}${h.level === "minimum" ? "（最小版）" : ""}`, n: note("habit", h.id) })),
  ];
  L.push("## 做了");
  if (done.length === 0) L.push("（无）");
  for (const d of done) L.push(`- ${d.text}${d.n ? `\n  - 多做了：${d.n}` : ""}`);
  L.push("");

  L.push("## 计划外多做的事");
  if (input.extras.length === 0) L.push("（无）");
  for (const e of input.extras) L.push(`- ${e.title}`);
  L.push("");

  const missed = [
    ...input.steps.filter((s) => !s.done).map((s) => ({ text: `[步骤 stepId=${s.id} · projectId=${s.projectId}] ${s.projectName} · ${s.title}`, n: note("step", s.id) })),
    ...input.tasks.filter((t) => !t.completed).map((t) => ({ text: `[任务] ${t.title}`, n: note("task", t.id) })),
    ...input.habits
      .filter((h) => !h.checked)
      .map((h) => ({ text: `[习惯 habitId=${h.id}${h.power === "base" ? " · 生活底盘" : ""}] ${h.name}`, n: note("habit", h.id) })),
  ];
  L.push("## 没做（及原因）");
  if (missed.length === 0) L.push("（无）");
  for (const m of missed) L.push(`- ${m.text}\n  - 原因：${m.n ?? "（没写）"}`);
  L.push("");

  if (input.lifePowers) {
    L.push("## 九力（自动计算）");
    for (const d of input.lifePowers.dimensions) {
      const levers = d.todayLevers.map((l) => `${l.done ? "✓" : "·"}${l.label}`).join("；");
      L.push(`- ${d.label} ${d.score} 分 · ${d.summary}${levers ? ` · 今日：${levers}` : ""}`);
    }
    if (input.lifePowers.unmatched.length) {
      L.push(`- 未进九力：${input.lifePowers.unmatched.map((u) => `${u.done ? "✓" : "·"}${u.label}`).join("；")}`);
    }
    L.push(`- 生活底盘习惯 ${input.lifePowers.base.done}/${input.lifePowers.base.total}`);
    L.push("");
  }

  return L.join("\n");
}
