export type ChecklistCategory = "travel" | "approach" | "paper" | "project" | "clean" | "other";

export type ChecklistItemDef = {
  id: string;
  text: string;
  group?: string;
};

export type ChecklistRunItem = ChecklistItemDef & {
  done: boolean;
  doneAt?: string | null;
};

export const CHECKLIST_CATEGORIES: Array<{
  id: ChecklistCategory;
  label: string;
  description: string;
  color: string;
}> = [
  {
    id: "travel",
    label: "旅游",
    description: "每次出行开一份；历史可回看",
    color: "#0ea5e9",
  },
  {
    id: "approach",
    label: "表达好感",
    description: "每次靠近/表达开一份；准备 → 行动 → 复盘",
    color: "#ec4899",
  },
  {
    id: "paper",
    label: "论文",
    description: "每篇/每轮投稿开一份",
    color: "#8b5cf6",
  },
  {
    id: "project",
    label: "项目",
    description: "每个项目阶段开一份",
    color: "#f59e0b",
  },
  {
    id: "clean",
    label: "全屋整理",
    description: "家是容器：让多余的离开，不是买盒子；每次开一份",
    color: "#10b981",
  },
  {
    id: "other",
    label: "其他",
    description: "自定义",
    color: "#71717a",
  },
];

export function checklistCategoryMeta(id: string) {
  return (
    CHECKLIST_CATEGORIES.find((c) => c.id === id) ??
    CHECKLIST_CATEGORIES.find((c) => c.id === "other")!
  );
}

export function parseChecklistItems(raw: string | null | undefined): ChecklistItemDef[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as ChecklistItemDef[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function parseChecklistRunItems(raw: string | null | undefined): ChecklistRunItem[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as ChecklistRunItem[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function snapshotRunItems(items: ChecklistItemDef[]): ChecklistRunItem[] {
  return items.map((i) => ({ ...i, done: false, doneAt: null }));
}

export function runProgress(items: ChecklistRunItem[]) {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

function item(group: string, text: string, i: number): ChecklistItemDef {
  return { id: `${group}-${i}`, text, group };
}

/** One template per category (category === template). */
export const DEFAULT_CHECKLIST_TEMPLATES: Array<{
  category: ChecklistCategory;
  title: string;
  description: string;
  color: string;
  sortOrder: number;
  items: ChecklistItemDef[];
}> = [
  {
    category: "travel",
    title: "旅游",
    description: "每次出行开一份；历史可回看漏带了什么",
    color: "#0ea5e9",
    sortOrder: 0,
    items: [
      item("证件钱", "护照 / 签证 / 身份证在有效期内", 1),
      item("证件钱", "行程单 / 酒店确认 / 电子票下载离线", 2),
      item("证件钱", "现金 + 主卡 + 备用卡分开放", 3),
      item("装备", "充电器 / 充电宝 / 转接头", 4),
      item("装备", "常用药 + 创可贴", 5),
      item("装备", "换洗衣物按天数 + 一套备用", 6),
      item("出发前", "停订阅 / 垃圾袋 / 电器断电（若离家久）", 7),
      item("出发前", "告诉 1 个紧急联系人行程", 8),
      item("当地", "交通卡 / 上网（eSIM 或漫游）就绪", 9),
      item("回来后", "收据入账 / 洗晒行李 / 三句话复盘", 10),
    ],
  },
  {
    category: "approach",
    title: "表达好感",
    description: "诚实、具体、可接受拒绝；每次互动开一份",
    color: "#ec4899",
    sortOrder: 0,
    items: [
      item("准备", "写清：我欣赏 TA 什么（具体行为，不是空泛夸）", 1),
      item("准备", "确认自己状态 OK（精力 ≥ 3，不是一时冲动）", 2),
      item("准备", "定一个低压力场景（咖啡 / 走路 / 短聊）", 3),
      item("准备", "想好开场 1 句 + 若冷淡如何体面收场", 4),
      item("行动", "主动约时间（给具体选项，不「有空吗」）", 5),
      item("行动", "当面或语音表达兴趣（避免只靠文字试探）", 6),
      item("行动", "尊重 TA 的边界；不说服、不连环追问", 7),
      item("行动", "无论结果：感谢时间，不贬低自己", 8),
      item("复盘", "记下：我说了什么 / TA 怎么回应 / 我学到什么", 9),
      item("复盘", "若拒绝：24h 内不反复联系；回到自己的生活节奏", 10),
    ],
  },
  {
    category: "paper",
    title: "论文",
    description: "写作推进 + 投稿收口；每篇/每轮开一份",
    color: "#8b5cf6",
    sortOrder: 0,
    items: [
      item("故事", "一句话贡献（对谁、解决什么、新在哪）", 1),
      item("故事", "图表清单定稿（每张图服务哪个 claim）", 2),
      item("写作", "Introduction 贡献段写清", 3),
      item("写作", "Method 可复现 + 1 张总览图", 4),
      item("写作", "Related Work 收成对话，不堆引用", 5),
      item("写作", "主实验表 + 必要 ablation", 6),
      item("写作", "Discussion：局限 + 未来 3 点", 7),
      item("合规", "作者/单位/致谢/利益冲突核对", 8),
      item("合规", "格式/页数/匿名要求（若双盲）", 9),
      item("收尾", "全文朗读改中式英语；合作者意见收齐", 10),
      item("收尾", "Supplementary + 代码/数据链接就绪", 11),
      item("提交", "Cover letter / 推荐审稿人（若需要）", 12),
      item("提交", "最终 PDF + 字体嵌入 + 提交截图存档", 13),
    ],
  },
  {
    category: "project",
    title: "项目",
    description: "开题定义 + 本周推进；每个阶段开一份",
    color: "#f59e0b",
    sortOrder: 0,
    items: [
      item("定义", "成功长什么样（可验证交付物）", 1),
      item("定义", "非目标写清楚（这次不做啥）", 2),
      item("计划", "拆成 ≤7 个可打勾步骤", 3),
      item("计划", "标出唯一瓶颈（人/数据/算力/决策）", 4),
      item("资源", "需要谁（mentor / 合作者）已约或已写信", 5),
      item("本周", "写下本周唯一最重要交付", 6),
      item("本周", "至少 3 个深度块只做这一件事", 7),
      item("本周", "中间产物可见（图/表/PR/笔记）", 8),
      item("收口", "对照交付：完成 / 部分 / 未动", 9),
      item("收口", "写下下一步（具体到动作）+ 是否被外界打乱主线", 10),
    ],
  },
  {
    category: "clean",
    title: "全屋整理",
    description:
      "家是容器，容量由墙决定。整理是让东西离开，不是擦，也不是买盒子。这里是方法；今天清哪里看开工页「房间清洁度」",
    color: "#10b981",
    sortOrder: 0,
    items: [
      item("准备", "垃圾袋 + 捐赠箱就位。决定了立刻进箱，不设「待会再分」堆", 1),
      item("准备", "只动自己的容器；别人的抽屉不替他们判断", 2),
      item("准备", "从进门最先看见的地方开始（可见性）。脏衣进篮——那是琐事，不是整理", 3),
      item("五步", "垃圾：破的、过期的、明显垃圾。只抓看得到的，先不翻柜底", 4),
      item("五步", "容易的：已有家的现在送回家（椅背干净衣服挂回柜）", 5),
      item("五步", "废话：一眼「我为什么还留这个」进捐赠箱", 6),
      item("五步", "两问：我会先去哪找？我会想到自己已经有吗？没答案就捐", 7),
      item("五步", "让这个容器装得下：最喜欢的先放，满了就捐。不买新盒子", 8),
      item("去哪", "按开工页「房间清洁度」今天的分区任务走：乱的必做，中等顺手。分区在那边勾，这里只管方法", 9),
      item("离开", "捐赠箱满了或这次结束：带出门（想卖可以，前提是真的卖掉）", 15),
      item("离开", "垃圾袋出门。东西没离开屋，这一层就没变薄", 16),
      item("打扫", "东西离开后再擦拖看得见的地面/台面；不先整理就扫地 = 补作业（可跳过）", 17),
      item("收口", "看得见的地方比开始时空。更好就好；不要求一次清完全屋", 18),
    ],
  },
];
