/**
 * User-facing copy that differs per person (labels, subtitles, example placeholders).
 * Neutral defaults; override by copying this file to private/src/lib/ui-copy.ts.
 * See docs/private-overlay.md.
 */
export const UI_COPY = {
  contacts: {
    partnerTab: "约会",
    schoolPlaceholder: "清华大学, NUS, MIT",
    schoolHint: "可填多个；清华 / Tsinghua 等会自动归一为「清华大学」",
    cityPlaceholder: "北京, 新加坡, 上海",
  },
  /** Prefix for urge-transfer entries in the day record. */
  urgeTransferLabel: "冲动转化",
  checklists: {
    scenePlaceholder: "场景备注，如：海边旅行 8 月 / 论文投稿",
  },
  foresight: {
    visionTitle: "30 年 Vision（示例模板 · 可编辑）",
    /** Footer around the `src/lib/foresight-timeline.ts` code chip. */
    footerBefore: "当前展示的是虚构示例情景。内容维护于 ",
    footerAfter: "，这是一个可编辑的模板：按同样的结构改写北极星、各阶段的世界情景与你的目标即可（节点可增删）。",
  },
  habits: {
    description: "铁律：身体优先 · 输入少而精 · 守住节奏｜今日打卡请去日计划",
  },
  reading: {
    description: "按优先级推进书 / 领域 / 信息源 · 铁律：输入少而精 · 一次深读一本",
    infoSourceExamples: "播客、访谈、讲座…",
  },
  library: {
    removeConfirm: "从文献库移除这条记录？（不会删除磁盘上的文件）",
    description: "书与论文分开展示 · 类别标签 · 文件在本地文献目录",
    relevancePlaceholder: "能进 Related Work / 改变方法 / 值得复现 …",
    pathPlaceholder: "例：my-topic/paper.pdf",
  },
  power: {
    coreNodesLabel: "主航道节点",
  },
  strategy: {
    description: "铁律在上：身体优先 · 输入少而精 · 守住节奏｜North Star · OS · 阶段路线",
    defaultSource: "AI 对话",
    sourcePlaceholder: "AI 对话 / 读书 / 复盘",
    allocationPlaceholder: "主线项目: 70%\n学习: 30%",
    tagsPlaceholder: "career\nhealth",
  },
};
