/** 联系人维护原则与模板（页面 SOP / log 检查共用） */

/** 一眼原则：短到能背 */
export const CONTACT_SOP_SUMMARY = "续温 > 提案 · 先给后要 · 对方热你必须跟";

export const CONTACT_SOP_PILLARS = [
  "续温 > 提案",
  "先优点 · 先能给什么",
  "对方主动 → 你跟上（别掉球）",
  "完成 = 发出真实联系，不是拿到 yes",
] as const;

export const CONTACT_SOP_SECTIONS = [
  {
    title: "四句原则",
    lines: [...CONTACT_SOP_PILLARS],
  },
  {
    title: "发之前",
    lines: [
      "续温还是提案？（默认续温）",
      "点到对方优点了吗？我能给什么？",
      "球在谁手里？",
    ],
  },
  {
    title: "对方主动时",
    lines: [
      "快回 · 给下一步 · 兑现",
      "球在你手里不隔夜",
    ],
  },
  {
    title: "每周",
    lines: ["最多 3 人 · 先写优点/能给 · 续温发出 · 记 log"],
  },
] as const;

export type ContactLogReason = "connect" | "specific" | "update" | "trigger";

export const CONTACT_LOG_REASONS: Array<{
  key: ContactLogReason;
  label: string;
  hint: string;
  template: string;
}> = [
  {
    key: "connect",
    label: "续温 / Stay Connected",
    hint: "默认：点到对方优点，带一点可提供的实质",
    template:
      "续温：想到你在 [优点/优势/近况] 上的 [具体点]。分享/提供：[一条相关信息或小忙]。不求回复也 OK。",
  },
  {
    key: "specific",
    label: "有具体问题",
    hint: "bounded ask；关系热且你也带可交换价值时再用",
    template:
      "请教：[具体问题]。我已 [做过 A/B 功课]。若有用，我也可以 [提供的反馈/信息/小忙]。",
  },
  {
    key: "update",
    label: "有进展可回报",
    hint: "回报本身就是提供价值",
    template: "回报进展：关于 [话题]，目前 [进展]，感谢之前 [帮助/建议]。",
  },
  {
    key: "trigger",
    label: "有对方相关新事",
    hint: "先认可，再简短出现",
    template: "看到 [具体事件]，为你在 [优点/方向] 上的进展高兴；想到 [相关分享/可提供的一点]。",
  },
];

export const CONTACT_NOTES_TRIGGER_TEMPLATE = `待联系触发：
- 对方优点 / 优势（从哪出发）：
- 我能提供什么：
- 续温话题：
- 具体问题（可选，默认不做）：
- 上次未完线：`;

export function hasContactLogReason(reasons: Record<ContactLogReason, boolean>) {
  return reasons.connect || reasons.specific || reasons.update || reasons.trigger;
}

/** 机会页一眼原则 */
export const OPPORTUNITY_SOP_SUMMARY = "人先 · 窗口后 · 对方热你必须跟";

export const OPPORTUNITY_SOP_PILLARS = [
  "人先 · 窗口后",
  "Watching = 续温看见；Active = 有交换再推进",
  "对方主动 → 立刻跟上，别掉窗口",
  "拿不到就归档；别用狂发请托填空",
] as const;

export const OPPORTUNITY_SOP_SECTIONS = [
  {
    title: "四句原则",
    lines: [...OPPORTUNITY_SOP_PILLARS],
  },
] as const;

/** 认识新人 SOP：按对方相对你的位置分三种（向上 / 平级 / 向下），每种 4 步 + 一条 24 小时内发的模板 */
export type MeetDirection = "up" | "peer" | "down";

export const MEET_NEW_SOP: Array<{
  key: MeetDirection;
  label: string;
  who: string;
  /** 建议的联系频率（天），建联系人时填 */
  frequencyDays: number;
  steps: Array<{ when: string; what: string }>;
  template: string;
}> = [
  {
    key: "up",
    label: "向上",
    who: "教授、主编、大厂 leader、招聘方",
    frequencyDays: 60,
    steps: [
      { when: "见面前", what: "看对方 1 篇工作；备 1 个只有 TA 能答的问题 + 30 秒自我介绍（我做什么 · 和你哪里相关）" },
      { when: "见面时", what: "先问问题，不推销；结尾问「可以发邮件跟进吗」，拿到邮箱 / LinkedIn" },
      { when: "24 小时内", what: "感谢 + 引用 TA 说过的一句话 + 附 1 个对 TA 有用的东西；不提要求" },
      { when: "之后", what: "按 TA 的建议做了事就汇报一次（「按你说的做了 X」），之后 60–90 天续温" },
    ],
    template:
      "Dear [名字], thank you for your time today. Your point on [TA 说的具体一句] was really helpful — I'm now [我的下一步]. In case it's useful for [TA 的工作], here is [论文 / 链接]. Best, [你的名字]",
  },
  {
    key: "peer",
    label: "平级",
    who: "同届 PhD、同行、同龄从业者",
    frequencyDays: 30,
    steps: [
      { when: "见面前", what: "不用准备，记住多问一句「你最近在做什么」" },
      { when: "见面时", what: "找 1 个共同点（课题 / 城市 / 爱好），当场加微信或 LinkedIn" },
      { when: "24 小时内", what: "发一条：上次聊到的链接 / 照片 + 一个具体的约（咖啡、一起去活动）" },
      { when: "之后", what: "一起做一件小事（活动、读书会、互推机会）；30 天续温一次" },
    ],
    template: "今天聊得很开心！你说的 [X] 我找到了：[链接]。[下周几] 要不要一起 [咖啡 / 去 X]？",
  },
  {
    key: "down",
    label: "向下",
    who: "学生、学弟学妹、来找你指导的人",
    frequencyDays: 90,
    steps: [
      { when: "见面前", what: "不用准备" },
      { when: "见面时", what: "多听 5 分钟，问 TA 卡在哪；只给 1 个马上能做的建议" },
      { when: "24 小时内", what: "发 1 份资源（模板 / 论文 / 链接），说「做完发我看看」" },
      { when: "之后", what: "TA 真跟进了才继续投入；跟进的人可以转成长期学员或合作者。TA 找你就快回" },
    ],
    template: "很高兴认识！你说卡在 [卡点]，可以先看 [资源]，做完 [一小步] 发我看看。",
  },
];

/** 三种都一样的最后一步：当天记进 LifeOS */
export const MEET_NEW_RECORD =
  "当天建联系人：圈子 · 在哪认识 · TA 的一个特点 · 下次聊什么；填联系频率；写一条 log。";
