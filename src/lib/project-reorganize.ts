/**
 * Parse Obsidian-style project descriptions into milestones, habits, and a short summary.
 */

export type ParsedMilestone = {
  title: string;
  dueDate: string | null;
  completed: boolean;
};

export type ParsedHabit = {
  name: string;
  description: string | null;
  frequency: "DAILY" | "WEEKLY";
};

export type ReorganizePlan = {
  milestones: ParsedMilestone[];
  habits: ParsedHabit[];
  simplifiedDescription: string | null;
};

const EMPTY_TEMPLATE =
  /^##\s*目标\s*[\s|]*##\s*下一步\s*[\s|]*##\s*备注\s*$/i;

function stripFrontmatter(text: string): string {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

function stripWikilinks(text: string): string {
  return text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, (_, p: string) => p.split("/").pop()?.replace(/\.md$/, "") || p)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function sanitizeText(text: string): string {
  return text.replace(/[\uD800-\uDFFF\uFFFD]/g, "").trim();
}

function cleanInline(text: string): string {
  return sanitizeText(
    stripWikilinks(text)
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[🛫⏳⏫📅✅🔁⏸️▶️]/g, "")
      .replace(/\*\*/g, "")
      .replace(/\s+/g, " ")
  );
}

function isValidMilestoneTitle(title: string): boolean {
  if (title.length < 4 || title.length > 200) return false;
  if (/^(块|步|项|标记|优先级|维度|来源|账号|Core theme|Title|Visual|Noise)/i.test(title)) return false;
  if (/^(周|月|季|年)[：:]/.test(title)) return false;
  if (/Log\/\d{4}|2026-Week|与.*对齐/.test(title)) return false;
  if (/^>\s/.test(title)) return false;
  if (/^-\s*周/.test(title)) return false;
  return true;
}

function extractSection(body: string, ...headers: string[]): string {
  for (const h of headers) {
    const re = new RegExp(`##\\s*${h}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
    const m = body.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return "";
}

function parseDueDate(text: string): string | null {
  const iso = text.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const done = text.match(/✅\s*(\d{4}-\d{2}-\d{2})/);
  if (done) return done[1];
  const slash = text.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (slash) {
    return `${slash[1]}-${slash[2].padStart(2, "0")}-${slash[3].padStart(2, "0")}`;
  }
  return null;
}

function parseCheckboxes(section: string): ParsedMilestone[] {
  const items: ParsedMilestone[] = [];
  const re = /^\s*[-*]\s+\[([ xX])\]\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section)) !== null) {
    const completed = m[1].toLowerCase() === "x";
    let title = cleanInline(m[2]);
    title = title.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}.*$/, "").trim();
    title = title.replace(/\s*📅\s*\d{4}-\d{2}-\d{2}.*$/, "").trim();
    if (title.length < 2) continue;
    if (!isValidMilestoneTitle(title)) continue;
    items.push({
      title: title.slice(0, 200),
      dueDate: parseDueDate(m[2]),
      completed,
    });
  }
  return items;
}

function parseTableMilestones(section: string): ParsedMilestone[] {
  const items: ParsedMilestone[] = [];
  const rows = section.split("\n").filter((l) => l.includes("|") && !l.match(/^\s*\|?\s*[-:| ]+\|/));
  for (const row of rows) {
    const cells = row
      .split("|")
      .map((c) => cleanInline(c))
      .filter(Boolean);
    if (cells.length < 2) continue;
    if (/^(块|步|项|标记|优先级|维度|项|来源|账号)/.test(cells[0])) continue;
    if (/^(状态|内容|理想|最晚|完成|动作)/.test(cells[0])) continue;

    const code = cells[0];
    if (!/^[A-Z]\d+$|^[A-Z]{1,3}\d*$|^\*\*[A-Z]/.test(code) && cells.length < 3) continue;

    const title = cells.length >= 4 ? `${cells[0]}: ${cells[3]}` : cells.slice(0, 2).join(" — ");
    if (!isValidMilestoneTitle(title)) continue;

    let dueDate: string | null = null;
    for (const c of cells) {
      const d = parseDueDate(c) || c.match(/(\d{1,2})\/(\d{1,2})/);
      if (d && typeof d === "string") dueDate = d;
      else if (d && Array.isArray(d)) {
        const year = new Date().getFullYear();
        dueDate = `${year}-${d[1].padStart(2, "0")}-${d[2].padStart(2, "0")}`;
      }
    }
    items.push({ title: title.slice(0, 200), dueDate, completed: false });
  }
  return items;
}

function parseBulletMilestones(section: string): ParsedMilestone[] {
  const items: ParsedMilestone[] = [];
  const re = /^\s*[-*]\s+(?!\[)(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section)) !== null) {
    const raw = m[1];
    if (/^>\s/.test(raw)) continue;
    if (/与\s*\[\[Log/.test(raw)) continue;
    if (/^---/.test(raw)) continue;
    const title = cleanInline(raw.replace(/^>\s*/, ""));
    if (!isValidMilestoneTitle(title)) continue;
    items.push({ title, dueDate: parseDueDate(raw), completed: false });
  }
  return items;
}

function parseHabitLines(section: string, projectName: string): ParsedHabit[] {
  const habits: ParsedHabit[] = [];
  const re = /^\s*[-*]\s+(?!\[)(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section)) !== null) {
    const raw = m[1];
    const isHabit =
      /每天|每日|每周|固定.*分钟|早间|边角.*min|习惯|打卡|阅读后写|DeepDash|二选一/.test(raw);
    if (!isHabit) continue;
    const name = cleanInline(raw).slice(0, 80);
    if (name.length < 4) continue;
    habits.push({
      name: name.length > 40 ? `${projectName}: ${name.slice(0, 36)}…` : name,
      description: null,
      frequency: /每周/.test(raw) ? "WEEKLY" : "DAILY",
    });
  }
  return habits;
}

function parseMilestoneSection(section: string): ParsedMilestone[] {
  const items: ParsedMilestone[] = [];
  const re = /^\s*[-*]\s+\*\*(Q\d+|[^*]+)\*\*[：:]\s*(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section)) !== null) {
    items.push({
      title: `${m[1]}: ${cleanInline(m[2]).slice(0, 160)}`,
      dueDate: null,
      completed: false,
    });
  }
  return items;
}

function summarizeGoals(section: string, maxLen = 400): string | null {
  if (!section.trim()) return null;

  const lines = section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("---") && !/^>\s*与\s*\[\[Log/.test(l));

  const bullets: string[] = [];
  const paragraphs: string[] = [];

  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) continue;
    if (/^\|.+\|$/.test(line)) continue;
    const cleaned = cleanInline(line.replace(/^[-*]\s+/, "").replace(/^>\s*/, ""));
    if (!cleaned || cleaned.length < 3) continue;
    if (cleaned.startsWith("与 ") && cleaned.includes("People")) continue;
    if (/^与\s*\[\[/.test(cleaned)) continue;

    if (line.match(/^[-*]\s+/)) {
      if (bullets.length < 4) bullets.push(cleaned);
    } else if (!line.startsWith(">") && paragraphs.length < 2) {
      paragraphs.push(cleaned);
    }
  }

  let summary = "";
  if (paragraphs.length) summary = paragraphs[0];
  else if (bullets.length) summary = bullets.slice(0, 3).join("；");
  else summary = cleanInline(lines.join(" "));

  summary = summary.slice(0, maxLen).trim();
  if (summary.length < 8) return null;
  if (/^\|/.test(summary)) {
    summary = summary.replace(/\|/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLen);
    if (summary.length < 8) return null;
  }
  if (EMPTY_TEMPLATE.test(summary.replace(/\n/g, " | "))) return null;
  return summary;
}

function dedupeMilestones(items: ParsedMilestone[]): ParsedMilestone[] {
  const seen = new Set<string>();
  return items.filter((m) => {
    const key = m.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeHabits(items: ParsedHabit[]): ParsedHabit[] {
  const seen = new Set<string>();
  return items.filter((h) => {
    const key = h.name.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseProjectDescription(
  description: string | null | undefined,
  options?: { categoryName?: string | null; projectName?: string }
): ReorganizePlan {
  const categoryName = options?.categoryName || "";
  const projectName = options?.projectName || "项目";
  const raw = stripFrontmatter(description?.trim() || "");
  if (!raw) {
    return { milestones: [], habits: [], simplifiedDescription: null };
  }

  if (EMPTY_TEMPLATE.test(raw.replace(/\n/g, " | "))) {
    return { milestones: [], habits: [], simplifiedDescription: null };
  }

  const goals = extractSection(raw, "目标", "行程");
  const next = extractSection(raw, "下一步", "Next", "当前推进", "Tasks");
  const milestoneSection = extractSection(
    raw,
    "里程碑",
    "年里程碑",
    "双轨里程碑",
    "当前推进"
  );
  const tasksSection = extractSection(raw, "Tasks");

  const combined = [next, milestoneSection, tasksSection, raw].join("\n");

  let milestones = dedupeMilestones([
    ...parseCheckboxes(combined),
    ...parseMilestoneSection(raw),
    ...parseTableMilestones(milestoneSection || combined),
  ]);

  if (milestones.length > 12) {
    milestones = milestones.slice(0, 12);
  }

  if (milestones.length === 0 && next) {
    milestones = dedupeMilestones(parseBulletMilestones(next)).slice(0, 8);
  }

  let habits: ParsedHabit[] = [];
  const isHabitCategory = /learning habit|habit|习惯/i.test(categoryName);
  const isLearnProject = /^(Learn[A-Z]?_|Learning$)/i.test(projectName);

  if (isHabitCategory || isLearnProject) {
    habits = dedupeHabits([
      ...parseHabitLines(next || goals, projectName),
      ...parseHabitLines(goals, projectName),
    ]);
    if (habits.length === 0 && isLearnProject) {
      habits.push({
        name: projectName.replace(/^Learn[A-Z]?_/, "").replace(/^Learning$/i, "Learning").replace(/_/g, " "),
        description: summarizeGoals(goals, 200),
        frequency: "DAILY",
      });
    }
  } else {
    habits = dedupeHabits(parseHabitLines(next, projectName)).slice(0, 3);
  }

  const simplifiedDescription = summarizeGoals(goals || raw.split("\n##")[0], 400);

  return { milestones, habits, simplifiedDescription };
}

export function computeProgressFromMilestones(
  milestones: Array<{ completed: boolean }>
): number {
  if (!milestones.length) return 0;
  const done = milestones.filter((m) => m.completed).length;
  return Math.round((done / milestones.length) * 100);
}

export function sanitizeProjectText(text: string): string {
  return text.replace(/[\uD800-\uDFFF\uFFFD]/g, "").trim();
}

/** Apply parsed plan to an existing project (milestones, habits, simplified description). */
export async function applyProjectReorganize(
  projectId: string,
  description: string | null | undefined,
  options?: { categoryName?: string | null; projectName?: string }
) {
  const { prisma } = await import("./prisma");
  const plan = parseProjectDescription(description, options);

  const [project, existingMilestones, existingHabits] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.projectMilestone.findMany({ where: { projectId } }),
    prisma.habit.findMany({ where: { projectId, isActive: true } }),
  ]);
  if (!project) return plan;

  const existingMilestoneTitles = new Set(
    existingMilestones.map((m) => m.title.toLowerCase().slice(0, 60))
  );
  const newMilestones = plan.milestones.filter(
    (m) => !existingMilestoneTitles.has(m.title.toLowerCase().slice(0, 60))
  );

  const existingHabitNames = new Set(
    existingHabits.map((h) => h.name.toLowerCase().slice(0, 50))
  );
  const newHabits = plan.habits.filter(
    (h) => !existingHabitNames.has(h.name.toLowerCase().slice(0, 50))
  );

  const descChanged =
    (plan.simplifiedDescription || null) !== (project.description || null) &&
    (plan.simplifiedDescription !== null ||
      !project.description ||
      project.description.includes("## 目标"));

  await prisma.$transaction(async (tx) => {
    if (descChanged) {
      await tx.project.update({
        where: { id: projectId },
        data: {
          description: plan.simplifiedDescription
            ? sanitizeProjectText(plan.simplifiedDescription)
            : null,
        },
      });
    }

    let sortOrder = existingMilestones.length;
    for (const m of newMilestones) {
      await tx.projectMilestone.create({
        data: {
          projectId,
          title: sanitizeProjectText(m.title).slice(0, 200),
          dueDate: m.dueDate ? new Date(m.dueDate) : null,
          completed: m.completed,
          sortOrder: sortOrder++,
        },
      });
    }

    const allMilestones = [
      ...existingMilestones.map((m) => ({ completed: m.completed })),
      ...newMilestones.map((m) => ({ completed: m.completed })),
    ];
    if (newMilestones.length && allMilestones.length) {
      await tx.project.update({
        where: { id: projectId },
        data: { progress: computeProgressFromMilestones(allMilestones) },
      });
    }

    let habitOrder = existingHabits.length;
    for (const h of newHabits) {
      await tx.habit.create({
        data: {
          name: sanitizeProjectText(h.name).slice(0, 80),
          description: h.description ? sanitizeProjectText(h.description) : null,
          projectId,
          frequency: h.frequency,
          daysOfWeek: h.frequency === "WEEKLY" ? "[1,3,5]" : "[1,2,3,4,5,6,0]",
          color: "#10b981",
          sortOrder: habitOrder++,
        },
      });
    }
  });

  return plan;
}
