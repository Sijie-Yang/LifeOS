/**
 * 关系契合度：「约会对象」圈子里的联系人，每人一份 partnerProfile（存在 Contact.partnerProfile，JSON）。
 * 3 项底线（相处的基本前提）+ 4 项参考；每项 1–5 分，每个分数都有可判断的描述。
 * 评分只给自己看，描述的是「我们相处得怎么样」，不是给对方这个人打分；直觉仍然要听。
 */
export const PARTNER_CATEGORY = "约会对象";

export type PartnerStage = "met" | "chatting" | "first_date" | "dating" | "exclusive" | "closed";

export const PARTNER_STAGES: Array<{ key: PartnerStage; label: string; hint: string }> = [
  { key: "met", label: "刚认识", hint: "加了联系方式，还没怎么聊" },
  { key: "chatting", label: "线上聊天", hint: "持续在聊，还没见面" },
  { key: "first_date", label: "见过一次", hint: "见过面，在决定要不要继续" },
  { key: "dating", label: "多次约会", hint: "见过 2 次以上，在深入了解" },
  { key: "exclusive", label: "确定关系", hint: "双方都同意只和对方发展" },
  { key: "closed", label: "不再推进", hint: "任意一方不想继续；保留记录" },
];

export type PartnerCriterion = {
  key: string;
  label: string;
  /** 底线：必须 ≥ min */
  must: boolean;
  min: number;
  weight: number;
  /** 1–5 每个分数的含义 */
  scale: [string, string, string, string, string];
};

export const PARTNER_CRITERIA: PartnerCriterion[] = [
  {
    key: "respect", label: "相互尊重与边界", must: true, min: 4, weight: 1.5,
    scale: ["经常越界或不被尊重", "偶尔让人不舒服", "基本尊重，有些边界还没说清", "尊重彼此的时间、选择和边界", "边界清楚，说「不」也很安心"],
  },
  {
    key: "communication", label: "沟通", must: true, min: 3, weight: 1.5,
    scale: ["很难沟通，常常误解", "有分歧就回避或冷战", "一般，看话题和状态", "有分歧能好好说", "坦诚顺畅，难的话题也能就事论事"],
  },
  {
    key: "values", label: "价值观", must: true, min: 3, weight: 1.5,
    scale: ["核心价值观明显冲突", "差别较大，需要很大让步", "还没聊到，或一半一致", "大部分一致", "高度一致，彼此认同"],
  },
  {
    key: "lifestyle", label: "生活方式", must: false, min: 0, weight: 1,
    scale: ["作息、习惯、节奏很难兼容", "差别不小，需要不少磨合", "有差异但可以商量", "大体合拍", "非常合拍，在一起很自然"],
  },
  {
    key: "support", label: "相互支持", must: false, min: 0, weight: 1.5,
    scale: ["几乎没有回应彼此的需要", "支持多是单向的", "偶尔互相照顾", "需要时能互相支持", "稳定地互相支持，也都愿意付出"],
  },
  {
    key: "longTerm", label: "长期规划", must: false, min: 0, weight: 1,
    scale: ["对未来的打算根本冲突", "差别较大，还看不到交集", "还没聊到，或部分一致", "大方向一致", "能一起规划，步调一致"],
  },
  {
    key: "comfort", label: "相处感受", must: false, min: 0, weight: 1,
    scale: ["相处很累或紧张", "有点拘束", "还可以", "轻松愉快，愿意多见面", "很自在，相处让彼此都更好"],
  },
];

export type PartnerProfile = {
  stage: PartnerStage;
  /** criterion key → 1–5 */
  scores: Record<string, number>;
  /** 怎么认识的（渠道） */
  source: string | null;
  updatedAt: string | null;
  /** 总分历史（每次改分记一次，最多 30 条） */
  history: Array<{ date: string; total: number }>;
};

export const EMPTY_PROFILE: PartnerProfile = { stage: "met", scores: {}, source: null, updatedAt: null, history: [] };

export function parsePartnerProfile(value: unknown): PartnerProfile | null {
  let raw = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const scores: Record<string, number> = {};
  if (r.scores && typeof r.scores === "object") {
    for (const c of PARTNER_CRITERIA) {
      const v = (r.scores as Record<string, unknown>)[c.key];
      if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5) scores[c.key] = v;
    }
  }
  const stage = PARTNER_STAGES.some((s) => s.key === r.stage) ? (r.stage as PartnerStage) : "met";
  const history = Array.isArray(r.history)
    ? r.history
        .filter((h): h is { date: string; total: number } => !!h && typeof h.date === "string" && typeof h.total === "number")
        .slice(-30)
    : [];
  return {
    stage,
    scores,
    source: typeof r.source === "string" && r.source.trim() ? r.source.trim().slice(0, 80) : null,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : null,
    history,
  };
}

/** 加权总分 0–100（只算已打分的项）；一项都没打返回 null */
export function partnerTotal(scores: Record<string, number>): number | null {
  let sum = 0;
  let weight = 0;
  for (const c of PARTNER_CRITERIA) {
    const v = scores[c.key];
    if (v == null) continue;
    sum += c.weight * ((v - 1) / 4);
    weight += c.weight;
  }
  return weight ? Math.round((sum / weight) * 100) : null;
}

export type MustStatus = { state: "pass" | "fail" | "pending"; failed: string[]; missing: string[] };

/** 底线：全部达标 = pass；有不达标 = fail；还有没打分的 = pending */
export function partnerMust(scores: Record<string, number>): MustStatus {
  const failed: string[] = [];
  const missing: string[] = [];
  for (const c of PARTNER_CRITERIA) {
    if (!c.must) continue;
    const v = scores[c.key];
    if (v == null) missing.push(c.label);
    else if (v < c.min) failed.push(c.label);
  }
  return { state: failed.length ? "fail" : missing.length ? "pending" : "pass", failed, missing };
}

/** 存之前规整：补 updatedAt，总分变了就记一条历史 */
export function nextPartnerProfile(prev: PartnerProfile | null, patch: Partial<PartnerProfile>, today: string): PartnerProfile {
  const base = prev ?? EMPTY_PROFILE;
  const merged = parsePartnerProfile({ ...base, ...patch }) ?? EMPTY_PROFILE;
  const total = partnerTotal(merged.scores);
  const history = [...base.history];
  if (total != null && history.at(-1)?.total !== total) {
    if (history.at(-1)?.date === today) history[history.length - 1] = { date: today, total };
    else history.push({ date: today, total });
  }
  return { ...merged, updatedAt: today, history: history.slice(-30) };
}
