/**
 * Elon Musk behavioral compass for LifeOS.
 * Sources: public interviews, biographies (Vance / Isaacson), company talks, X posts.
 * Patterns are observed / self-reported — not medical diagnosis or moral endorsement.
 */

export type CompassStance = "adopt" | "adapt" | "reject";

export type CompassDimension = {
  id: string;
  title: string;
  /** What he actually does / is reported to do */
  pattern: string;
  /** Underlying personality / mechanism */
  mechanism: string;
  stance: CompassStance;
  /** Concrete LifeOS rule derived from this */
  lifeos: string;
  caution?: string;
};

export type CompassTrait = {
  trait: string;
  evidence: string;
};

export const MUSK_COMPASS_META = {
  title: "Musk 风向标",
  subtitle: "行为模式 → 性格机制 → LifeOS 该学 / 该改 / 该拒",
  thesis:
    "学他的算法与第一性原理，改他的时间密度与单线程，拒他的身体透支与关系崩坏。风向标不是复制人，是校准你该加速什么、该保护什么。",
  disclaimer:
    "以下为公开信息归纳的行为模型，非神化。他的产出依赖极端资源、极端体质波动与极端代价——你自己的铁律（如身体优先）应优先于任何风向标。",
};

/** Core personality traits (stable across domains) */
export const MUSK_TRAITS: CompassTrait[] = [
  {
    trait: "第一性原理偏执",
    evidence: "反复拆问题到物理/成本极限（火箭成本、电池、自动驾驶），拒绝类比推理当默认。",
  },
  {
    trait: "工程身份 > 商业身份",
    evidence: "自称「首席工程师」多于 CEO；用图纸、产线、代码开会，不靠 PPT 文化。",
  },
  {
    trait: "极端目标压缩时间",
    evidence: "公开设定「几乎不可能」的截止日期，用压力逼组织变形；常延期，但进度仍远超行业。",
  },
  {
    trait: "低社交润滑、高信息带宽",
    evidence: "不擅长小谈；沟通短、直、可转发（邮件/X）；冲突容忍度高，礼貌优先级低。",
  },
  {
    trait: "叙事即武器",
    evidence: "把公司故事绑到文明级使命（多行星、可持续能源、脑机），用叙事吸人才与资本。",
  },
  {
    trait: "情绪波动大、危机中加码",
    evidence: "公开承认抑郁/狂躁周期；公司危机时反而睡工厂、亲自改设计，用行动压焦虑。",
  },
  {
    trait: "所有权意识极强",
    evidence: "控制投票权、产品细节、品牌叙事；难以真正「放手」给职业经理人。",
  },
];

/** His published / recounted decision algorithm */
export const MUSK_ALGORITHM = [
  "质疑每一个要求——删掉所有非物理必需的部分",
  "删除流程与零件——若没人抱怨加回来，说明删得不够",
  "简化和优化（只在删除之后）",
  "加速周期时间",
  "自动化（最后才自动化——过早自动化是浪费）",
];

export const MUSK_DIMENSIONS: CompassDimension[] = [
  {
    id: "cognition",
    title: "认知与决策",
    pattern:
      "默认用物理/成本极限拆问题；开会要求「数字、图纸、原因」；讨厌模糊共识。重大赌注押在可验证的工程路径上（可复用火箭、4680、FSD 迭代）。",
    mechanism: "高系统化思维 + 低从众；把「别人怎么做」当成需要证伪的假设。",
    stance: "adopt",
    lifeos:
      "决策过滤器对齐：每个项目问「真正的瓶颈是什么 / 可删除什么 / 验证闭环在哪」。工作产出也用同一套：先删掉装饰性部分。",
  },
  {
    id: "learning",
    title: "学习习惯",
    pattern:
      "少年期大量读科幻与百科式非虚构；创业期靠「找领域最强的人问到懂」+ 自己读教材/论文到能画系统图。学习目标是建造，不是收藏知识点。",
    mechanism: "目的驱动的深度输入；信息只在能画成系统时才算学会。",
    stance: "adopt",
    lifeos:
      "与「一次读透一本」的习惯兼容：读到能画出系统图再换下一本。加人：每周找 1 个真正懂的人问透一个卡点（权力地图里的 mentor / ally）。",
  },
  {
    id: "venture",
    title: "创业 / 做事流程",
    pattern:
      "先定文明级目标 → 拆成可工程化的硬问题 → 垂直整合关键路径 → 用原型/产线快速迭代 → 公开里程碑压迫外部预期。多次并行公司，但每个危机时会单点沉入。",
    mechanism: "使命叙事吸资源；垂直整合降协调成本；公开 deadline 当外部约束。",
    stance: "adapt",
    lifeos:
      "你的版本：北极星 → 一个可验证的阶段成果 → 握住关键路径（数据、评估、交付）→ 公开里程碑（作品/开源/发布）。并行不超过 2 条主线。",
    caution: "他能并行靠的是已建成的组织与资本；资源有限的阶段应单线程收成。",
  },
  {
    id: "work",
    title: "工作时长与强度",
    pattern:
      "自述高峰期每周 80–100+ 小时；睡工厂、连轴改设计；用日历把白天切成微会议；深度工作常挤到深夜。把「在场」当领导力工具。",
    mechanism: "用极端时间换信息优势与控制感；身份与公司绑定。",
    stance: "adapt",
    lifeos:
      "学强度结构，不学时长数字：每天保护 1 块不可打断的深度工作；危机周可加码，默认周不是 100h。用「在关键路径上的小时」衡量，不是座位时间。",
    caution: "他的 100h 伴随后续身体与关系账单；长期目标需要你健康且头脑清楚。",
  },
  {
    id: "rest",
    title: "休息与睡眠",
    pattern:
      "长期睡眠短（常自述 ~6h，危机期更少）；用短暂断电式休息（工厂折叠床、飞机上睡）；娱乐多为游戏/X，而非真正恢复性休息。",
    mechanism: "把睡眠当可借贷资源；用刺激（游戏、冲突、发帖）代替恢复。",
    stance: "reject",
    lifeos:
      "作息规则优先：早睡 > 熬夜。睡眠是长期产出的本钱。若要对齐他，只对齐「休息也服务主线」（不刷碎片），不对齐剥夺睡眠。",
  },
  {
    id: "body",
    title: "身体与健康",
    pattern:
      "早期忽视运动与体检；后期有健身/减重阶段，用药与抗衰兴趣公开化；整体仍是「身体服务于任务」而非「任务服务于身体」。",
    mechanism: "工具化身体；年轻时透支，中年后用金钱补救。",
    stance: "reject",
    lifeos:
      "完全反转：身体优先（规律运动、基本卫生、定期体检）。这里他是负样本——你要比他更早把身体当成长期资本来经营。",
  },
  {
    id: "hygiene",
    title: "个人卫生与形象",
    pattern:
      "多段传记/报道提到高压期不修边幅、气味与睡眠卫生变差；公开场合形象两极：要么工程师邋遢，要么正式发布会精修。不把「体面」当日常 KPI。",
    mechanism: "注意力全给问题，社交信号被当成噪音删除。",
    stance: "adapt",
    lifeos:
      "学「删除无效体面」，不学「删除基本卫生」。日常保持体面底线（尤其会议/访客日）。忙的时候可以穿得简单，但不能邋遢到影响合作。",
    caution: "不修边幅在一些圈子被当成专注信号；在另一些场合更容易被读成不尊重。按场域切换。",
  },
  {
    id: "social",
    title: "社交习惯",
    pattern:
      "小圈子极铁（早期 PayPal 黑手党式），大社交极省；不擅长维持弱关系；冲突后很少花时间修复感受。用公开平台一对多，代替一对一维护。",
    mechanism: "带宽有限 → 只投资高杠杆人；一对多放大叙事。",
    stance: "adapt",
    lifeos:
      "权力地图版：sponsor / gatekeeper 深维护；弱关系用「有产出的公开物」（文章、作品、分享）代替无意义饭局。但多数场合仍需要最低社交润滑——批评对事、不对人格。",
  },
  {
    id: "comms",
    title: "表达与媒体",
    pattern:
      "极短邮件文化（「请说明原因」「删除此步骤」）；X 上高频、冲动、战争级传播；用 meme 与冲突换注意力。传统 PR 被他当成减速器。",
    mechanism: "注意力套利 + 真实/半真实人格人设。",
    stance: "adapt",
    lifeos:
      "学短、学具体、学公开节点；拒绝日常情绪化发帖消耗信誉。你的公开表达应是：可引用的作品、清晰的叙事、克制的行业发言。",
  },
  {
    id: "people",
    title: "用人与组织",
    pattern:
      "偏爱「硬核工程师」；大规模裁员与「打卡证明价值」式压力管理；对绩效极端透明，对感受极端钝感。留下能在压力下交付的人。",
    mechanism: "把组织当可控系统；优化产出密度，不优化幸福感。",
    stance: "adapt",
    lifeos:
      "未来带团队时：招能交付闭环的人；标准公开；但不复制羞辱式管理——长期产出需要人愿意留下来。",
  },
  {
    id: "money",
    title: "金钱与消费",
    pattern:
      "早期极度节省（共用办公/住办公室）；财富暴涨后仍常表现「对物质无感」，但会为产品与政治叙事一掷千金。金钱是燃料，不是记分板。",
    mechanism: "目标函数是使命与控制权，不是消费效用。",
    stance: "adopt",
    lifeos:
      "财务目标服务自由度与选择权，不服务炫耀。生活品质要够，但消费决策先问：是否增加主线自由度？",
  },
  {
    id: "family",
    title: "家庭与亲密关系",
    pattern:
      "多段婚姻/关系、多子女；公开承认工作常压过陪伴；亲密关系稳定性远低于事业稳定性。",
    mechanism: "同一带宽被公司占满；亲密关系变成残差。",
    stance: "reject",
    lifeos:
      "负样本。事业窗口期可以高强度，但不能把关系永久设为残差。窗口外要显式安排家庭与陪伴时间。",
  },
  {
    id: "crisis",
    title: "危机应对",
    pattern:
      "公司差点死掉时亲自上产线/睡工厂；对外叙事从不认输；对内极端砍成本。用可见的献身换团队与投资人信心。",
    mechanism: "领导力 = 承担最脏最难的那一段。",
    stance: "adopt",
    lifeos:
      "真正卡点（上线、交付、关键截止）时，亲自下场做最难的 20%，而不是只分配。平时仍靠系统，不靠表演性加班。",
  },
  {
    id: "focus",
    title: "注意力与成瘾物",
    pattern:
      "深度沉迷游戏、X、论战；用高强度刺激调节情绪。能同时维持多公司，部分靠把「切换上下文」本身当成刺激。",
    mechanism: "高刺激寻求；用外部冲突调节内部空虚/焦虑。",
    stance: "reject",
    lifeos:
      "减少短视频/信息流等碎片输入；游戏与论战不进日常。多巴胺应来自闭环推进与身体训练，不是信息战。",
  },
];

export const STANCE_META: Record<
  CompassStance,
  { label: string; className: string; hint: string }
> = {
  adopt: {
    label: "该学",
    className: "bg-emerald-100 text-emerald-800",
    hint: "直接写进 LifeOS 规则",
  },
  adapt: {
    label: "该改",
    className: "bg-amber-100 text-amber-900",
    hint: "学结构，改剂量与场域",
  },
  reject: {
    label: "该拒",
    className: "bg-rose-100 text-rose-800",
    hint: "明确列为负样本",
  },
};

/** One-page weekly checklist derived from compass */
export const MUSK_WEEKLY_CHECKS = [
  { q: "本周是否用第一性原理删掉过一个伪需求？", stance: "adopt" as CompassStance },
  { q: "是否完成一块不可打断的深工（建造/验证）？", stance: "adapt" as CompassStance },
  { q: "睡眠与运动的底线是否守住？（拒透支）", stance: "reject" as CompassStance },
  { q: "是否只对高杠杆的人做了深维护？", stance: "adapt" as CompassStance },
  { q: "公开物是否推进了一步（文章/基准/演示）？", stance: "adopt" as CompassStance },
  { q: "是否避免了情绪化对外输出与碎片成瘾？", stance: "reject" as CompassStance },
];
