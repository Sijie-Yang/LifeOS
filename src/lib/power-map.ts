/**
 * Pfeffer-style academic power map for LifeOS.
 * Distinct from daily「九力」(`life-powers.ts`).
 */

export const POWER_AXES = [
  {
    id: "funding",
    label: "资金",
    hint: "谁控制奖学金、RA、项目钱、会议 travel",
  },
  {
    id: "authorship",
    label: "署名",
    hint: "谁决定作者序、是否挂名、是否放进主文",
  },
  {
    id: "opportunity",
    label: "机会",
    hint: "intern / postdoc / faculty / intro 的入口",
  },
  {
    id: "channel",
    label: "渠道",
    hint: "媒体、会议、社区、转介链路",
  },
  {
    id: "reputation",
    label: "声誉",
    hint: "谁的背书能改变别人对你的定位",
  },
] as const;

export type PowerAxisId = (typeof POWER_AXES)[number]["id"];

export const POWER_ROLES = [
  {
    id: "sponsor",
    label: "赞助人",
    color: "bg-amber-100 text-amber-900 border-amber-200",
    hint: "直接控制你的资源与可见度；必须维护、必须对齐叙事",
  },
  {
    id: "gatekeeper",
    label: "守门人",
    color: "bg-violet-100 text-violet-900 border-violet-200",
    hint: "打开/关闭具体入口：招聘、媒体、论坛、转介",
  },
  {
    id: "mentor",
    label: "顾问导师",
    color: "bg-indigo-100 text-indigo-900 border-indigo-200",
    hint: "不直接管你，但能给方向、声誉与弱连接",
  },
  {
    id: "ally",
    label: "盟友同行",
    color: "bg-emerald-100 text-emerald-900 border-emerald-200",
    hint: "对等互助：互荐、共写、信息交换",
  },
  {
    id: "rising",
    label: "可帮之人",
    color: "bg-sky-100 text-sky-900 border-sky-200",
    hint: "你已投入善意；日后可能成为渠道或盟友",
  },
  {
    id: "peer",
    label: "圈层同伴",
    color: "bg-zinc-100 text-zinc-700 border-zinc-200",
    hint: "同阶段网络密度；续温即可，不充当主航道",
  },
] as const;

export type PowerRoleId = (typeof POWER_ROLES)[number]["id"];

export type PowerGap = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium";
  detail: string;
  action: string;
  href?: string;
};

export type PowerEffort = {
  id: string;
  title: string;
  why: string;
  actions: string[];
  href?: string;
};

/**
 * Curated overrides for known nodes (name substring match).
 * 以下均为虚构示例：把 match 改成你联系人库里的名字（子串匹配），并写下你自己的备注。
 */
export const KNOWN_POWER_NODES: Array<{
  match: string;
  roles: PowerRoleId[];
  axes: PowerAxisId[];
  note: string;
  /** Aligns with north star? */
  alignment: "core" | "support" | "backup" | "drift";
}> = [
  {
    match: "示例导师",
    roles: ["sponsor"],
    axes: ["funding", "authorship", "opportunity", "reputation", "channel"],
    note: "（示例）直接导师/主管。阶段成果交付后，主动对齐下一阶段方向；对外曝光提前同步。",
    alignment: "core",
  },
  {
    match: "示例顾问",
    roles: ["mentor"],
    axes: ["reputation", "channel", "opportunity"],
    note: "（示例）领域内资深前辈；弱连接与声誉，偶尔请教方向，不高频请托。",
    alignment: "support",
  },
  {
    match: "示例招聘官",
    roles: ["gatekeeper"],
    axes: ["opportunity", "channel"],
    note: "（示例）目标机构的招聘/项目入口；只在有成果时推进，材料一次给齐。",
    alignment: "core",
  },
  {
    match: "示例编辑",
    roles: ["gatekeeper"],
    axes: ["channel", "reputation"],
    note: "（示例）媒体/社区渠道；公开露脸前先同步赞助人。",
    alignment: "support",
  },
  {
    match: "示例同行",
    roles: ["ally"],
    axes: ["opportunity", "channel"],
    note: "（示例）同阶段盟友：互荐、交换信息与模板，对等互助。",
    alignment: "support",
  },
  {
    match: "示例学弟",
    roles: ["rising"],
    axes: ["channel"],
    note: "（示例）你在给建议的后辈；先投入善意，不急于请托。",
    alignment: "support",
  },
  {
    match: "示例备选机构",
    roles: ["gatekeeper"],
    axes: ["opportunity"],
    note: "（示例）备选路径的入口；只跟已发出的球，不新开大线。",
    alignment: "backup",
  },
];

export function findKnownNode(name: string) {
  return KNOWN_POWER_NODES.find((n) => name.includes(n.match));
}

export function roleMeta(id: PowerRoleId) {
  return POWER_ROLES.find((r) => r.id === id)!;
}

export function axisMeta(id: PowerAxisId) {
  return POWER_AXES.find((a) => a.id === id)!;
}

/** Static effort directions（通用示例，可按你的北极星改写）. */
export function defaultPowerEfforts(activePhaseTitle?: string | null): PowerEffort[] {
  return [
    {
      id: "sponsor-align",
      title: "对齐赞助人叙事",
      why: "赞助人控制资金、署名、机会与曝光。当前阶段成果交付后，要把下一阶段方向讲清楚。",
      actions: [
        "先兑现：把当前阶段的核心交付物按期完成",
        "准备 5 分钟叙事：你现在做什么 → 下一阶段想往哪走",
        "对外曝光（演讲/采访/发布）当天同步赞助人",
      ],
      href: "/contacts",
    },
    {
      id: "scarce-value",
      title: "堆稀缺价值（不是堆人脉密度）",
      why: "权力来自别人需要你。稀缺物是可演示的能力与产出，不是更多泛泛的续温。",
      actions: [
        "每天固定 1–1.5h 深度学习/刻意练习",
        "用目标领域的词汇重写你的项目介绍",
        "准备一个可演示的 demo / 作品集条目",
      ],
      href: "/strategy",
    },
    {
      id: "fill-gap",
      title: "补目标领域的权力节点",
      why: "关系网常常集中在现有圈子；想去的方向上的节点可能接近空白。",
      actions: [
        "列出 5 个目标领域可接触的人（校友、会议、社区）",
        "每条写：你能提供的稀缺价值 + 下一步（续温/具体问题）",
        "跟踪 1–2 个跳板机会窗口（实习、项目、岗位）",
      ],
      href: "/opportunities",
    },
    {
      id: "backup-cap",
      title: "Backup 路径封顶投入",
      why: "备选路径是保险，不是北极星。投入过多会稀释主航道。",
      actions: [
        "备选机会：只跟进已发出的球，不新开大线",
        "已承诺的交付按约完成，不升级成主叙事",
        "决策滤镜：不让我更接近北极星 → 降权",
      ],
      href: "/opportunities",
    },
  ].map((e) =>
    activePhaseTitle
      ? { ...e, why: `${e.why}（当前阶段：${activePhaseTitle}）` }
      : e
  );
}

export function diagnosePowerGaps(input: {
  hasSponsor: boolean;
  axisCoverage: Record<PowerAxisId, number>;
  physicalAiNodes: number;
  backupHeavy: boolean;
  overdueSponsors: number;
}): PowerGap[] {
  const gaps: PowerGap[] = [];

  if (!input.hasSponsor) {
    gaps.push({
      id: "no-sponsor",
      title: "缺少明确赞助人",
      severity: "critical",
      detail: "没有人同时控制你的资源与可见度时，努力很难变成机会。",
      action: "确认 PI/导师为赞助人，并提高维护优先级",
      href: "/contacts",
    });
  }

  if (input.overdueSponsors > 0) {
    gaps.push({
      id: "sponsor-cold",
      title: "赞助人关系偏冷/超期",
      severity: "critical",
      detail: "赞助人续温失败的代价高于普通联系人一个数量级。",
      action: "本周内用进展回报（非空续温）对齐一次",
      href: "/contacts",
    });
  }

  if (input.physicalAiNodes === 0) {
    gaps.push({
      id: "no-physical-ai",
      title: "目标领域圈层为空",
      severity: "high",
      detail: "现有网络能帮你在当前圈子更强，但很难打开目标领域的门。",
      action: "本月新增 ≥2 个目标领域可联系节点（标签加「主航道」）",
      href: "/opportunities",
    });
  }

  const weakAxes = POWER_AXES.filter((a) => (input.axisCoverage[a.id] ?? 0) === 0);
  if (weakAxes.length) {
    gaps.push({
      id: "weak-axes",
      title: `权力轴未覆盖：${weakAxes.map((a) => a.label).join("·")}`,
      severity: "medium",
      detail: "五轴中有空档时，单点突破容易被卡在下游。",
      action: "为每个空轴指定 1 个关键人 + 你能提供的价值",
    });
  }

  if (input.backupHeavy) {
    gaps.push({
      id: "backup-drift",
      title: "Backup 机会占用过多注意力",
      severity: "medium",
      detail: "备选线活跃度高于主航道跳板时，叙事会被拉回旧定位。",
      action: "Active 机会里标出「主航道 vs backup」，backup 只跟球不新开",
      href: "/opportunities",
    });
  }

  return gaps;
}

export const POWER_SOP =
  "产价值 → 定靶 → 出招 → 收结果 → 记账更新 → 再出招";

/** 六种权力行动：人设定位必须落到其中一种，否则只是地图。 */
export const POWER_ACTIONS = [
  {
    id: "presence",
    label: "续温",
    verb: "出现",
    color: "bg-sky-100 text-sky-900",
    meaning: "进入对方注意力，不索取。默认动作。",
    result: "温度↑、不被遗忘、球还在你这边时可再跟",
    when: "关系冷了 / 还没资格提案 / 对方刚主动过需要跟上",
    logAs: "connect",
  },
  {
    id: "give",
    label: "投放",
    verb: "先给",
    color: "bg-emerald-100 text-emerald-900",
    meaning: "交出稀缺价值：进展、模板、intro、反馈、demo。",
    result: "互惠账户↑、依赖萌芽、下次推进更轻",
    when: "你有可交付物；或要对齐赞助人前先兑现",
    logAs: "update",
  },
  {
    id: "align",
    label: "对齐",
    verb: "改叙事",
    color: "bg-violet-100 text-violet-900",
    meaning: "改对方对你的定位（旧标签 → 新方向）。",
    result: "声誉轴位移；后续机会按新标签分配",
    when: "赞助人/顾问仍用旧尺子看你；有阶段性成果可挂新叙事",
    logAs: "update",
  },
  {
    id: "advance",
    label: "推进",
    verb: "跟球/有界请托",
    color: "bg-amber-100 text-amber-900",
    meaning: "把机会往前推一格：回复、材料、intro、约时间。有边界。",
    result: "机会状态前进；守门开/关变得明确",
    when: "关系够热或球在你手里；请托必须 bounded",
    logAs: "specific",
  },
  {
    id: "visibility",
    label: "可见",
    verb: "公开露脸",
    color: "bg-rose-100 text-rose-900",
    meaning: "媒体、演讲、公开产物改变第三方对你的看法。",
    result: "渠道+声誉↑；必须同步赞助人，否则变风险",
    when: "有可展示资产；且赞助人已知情",
    logAs: "trigger",
  },
  {
    id: "cap",
    label: "封顶",
    verb: "停加码",
    color: "bg-zinc-200 text-zinc-800",
    meaning: "对 backup/drift 明确不再投入新筹码，只跟已发出的球。",
    result: "注意力回到主航道；防止叙事被拉回",
    when: "Backup 机会过多；或决策滤镜判定「不靠近北极星」",
    logAs: "connect",
  },
] as const;

export type PowerActionId = (typeof POWER_ACTIONS)[number]["id"];

/** 闭环五步：缺一步就变「社交忙碌」。 */
export const POWER_LOOP = [
  {
    step: 1,
    id: "produce",
    label: "产价值",
    detail: "做出别人需要的稀缺物（作品/demo/可转介资产）。没这个，后面全是空转。",
  },
  {
    step: 2,
    id: "target",
    label: "定靶",
    detail: "选角色 × 轴：对谁出手、动资金/署名/机会/渠道/声誉哪一根。",
  },
  {
    step: 3,
    id: "act",
    label: "出招",
    detail: "六选一：续温 / 投放 / 对齐 / 推进 / 可见 / 封顶。一次一事。",
  },
  {
    step: 4,
    id: "capture",
    label: "收结果",
    detail: "只认可观测结果：承诺、intro、状态变更、叙事原话、明确拒绝。",
  },
  {
    step: 5,
    id: "update",
    label: "记账→再出招",
    detail: "写 contact log + 更新机会/地图；按结果选下一招（热→推进，冷→续温，偏→封顶）。",
  },
] as const;

/** 角色 → 主招 / 期望结果 / 禁止空转 */
export const ROLE_PLAYBOOK: Record<
  PowerRoleId,
  {
    primary: PowerActionId[];
    secondary: PowerActionId[];
    expect: string;
    avoid: string;
  }
> = {
  sponsor: {
    primary: ["give", "align", "advance"],
    secondary: ["presence", "visibility"],
    expect: "资金/署名/机会开门；对外叙事与你一致",
    avoid: "只报喜不报忧；媒体可见却不同步",
  },
  gatekeeper: {
    primary: ["advance", "presence"],
    secondary: ["give"],
    expect: "入口开/关明确；deadline 与材料清单清楚",
    avoid: "无成果空套；并行开太多入口",
  },
  mentor: {
    primary: ["presence", "align"],
    secondary: ["give"],
    expect: "弱连接+定位建议；偶发转介",
    avoid: "高频请托；把顾问当赞助人用",
  },
  ally: {
    primary: ["give", "advance"],
    secondary: ["presence"],
    expect: "互荐、信息、共谋；对等交换",
    avoid: "只取不给；把盟友当下属",
  },
  rising: {
    primary: ["give"],
    secondary: ["presence"],
    expect: "善意账户→未来渠道期权",
    avoid: "立刻请托；投入超过主航道",
  },
  peer: {
    primary: ["presence"],
    secondary: ["give"],
    expect: "圈层温度；非主航道",
    avoid: "把同伴续温当成权力主线",
  },
};

export type PowerPlay = {
  id: string;
  action: PowerActionId;
  targetName: string;
  targetRole: PowerRoleId;
  targetId?: string;
  move: string;
  expect: string;
  capture: string;
  nextIfYes: string;
  nextIfNo: string;
  href?: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
};

export function actionMeta(id: PowerActionId) {
  return POWER_ACTIONS.find((a) => a.id === id)!;
}

/** 把当前地图编成可执行出招（闭环第 2–4 步）。 */
export function composePowerPlays(input: {
  nodes: Array<{
    id: string;
    name: string;
    roles: PowerRoleId[];
    alignment: "core" | "support" | "backup" | "drift";
    overdue: boolean;
    note: string;
  }>;
  opportunities: Array<{
    id: string;
    title: string;
    status: string;
    nextAction: string | null;
    alignment: "core" | "support" | "backup" | "drift";
    contactNames: string[];
  }>;
  gaps: PowerGap[];
  activePhaseTitle?: string | null;
}): PowerPlay[] {
  const plays: PowerPlay[] = [];
  const sponsor = input.nodes.find((n) => n.roles.includes("sponsor"));

  // 1) Always: produce scarce value (no person target)
  plays.push({
    id: "produce-wm",
    action: "give",
    targetName: "（资产，非人）",
    targetRole: "sponsor",
    move: input.activePhaseTitle
      ? `本周产价值：推进「${input.activePhaseTitle}」的核心交付（可给赞助人看的进展）`
      : "本周产价值：可演示的进展（笔记、作品、demo 规格）",
    expect: "手里有「可投放」的筹码，后面续温/对齐才不是空话",
    capture: "本周可展示产物清单（文件/段落/录屏）",
    nextIfYes: "用产物对赞助人做「投放」或「对齐」",
    nextIfNo: "减少社交出招，先补产物 —— 否则闭环断在第一步",
    href: "/strategy",
    priority: "HIGH",
  });

  // 2) Sponsor loop
  if (sponsor) {
    plays.push({
      id: `sponsor-give-${sponsor.id}`,
      action: "give",
      targetName: sponsor.name,
      targetRole: "sponsor",
      targetId: sponsor.id,
      move: "投放：用具体进展回报（交付物/已承诺事项），不空续温",
      expect: "赞助人感到你可控、可预期；互惠账户↑",
      capture: "对方回复 / 开会时间 / 对进展的原话评价",
      nextIfYes: "对齐：5 分钟讲清下一阶段方向",
      nextIfNo: "降频但不断线；下次只带更硬的产物再投放",
      href: `/contacts?id=${sponsor.id}`,
      priority: "HIGH",
    });
    plays.push({
      id: `sponsor-align-${sponsor.id}`,
      action: "align",
      targetName: sponsor.name,
      targetRole: "sponsor",
      targetId: sponsor.id,
      move: "对齐：明确「当前阶段之后的主叙事」，征求对方的顾虑",
      expect: "声誉轴位移；后续机会按新标签分配",
      capture: "对方是否用新词汇复述你 / 是否提出约束条件",
      nextIfYes: "推进：请对方开门（intro、推荐信时机、机会窗口）",
      nextIfNo: "继续产价值 + 投放，暂不硬推 pivot",
      href: `/contacts?id=${sponsor.id}`,
      priority: "HIGH",
    });
  }

  // 3) Active opportunity advances / caps
  for (const opp of input.opportunities.filter((o) => o.status === "Active").slice(0, 5)) {
    if (opp.alignment === "backup" || opp.alignment === "drift") {
      plays.push({
        id: `cap-${opp.id}`,
        action: "cap",
        targetName: opp.contactNames[0] || opp.title,
        targetRole: "gatekeeper",
        move: `封顶：${opp.title} — 只跟已发出的球，不新开材料/新线`,
        expect: "Backup 不吞噬主航道注意力",
        capture: "本周是否零新增投入（是/否）",
        nextIfYes: "把省下的时间用于产价值或赞助人对齐",
        nextIfNo: "写进周复盘：哪次又加码了，下周强制封顶",
        href: "/opportunities",
        priority: "MEDIUM",
      });
    } else {
      plays.push({
        id: `adv-${opp.id}`,
        action: "advance",
        targetName: opp.contactNames[0] || opp.title,
        targetRole: "gatekeeper",
        move: `推进：${opp.nextAction || opp.title}`,
        expect: "机会前进一格或明确关闭",
        capture: "状态变更 / 对方回复 / deadline 确认",
        nextIfYes: "若涉及公开可见 → 先同步赞助人再「可见」",
        nextIfNo: "续温一次后停；不要连续空催",
        href: "/opportunities",
        priority: opp.alignment === "core" ? "HIGH" : "MEDIUM",
      });
    }
  }

  // 4) Gap: fill target-field nodes
  if (input.gaps.some((g) => g.id === "no-physical-ai")) {
    plays.push({
      id: "fill-physical-ai",
      action: "presence",
      targetName: "（待建节点）目标领域圈",
      targetRole: "mentor",
      move: "定靶缺口：列出 3–5 个目标领域可触点，每人写「我能给什么」后才续温",
      expect: "地图上出现真实的目标领域节点（不是旧圈子转注）",
      capture: "联系人库新增 ≥2 人 + 首条 log",
      nextIfYes: "对其中最热的 1 人「投放」小价值（问题质量/共享笔记）",
      nextIfNo: "降低旧圈子续温剂量，把配额挪到找节点",
      href: "/contacts",
      priority: "HIGH",
    });
  }

  // 5) Rising / ally give if overdue warmth needed
  const rising = input.nodes.filter((n) => n.roles.includes("rising")).slice(0, 2);
  for (const n of rising) {
    plays.push({
      id: `rising-${n.id}`,
      action: n.overdue ? "presence" : "give",
      targetName: n.name,
      targetRole: "rising",
      targetId: n.id,
      move: n.overdue
        ? `续温：${n.name} — 轻量跟上，不请托`
        : `投放：兑现已承诺（建议/资料/引荐），记账`,
      expect: "善意账户↑；未来渠道期权",
      capture: "发出记录 + 对方是否再主动",
      nextIfYes: "保持低剂量；对方主动时立刻跟上",
      nextIfNo: "封顶该线，不追加",
      href: `/contacts?id=${n.id}`,
      priority: "LOW",
    });
  }

  // de-dupe by id, cap list
  const seen = new Set<string>();
  return plays.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}
