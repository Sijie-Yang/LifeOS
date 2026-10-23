export type PersonalOsLayer = {
  name: string;
  role: string;
  reference: string;
  principle: string;
  lifeos?: string;
  accent: "violet" | "amber" | "sky" | "rose" | "blue" | "purple" | "emerald";
};

export type PersonalOs = {
  version: 1;
  title: string;
  summary: string;
  layers: PersonalOsLayer[];
  footnote: string;
};

/** 通用示例默认值：可在人生策略页里改成你自己的版本。 */
export const DEFAULT_PERSONAL_OS: PersonalOs = {
  version: 1,
  title: "个人操作系统 · 七层",
  summary:
    "（示例）铁律在上：身体优先（规律作息与运动）；输入少而精（深读胜过碎片）。其下才是用世界模型选方向、用微习惯让事情发生、用平和心态应对起伏。",
  layers: [
    {
      name: "世界模型",
      role: "理解现实、预测、更新信念",
      reference: "《思考，快与慢》、贝叶斯思维",
      principle: "像做实验一样看待职业与世界：预测、验证、更新",
      accent: "violet",
    },
    {
      name: "行动",
      role: "让事情真的发生",
      reference: "《微习惯》、《原子习惯》",
      principle: "微习惯 + 立刻最小一步",
      accent: "amber",
    },
    {
      name: "心态",
      role: "平整、不被结果拖垮",
      reference: "斯多葛哲学（可控 / 不可控）",
      principle: "只为可控部分负责；不因单次成败改 identity",
      accent: "sky",
    },
    {
      name: "精力",
      role: "燃料 — 身体优先",
      reference: "LifeOS 铁律 · 身体",
      principle: "固定起床时间；每天至少 30 分钟运动；睡前少屏幕。身体是一切计划的底座。",
      lifeos: "运动习惯、规律作息、早睡",
      accent: "rose",
    },
    {
      name: "注意力",
      role: "带宽 — 输入少而精",
      reference: "LifeOS 铁律 · 输入",
      principle: "减少信息流与短视频；一次深读一本书，读完写一段笔记再换。",
      lifeos: "深读习惯、周日历、决策过滤器",
      accent: "blue",
    },
    {
      name: "复盘",
      role: "更新模型 — 证伪旧信念",
      reference: "周复盘、《Thinking in Bets》",
      principle: "周复盘 + 策略对话：证伪旧模型",
      lifeos: "周复盘、本页策略对话",
      accent: "purple",
    },
    {
      name: "场域",
      role: "人 · 事 · 物 · 场",
      reference: "《Essentialism》",
      principle: "环境与人先于硬扛",
      lifeos: "目标作战室（人事物场）、机会页（DDL + 联系人）、财务目标",
      accent: "emerald",
    },
  ],
  footnote:
    "（示例）铁律优先：①身体优先 ②输入少而精。行动与模型在铁律之下运转；机会是场域里的时间窗口：人 · 事 · DDL，不是无限待办。",
};

const ACCENT_STYLES: Record<
  PersonalOsLayer["accent"],
  { dot: string; badge: string; border: string }
> = {
  violet: {
    dot: "bg-violet-500",
    badge: "bg-violet-100 text-violet-800",
    border: "border-violet-100",
  },
  amber: {
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-900",
    border: "border-amber-100",
  },
  sky: {
    dot: "bg-sky-500",
    badge: "bg-sky-100 text-sky-900",
    border: "border-sky-100",
  },
  rose: {
    dot: "bg-rose-500",
    badge: "bg-rose-100 text-rose-900",
    border: "border-rose-100",
  },
  blue: {
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-900",
    border: "border-blue-100",
  },
  purple: {
    dot: "bg-purple-500",
    badge: "bg-purple-100 text-purple-900",
    border: "border-purple-100",
  },
  emerald: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-900",
    border: "border-emerald-100",
  },
};

export function getOsAccentStyles(accent: PersonalOsLayer["accent"]) {
  return ACCENT_STYLES[accent];
}

export function serializeOperatingSystem(os: PersonalOs): string {
  return JSON.stringify(os);
}

export function formatOperatingSystemMarkdown(os: PersonalOs = DEFAULT_PERSONAL_OS): string {
  const lifeosLayers = os.layers.filter((l) => l.lifeos);
  return `## ${os.title}

${os.summary}

${os.layers
  .map(
    (l, i) =>
      `### ${i + 1}. ${l.name}

- **作用**：${l.role}
- **参考**：${l.reference}
- **原则**：${l.principle}${l.lifeos ? `\n- **LifeOS**：${l.lifeos}` : ""}`
  )
  .join("\n\n")}

> ${os.footnote}
`;
}

/** @deprecated use serializeOperatingSystem(DEFAULT_PERSONAL_OS) */
export const DEFAULT_PERSONAL_OPERATING_SYSTEM = formatOperatingSystemMarkdown();

export function parseOperatingSystem(raw: string | null | undefined): PersonalOs | null {
  if (!raw?.trim()) return DEFAULT_PERSONAL_OS;

  try {
    const parsed = JSON.parse(raw) as PersonalOs;
    if (parsed?.version === 1 && Array.isArray(parsed.layers)) return parsed;
  } catch {
    // legacy markdown
  }

  if (raw.includes("个人操作系统") && raw.includes("世界模型")) {
    return DEFAULT_PERSONAL_OS;
  }

  return null;
}
