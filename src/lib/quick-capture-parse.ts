import { addDays, format } from "date-fns";

export type ParsedCapture = {
  type: "task" | "meeting" | "note";
  title: string;
  date: string | null;
  time: string | null;
  projectName: string | null;
  projectId: string | null;
};

const DATE_PATTERNS: Array<{ re: RegExp; offset: (now: Date) => Date }> = [
  { re: /今天|今日/, offset: (d) => d },
  { re: /明天|明日/, offset: (d) => addDays(d, 1) },
  { re: /后天/, offset: (d) => addDays(d, 2) },
  { re: /大后天/, offset: (d) => addDays(d, 3) },
  { re: /昨天|昨日/, offset: (d) => addDays(d, -1) },
];

const TIME_RE = /(\d{1,2})[:：](\d{2})/;
const PROJECT_RE = /#([^\s#]+)/;
const MEETING_HINT = /开会|会议|碰头|sync|meeting/i;

export function parseQuickCapture(input: string, now = new Date()): ParsedCapture {
  let text = input.trim();
  let date: string | null = null;

  for (const { re, offset } of DATE_PATTERNS) {
    if (re.test(text)) {
      date = format(offset(now), "yyyy-MM-dd");
      text = text.replace(re, "").trim();
      break;
    }
  }

  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    date = isoMatch[1];
    text = text.replace(isoMatch[0], "").trim();
  }

  let time: string | null = null;
  const timeMatch = text.match(TIME_RE);
  if (timeMatch) {
    const h = timeMatch[1].padStart(2, "0");
    time = `${h}:${timeMatch[2]}`;
    text = text.replace(timeMatch[0], "").trim();
  }

  let projectName: string | null = null;
  const projectMatch = text.match(PROJECT_RE);
  if (projectMatch) {
    projectName = projectMatch[1];
    text = text.replace(projectMatch[0], "").trim();
  }

  const title = text.replace(/\s+/g, " ").trim();
  const type = MEETING_HINT.test(input) ? "meeting" : "task";

  return {
    type: title.length > 0 && !MEETING_HINT.test(input) && !date && !time ? "note" : type,
    title: title || input.trim(),
    date,
    time,
    projectName,
    projectId: null,
  };
}

export async function resolveProjectId(name: string | null): Promise<string | null> {
  if (!name) return null;
  const res = await fetch("/api/projects");
  if (!res.ok) return null;
  const data = await res.json();
  const projects = (data.projects ?? data) as Array<{ id: string; name: string }>;
  const exact = projects.find((p) => p.name === name);
  if (exact) return exact.id;
  const fuzzy = projects.find((p) => p.name.includes(name) || name.includes(p.name));
  return fuzzy?.id ?? null;
}
