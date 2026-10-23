import { LIFE_OPPORTUNITY_CATEGORIES, OPPORTUNITY_CATEGORIES } from "@/lib/utils";

/** 机会板的两条车道文案，机会页、Networking 页和全局快速弹窗共用 */
export const OPPORTUNITY_BOARD_PRESETS = {
  career: {
    title: "机会",
    description: "人先 · 窗口后 · 对方热你必须跟",
    createLabel: "新建机会",
    emptyTitle: "暂无机会",
    emptyDescription: "记录 offer、合作、资助、借机等窗口；填 DDL 即可进时间线",
    categories: OPPORTUNITY_CATEGORIES,
    defaultCategory: "Other",
    titlePlaceholder: "例：暑期实习回流 / 合作方联合 PoC",
    sourcePlaceholder: "引荐 / 邮件 / 会议 / 公开 call",
    nextActionPlaceholder: "最小一步：发邮件 / 约 20min / 准备一页纸",
    notesPlaceholder: "窗口条件、风险、为什么值得推进…",
  },
  life: {
    title: "业余 Networking",
    description: "丰富业余生活的局 · 人 · 场域 — 与职业机会分开记",
    createLabel: "新建一局",
    emptyTitle: "暂无局",
    emptyDescription: "记录想参加或正在推进的生活向局：饭局、运动、社群、文化活动…",
    categories: LIFE_OPPORTUNITY_CATEGORIES,
    defaultCategory: "Social",
    titlePlaceholder: "例：读书会 / 周末骑行小队",
    sourcePlaceholder: "朋友 / 小红书 / 社群 / 偶遇",
    nextActionPlaceholder: "最小一步：回消息 / 约时间 / 报名",
    notesPlaceholder: "为什么想去、和谁、氛围、下次怎么跟…",
    accentClassName: "hover:border-emerald-200",
  },
} as const;
