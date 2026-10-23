/**
 * 30-year foresight timeline (2026–2056) — 可编辑的示例模板。
 *
 * 下面的内容是一个虚构的示例情景（一位普通知识工作者「小林」），只用来演示数据结构。
 * 世界情景是粗略的假设，不是预测；「you」部分请换成你自己的愿景、目标与准备清单。
 * 节点数量、年份区间都可以自由增删，页面与时间线会自动适配。
 */

export type PredictionArea = "econ" | "tech" | "geo";

export type YearPrediction = {
  /** Specific year or short range, e.g. "2027" / "2029–2030" */
  year: string;
  area: PredictionArea;
  text: string;
};

export type ForesightNode = {
  id: string;
  /** Display range, e.g. "2026–2028" */
  era: string;
  yearStart: number;
  yearEnd: number;
  phase: string;
  world: {
    economy: string;
    tech: string;
    geopolitics?: string;
  };
  /** Concrete year-tagged predictions within this era */
  predictions: YearPrediction[];
  you: {
    vision: string;
    goals: string[];
    prep: string[];
    entry: string;
    avoid: string;
  };
  confidence: "high" | "medium" | "low";
};

export const FORESIGHT_META = {
  title: "三十年前瞻",
  subtitle: "世界局势情景 × 你的最佳切入点（2026–2056）",
  northStar:
    "（示例）成为所在领域里能独立定义问题、带出团队的人，同时保有健康的身体、稳定的关系与自由支配的时间。",
  thesis: [
    "（示例）近 10 年：技能迭代快，能把新工具用进真实工作流的人议价权上升。",
    "（示例）10–20 年：从「做事的人」转向「定方向、带人的人」；积累可迁移的声誉与作品。",
    "（示例）20–30 年：稀缺的是信任、健康与问题定义权；把经验沉淀成可传承的东西。",
  ],
  disclaimer:
    "以下为虚构示例情景，仅演示结构，非预言。请在 src/lib/foresight-timeline.ts 中改成你自己的版本。",
};

export const FORESIGHT_NODES: ForesightNode[] = [
  {
    id: "2026-2030",
    era: "2026–2030",
    yearStart: 2026,
    yearEnd: 2030,
    phase: "打底 · 建立核心能力",
    confidence: "high",
    world: {
      economy: "（示例假设）增长分化，行业洗牌加速；稳定岗位减少，可证明的能力比履历更重要。",
      tech: "（示例假设）AI 助手普及到日常办公流程；会用工具是门槛，会定义问题才是优势。",
      geopolitics: "（示例假设）不确定性常态化；保持技能与人脉的可迁移性。",
    },
    predictions: [
      {
        year: "2027",
        area: "tech",
        text: "（示例）主流办公软件全面内置 AI 助手，重复性文书工作大幅减少。",
      },
      {
        year: "2028",
        area: "econ",
        text: "（示例）行业出现第一轮整合，小团队与独立工作者的比例上升。",
      },
    ],
    you: {
      vision: "（示例）从「执行者」成长为能独立负责一个方向的人。",
      goals: [
        "完成 1–2 个可以拿出来展示的代表作",
        "建立稳定的作息与运动习惯",
        "在目标领域认识 10 个可以互相帮忙的人",
      ],
      prep: [
        "每天固定一段深度学习时间",
        "每周复盘一次：做了什么、学到什么、下周最重要的一件事",
      ],
      entry: "（示例）最佳切入：在一个成长快的团队里承担完整项目，而不是只做零碎任务。",
      avoid: "（示例）同时开太多方向；用忙碌代替进展。",
    },
  },
  {
    id: "2031-2038",
    era: "2031–2038",
    yearStart: 2031,
    yearEnd: 2038,
    phase: "成形 · 从做事到带人",
    confidence: "medium",
    world: {
      economy: "（示例假设）自动化继续渗透，组织更扁平；复合型人才更受欢迎。",
      tech: "（示例假设）AI 能完成大部分标准化任务，人的价值转向判断、协作与创意。",
    },
    predictions: [
      {
        year: "2033",
        area: "tech",
        text: "（示例）多数团队形成「人 + AI 代理」的协作模式，管理方式随之改变。",
      },
    ],
    you: {
      vision: "（示例）成为一个小团队的负责人，或一个细分方向上被同行认可的人。",
      goals: ["带出 2–3 位能独当一面的同事", "形成可复用的方法论并公开分享"],
      prep: ["练习写作与公开表达", "维护好关键关系，不只在需要时才联系"],
      entry: "（示例）最佳切入：选一个长期看好的细分方向深耕，而不是追每一个热点。",
      avoid: "（示例）为短期收入牺牲长期积累；忽视身体与家庭。",
    },
  },
  {
    id: "2039-2047",
    era: "2039–2047",
    yearStart: 2039,
    yearEnd: 2047,
    phase: "放大 · 杠杆与影响力",
    confidence: "low",
    world: {
      economy: "（示例假设）财富与机会更多来自声誉、网络与资本，而不仅是劳动时间。",
      tech: "（示例假设）技术基础设施高度成熟，差异化来自问题选择与信任。",
    },
    predictions: [
      {
        year: "2040",
        area: "econ",
        text: "（示例）终身学习与职业转换成为常态，40 岁转型不再罕见。",
      },
    ],
    you: {
      vision: "（示例）用积累的声誉与网络放大影响：带团队、做投资或创办自己的项目。",
      goals: ["建立不依赖单一雇主的收入结构", "保持身体指标稳定"],
      prep: ["定期体检与运动", "把经验写成可传承的文字"],
      entry: "（示例）最佳切入：在熟悉的领域里做更大的事，而不是跳到完全陌生的赛道。",
      avoid: "（示例）用旧的成功经验套新问题；过度扩张。",
    },
  },
  {
    id: "2048-2056",
    era: "2048–2056",
    yearStart: 2048,
    yearEnd: 2056,
    phase: "传承 · 选择与留白",
    confidence: "low",
    world: {
      economy: "（示例假设）社会议题转向分配、信任与代际传递。",
      tech: "（示例假设）技术像水电一样普及，个人差异在于想过什么样的生活。",
    },
    predictions: [
      {
        year: "2050",
        area: "geo",
        text: "（示例）老龄化社会全面到来，健康与照护成为核心议题。",
      },
    ],
    you: {
      vision: "（示例）留下可传承的东西：带过的人、写下的方法、一个健康的身体和家庭。",
      goals: ["完成知识与责任的交接", "有足够的时间给家人与兴趣"],
      prep: ["主动做减法，退出只带来虚荣的事务", "记录与回顾，确认自己过的是想过的生活"],
      entry: "（示例）最佳抉择：拥有选择退出的自由。",
      avoid: "（示例）还用年轻时的 KPI 衡量自己。",
    },
  },
];

export function currentForesightNode(year = new Date().getFullYear()): ForesightNode {
  return (
    FORESIGHT_NODES.find((n) => year >= n.yearStart && year <= n.yearEnd) ??
    FORESIGHT_NODES[0]!
  );
}
