export const WELLNESS_SCORES = [1, 2, 3, 4, 5] as const;

export type WellnessScore = (typeof WELLNESS_SCORES)[number];

export function parseWellnessScore(value: unknown): WellnessScore | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return (WELLNESS_SCORES as readonly number[]).includes(n) ? (n as WellnessScore) : null;
}

/** Clock time stored as HH:mm. Empty or invalid becomes null. */
export function parseClockTime(value: unknown): string | null {
  if (value == null || value === "") return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export type WellnessScale = "energy" | "drain" | "urge";

/** 每个分数的含义：短名 + 一句可判断的描述（早晚通用） */
export const WELLNESS_SCALE: Record<WellnessScale, Record<WellnessScore, { name: string; hint: string }>> = {
  energy: {
    1: { name: "透支", hint: "只想躺着，连回消息都费劲；今天只做必须的事" },
    2: { name: "偏低", hint: "能做杂事和沟通，但集中不了 30 分钟" },
    3: { name: "一般", hint: "能做常规工作，深度专注最多 1 小时" },
    4: { name: "良好", hint: "能深度工作 2–3 小时，愿意碰难的事" },
    5: { name: "充沛", hint: "满格状态，最难的任务现在就想开干" },
  },
  drain: {
    1: { name: "平静", hint: "几乎没有杂念，注意力都在手上的事" },
    2: { name: "轻微", hint: "偶尔冒出担心或比较，很快能放下" },
    3: { name: "中等", hint: "有一件事反复在脑子里转，明显拖慢效率" },
    4: { name: "明显", hint: "焦虑 / 纠结 / 内疚占掉大半注意力，开始拖延" },
    5: { name: "严重", hint: "被情绪卡住，什么都做不下去，需要先处理情绪" },
  },
  // 冲动 · 转化：早上的冲动强度（想改掉的那个冲动）
  urge: {
    1: { name: "平静", hint: "几乎没有念头" },
    2: { name: "偶尔", hint: "偶尔冒出来，注意力一转就没了" },
    3: { name: "明显", hint: "反复冒出来，今天需要主动转移一次" },
    4: { name: "强烈", hint: "注意力会被拉走，无聊或疲惫时容易失守" },
    5: { name: "很强", hint: "坐立不安，不立刻转移就容易破戒" },
  },
};

/** 「3 · 一般：能做常规工作…」；没打分返回 null */
export function describeWellness(scale: WellnessScale, value: number | null | undefined): string | null {
  const score = parseWellnessScore(value);
  if (score == null) return null;
  const { name, hint } = WELLNESS_SCALE[scale][score];
  return `${score} · ${name}：${hint}`;
}
