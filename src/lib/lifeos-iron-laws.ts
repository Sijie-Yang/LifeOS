/**
 * LifeOS 铁律 — 示例默认值。
 * 这三条只是一个可编辑的起点：改成你自己的作息、运动与输入规则即可，
 * UI（铁律横幅、日历优先级、晚间回放）都会读取这里。
 */

export const IRON_LAWS_TITLE = "LifeOS 铁律 · 示例（可编辑）";

export const IRON_LAW_BODY = {
  id: "body-first",
  title: "身体优先",
  summary: "固定时间起床，先活动身体再开始工作；每天至少 30 分钟运动，睡前少屏幕。",
  pillars: [
    "固定起床时间（例如 07:00），起床后先喝水、活动 10 分钟，再看手机",
    "每天至少 30 分钟运动（快走 / 跑步 / 力量训练任选）",
    "每周至少 2 次力量训练",
    "睡前 30 分钟放下屏幕，固定就寝时间",
    "身体不适时可以缩成最低版本，但不要「有空再练」",
  ],
} as const;

export const IRON_LAW_BOOKS = {
  id: "books-only",
  title: "输入少而精",
  summary: "减少碎片信息，优先读结构化的好内容；一次深读一本书，读完写下要点再换。",
  pillars: [
    "默认读书与优质长文；信息流与短视频设时间上限",
    "一次只深读一本书，不平行开多本装懂",
    "读完一章写 3 句话总结，而不是只划线收藏",
    "收藏 ≠ 学会：每周清理一次稍后读列表",
  ],
} as const;

export const IRON_LAW_RHYTHM = {
  id: "own-rhythm",
  title: "守住自己的节奏",
  summary: "自我提升的节奏优先于别人的紧急与比较，不让外界随意打乱主线。",
  pillars: [
    "日程主权：别人的请求默认先记下来，不直接进「今日必做」",
    "主线优先：运动 / 深读 / 深度工作不被临时约改写（除非你主动改日计划）",
    "比较隔离：不拿别人的进度改自己的周计划；只看自己的闭环",
    "情绪防火墙：他人的焦虑、催促、评价 ≠ 你的优先级",
    "过好自己的一天：节奏稳了，才有余力对外",
  ],
} as const;

export const IRON_LAWS = [IRON_LAW_BODY, IRON_LAW_BOOKS, IRON_LAW_RHYTHM] as const;

export const IRON_LAWS_ONE_LINER =
  "① 按时起床 · 每天运动 30 分钟　② 输入少而精 · 一次深读一本　③ 守住自己的节奏 · 不被别人打乱";

export function formatIronLawsMarkdown(): string {
  return `## ${IRON_LAWS_TITLE}

${IRON_LAWS_ONE_LINER}

### ${IRON_LAW_BODY.title}
${IRON_LAW_BODY.pillars.map((p) => `- ${p}`).join("\n")}

### ${IRON_LAW_BOOKS.title}
${IRON_LAW_BOOKS.pillars.map((p) => `- ${p}`).join("\n")}

### ${IRON_LAW_RHYTHM.title}
${IRON_LAW_RHYTHM.pillars.map((p) => `- ${p}`).join("\n")}
`;
}
