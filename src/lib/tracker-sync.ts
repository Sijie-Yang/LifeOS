import type { AlignOp, OpportunityPatch } from "@/lib/align-ops";

/** 求职 bot 的 tracker.csv ↔ LifeOS Opportunity 对账（只生成 ops，写库走 runAlign） */
export type TrackerRow = Record<string, string>;
export type OppLite = { id: string; title: string; status: string; priority: string; deadline: string | null; source: string | null; category: string };

export function parseCsv(text: string): TrackerRow[] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); if (row.some((x) => x !== "")) rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

export function mapStatus(s: string): string {
  if (/^submitted|^pending|^applied|^interview/i.test(s)) return "Active";
  if (/^rejected|^declined|^skipped/i.test(s)) return "Passed";
  if (/^offer/i.test(s)) return "Won";
  return "Watching"; // To review / Next up / Planned / On hold
}
export function mapPriority(p: string): string {
  return p.startsWith("1") ? "HIGH" : p.startsWith("2") ? "MEDIUM" : "LOW";
}
export function mapCategory(track: string): string {
  return /academic/i.test(track) ? "Research" : "Industry";
}
function mapDeadline(d: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

const ALIASES: Record<string, string[]> = {
  "university of hong kong": ["hku", "香港大学"],
  "university of texas at austin": ["ut austin"],
  "mit": ["mit"],
  "zhipu ai": ["智谱"],
  "deepseek": ["deepseek", "深度求索"],
};
function brandTokens(inst: string): string[] {
  const brand = inst.split(/[(,（]/)[0].trim().toLowerCase();
  const paren = (inst.match(/[(（]([^)）,，/]+)/)?.[1] ?? "").trim().toLowerCase();
  return [...new Set([brand, ...(ALIASES[brand] ?? []), ...(paren.length >= 2 ? [paren] : [])])].filter((t) => t.length >= 2);
}
function detailTokens(r: TrackerRow): string[] {
  const rest = r["Institution/Company"].split(/[,(（]/).slice(1).join(" ") + " " + r["Position"];
  return [...new Set(rest.toLowerCase().match(/[a-z][a-z+&-]{4,}/g) ?? [])].filter(
    (w) => !["professor", "assistant", "research", "researcher", "university", "department", "intern", "internship", "postdoctoral", "school", "urban", "tenure-track"].includes(w)
  );
}

export function rowTitle(r: TrackerRow): string {
  return `${r["Institution/Company"].split(/[(（]/)[0].trim()} · ${r["Position"]}`.slice(0, 160);
}

function rowPatch(r: TrackerRow): OpportunityPatch {
  return {
    status: mapStatus(r["Status"] ?? ""),
    priority: mapPriority(r["Priority"] ?? ""),
    deadline: mapDeadline(r["Deadline"] ?? ""),
  };
}

export type SyncPlan = {
  matched: Array<{ row: number; title: string; opportunityId: string; opportunity: string; diff: Record<string, [unknown, unknown]> }>;
  created: Array<{ row: number; title: string }>;
  ambiguous: Array<{ row: number; title: string; candidates: Array<{ id: string; title: string }>; reason: string }>;
  ops: AlignOp[];
};

export function planTrackerSync(rows: TrackerRow[], opps: OppLite[]): SyncPlan {
  const plan: SyncPlan = { matched: [], created: [], ambiguous: [], ops: [] };
  const used = new Map<string, number>();
  rows.forEach((r, i) => {
    const n = i + 1;
    const title = rowTitle(r);
    const url = (r["URL"] ?? "").trim();
    const byUrl = url ? opps.filter((o) => o.source?.includes(url) || o.title === title) : opps.filter((o) => o.title === title);
    let hit: OppLite | null = byUrl.length === 1 ? byUrl[0] : null;
    if (!hit) {
      const brands = brandTokens(r["Institution/Company"] ?? "");
      const brandHits = opps.filter((o) => brands.some((b) => o.title.toLowerCase().includes(b)));
      const details = detailTokens(r);
      const strong = brandHits.filter((o) => details.some((d) => `${o.title} ${o.source ?? ""}`.toLowerCase().includes(d)));
      if (strong.length === 1) hit = strong[0];
      else if (brandHits.length > 0) {
        plan.ambiguous.push({
          row: n, title, candidates: brandHits.map((o) => ({ id: o.id, title: o.title })),
          reason: strong.length > 1 ? "多个候选都对得上" : "同机构但岗位/部门对不上",
        });
        return;
      }
    }
    if (hit) {
      if (used.has(hit.id)) {
        plan.ambiguous.push({ row: n, title, candidates: [{ id: hit.id, title: hit.title }], reason: `和第 ${used.get(hit.id)} 行抢同一个机会` });
        return;
      }
      used.set(hit.id, n);
      const patch = rowPatch(r);
      const diff: Record<string, [unknown, unknown]> = {};
      const set: OpportunityPatch = {};
      for (const [k, v] of Object.entries(patch) as Array<[keyof OpportunityPatch, string | null]>) {
        if (v === null && k === "deadline") continue; // tracker 没日期就不覆盖
        const cur = hit[k as keyof OppLite];
        if (cur !== v) { diff[k] = [cur, v]; (set as Record<string, unknown>)[k] = v; }
      }
      if (!hit.source && url) { diff.source = [null, url]; set.source = url; }
      plan.matched.push({ row: n, title, opportunityId: hit.id, opportunity: hit.title, diff });
      if (Object.keys(set).length) plan.ops.push({ op: "update_opportunity", opportunityId: hit.id, set });
      return;
    }
    plan.created.push({ row: n, title });
    const notes = [`[tracker] Status: ${r["Status"]}`, `Deadline: ${r["Deadline"]}`, r["Location"] && `Location: ${r["Location"]}`, r["Required materials"] && `Materials: ${r["Required materials"]}`, r["Fit notes"] && `Fit: ${r["Fit notes"]}`, r["Notes"]]
      .filter(Boolean).join("\n");
    plan.ops.push({
      op: "create_opportunity",
      set: { title, lane: "career", category: mapCategory(r["Track"] ?? ""), ...rowPatch(r), source: url || null, nextAction: r["Status"] || null, notes },
    });
  });
  return plan;
}
