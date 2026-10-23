import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTags } from "@/lib/tags";
import { enrichContactPlaces } from "@/lib/contact-places";
import { isOverdue, daysSinceContact } from "@/lib/utils";
import {
  POWER_AXES,
  POWER_ROLES,
  POWER_SOP,
  POWER_ACTIONS,
  POWER_LOOP,
  ROLE_PLAYBOOK,
  type PowerAxisId,
  type PowerRoleId,
  composePowerPlays,
  defaultPowerEfforts,
  diagnosePowerGaps,
  findKnownNode,
  roleMeta,
} from "@/lib/power-map";
import { mapPhase } from "@/lib/life-strategy";
import { POWER_HINTS } from "@/lib/personal-config";

/** 关键词启发式，见 personal-config（可在 private/ 按你的方向改写） */
const CORE_TRACK_HINT = POWER_HINTS.coreTrack;
const BACKUP_HINT = POWER_HINTS.backup;
const MEDIA_HINT = POWER_HINTS.media;

function parseJsonList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.map(String);
  } catch {
    /* plain string */
  }
  return raw ? [raw] : [];
}

function inferRoles(input: {
  name: string;
  tags: string[];
  category?: string | null;
  importance: number;
  hasActiveOpp: boolean;
  knownRoles?: PowerRoleId[];
}): PowerRoleId[] {
  if (input.knownRoles?.length) return input.knownRoles;

  const blob = [...input.tags, input.category ?? "", input.name].join(" ").toLowerCase();
  const roles = new Set<PowerRoleId>();

  if (/教授|pi|导师|faculty|mentor/.test(blob) && input.importance >= 4) {
    roles.add("mentor");
  }
  if (POWER_HINTS.gate.test(blob) || input.hasActiveOpp) {
    roles.add("gatekeeper");
  }
  if (/peer|同盟|合作|collaboration|job-hunt-peer/.test(blob)) {
    roles.add("ally");
  }
  if (/潜在访客|rising|後輩|学弟|学妹/.test(blob)) {
    roles.add("rising");
  }

  if (!roles.size) {
    if (input.importance >= 5) roles.add("peer");
    else if (input.importance >= 4) roles.add("peer");
    else roles.add("peer");
  }

  return [...roles];
}

export async function GET() {
  const [meta, phases, contactsRaw, opportunities, goals] = await Promise.all([
    prisma.lifeStrategyMeta.findFirst(),
    prisma.lifeStrategyPhase.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.contact.findMany({
      include: {
        category: true,
        logs: { orderBy: { contactedAt: "desc" }, take: 1 },
        opportunities: {
          include: {
            opportunity: {
              select: { id: true, title: true, status: true, lane: true, priority: true },
            },
          },
        },
        projects: {
          include: { project: { select: { id: true, name: true, status: true } } },
        },
        goals: {
          include: { goal: { select: { id: true, title: true, area: true } } },
        },
      },
      orderBy: [{ importance: "desc" }, { name: "asc" }],
    }),
    prisma.opportunity.findMany({
      where: {
        lane: "career",
        status: { in: ["Watching", "Active"] },
      },
      include: {
        contacts: { include: { contact: { select: { id: true, name: true } } } },
        project: { select: { id: true, name: true } },
        goal: { select: { id: true, title: true } },
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.lifeGoal.findMany({
      where: { status: { in: ["ACTIVE", "PAUSED"] } },
      select: { id: true, title: true, area: true, progress: true, status: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const activePhaseRow = phases.find((p) => p.status === "active") ?? null;
  const activePhaseDto = activePhaseRow ? mapPhase(activePhaseRow) : null;

  type PowerNode = {
    id: string;
    name: string;
    importance: number;
    roles: PowerRoleId[];
    axes: PowerAxisId[];
    alignment: "core" | "support" | "backup" | "drift";
    note: string;
    institution: string[];
    city: string[];
    category: string | null;
    tags: string[];
    lastContactAt: string | null;
    daysSince: number | null;
    overdue: boolean;
    opportunities: Array<{ id: string; title: string; status: string; priority: string }>;
    projects: Array<{ id: string; name: string }>;
  };

  const nodes: PowerNode[] = [];

  for (const c of contactsRaw) {
    const known = findKnownNode(c.name);
    const tags = parseTags(c.tags || "[]");
    const activeOpps = c.opportunities
      .map((x) => x.opportunity)
      .filter((o) => o.lane === "career" && (o.status === "Active" || o.status === "Watching"));

    const categoryName = c.category?.name ?? "";
    if (/家人|家庭|family/i.test(categoryName) || tags.some((t) => /家人|家庭|family/i.test(t))) {
      continue;
    }

    const isSenior =
      /教授|faculty|PI|mentor/i.test(categoryName) ||
      tags.some((t) => /教授|mentor|faculty|权力|sponsor|招聘|媒体/i.test(t));

    const isPowerRelevant =
      Boolean(known) ||
      activeOpps.length > 0 ||
      isSenior ||
      c.importance >= 5;

    // importance-4 peers without role signal stay in contacts, not power map
    if (!isPowerRelevant) continue;

    const enriched = enrichContactPlaces(c);
    const last =
      c.logs[0]?.contactedAt ?? c.lastContactAt ?? null;
    const roles = inferRoles({
      name: c.name,
      tags,
      category: c.category?.name,
      importance: c.importance,
      hasActiveOpp: activeOpps.some((o) => o.status === "Active"),
      knownRoles: known?.roles,
    });

    let alignment = known?.alignment ?? ("support" as const);
    const textBlob = `${c.name} ${tags.join(" ")} ${activeOpps.map((o) => o.title).join(" ")}`;
    if (!known) {
      if (CORE_TRACK_HINT.test(textBlob)) alignment = "core";
      else if (BACKUP_HINT.test(textBlob)) alignment = "backup";
    }

    nodes.push({
      id: c.id,
      name: c.name,
      importance: c.importance,
      roles,
      axes: known?.axes ?? (roles.includes("sponsor")
        ? (["funding", "authorship", "opportunity", "reputation", "channel"] as PowerAxisId[])
        : roles.includes("gatekeeper")
          ? (["opportunity", "channel"] as PowerAxisId[])
          : roles.includes("mentor")
            ? (["reputation", "channel"] as PowerAxisId[])
            : (["channel"] as PowerAxisId[])),
      alignment,
      note: known?.note ?? "",
      institution: enriched.institutions?.length
        ? enriched.institutions
        : parseJsonList(typeof c.institution === "string" ? c.institution : null),
      city: enriched.cities?.length
        ? enriched.cities
        : parseJsonList(typeof c.city === "string" ? c.city : null),
      category: c.category?.name ?? null,
      tags,
      lastContactAt: last ? last.toISOString() : null,
      daysSince: daysSinceContact(last),
      overdue: isOverdue(last, c.contactFrequencyDays),
      opportunities: activeOpps.map((o) => ({
        id: o.id,
        title: o.title,
        status: o.status,
        priority: o.priority,
      })),
      projects: c.projects.slice(0, 4).map((p) => ({
        id: p.project.id,
        name: p.project.name,
      })),
    });
  }

  // Sort: sponsor first, then core, then by importance / overdue
  const roleRank = (roles: PowerRoleId[]) => {
    const order: PowerRoleId[] = ["sponsor", "gatekeeper", "mentor", "ally", "rising", "peer"];
    return Math.min(...roles.map((r) => order.indexOf(r)));
  };
  nodes.sort((a, b) => {
    const ra = roleRank(a.roles) - roleRank(b.roles);
    if (ra !== 0) return ra;
    const alignOrder = { core: 0, support: 1, backup: 2, drift: 3 } as const;
    const aa = alignOrder[a.alignment] - alignOrder[b.alignment];
    if (aa !== 0) return aa;
    if (b.importance !== a.importance) return b.importance - a.importance;
    return Number(b.overdue) - Number(a.overdue);
  });

  const axisCoverage = Object.fromEntries(
    POWER_AXES.map((a) => [a.id, 0])
  ) as Record<PowerAxisId, number>;
  for (const n of nodes) {
    if (n.alignment === "drift") continue;
    for (const ax of n.axes) axisCoverage[ax] += 1;
  }

  const sponsors = nodes.filter((n) => n.roles.includes("sponsor"));
  const overdueSponsors = sponsors.filter((n) => n.overdue).length;

  const backupOppCount = opportunities.filter((o) => BACKUP_HINT.test(o.title)).length;
  const coreOppCount = opportunities.filter((o) => CORE_TRACK_HINT.test(o.title)).length;

  // Count only real-world labels — curated notes mentioning the core track don't count
  const realCoreTrack = nodes.filter((n) =>
    CORE_TRACK_HINT.test(
      `${n.name} ${n.tags.join(" ")} ${n.institution.join(" ")} ${n.category ?? ""}`
    )
  ).length;

  const gapsFinal = diagnosePowerGaps({
    hasSponsor: sponsors.length > 0,
    axisCoverage,
    physicalAiNodes: realCoreTrack,
    backupHeavy: backupOppCount >= 3 && coreOppCount === 0,
    overdueSponsors,
  });

  const byRole = POWER_ROLES.map((role) => ({
    ...role,
    nodes: nodes.filter((n) => n.roles.includes(role.id)),
  })).filter((g) => g.nodes.length > 0);

  const taggedOpps = opportunities.map((o) => {
    let alignment: "core" | "support" | "backup" | "drift" = "support";
    if (CORE_TRACK_HINT.test(o.title)) alignment = "core";
    else if (BACKUP_HINT.test(o.title)) alignment = "backup";
    else if (MEDIA_HINT.test(o.title)) alignment = "support";
    return {
      id: o.id,
      title: o.title,
      status: o.status,
      nextAction: o.nextAction,
      priority: o.priority,
      contactNames: o.contacts.map((x) => x.contact.name),
      alignment,
    };
  });

  const moves = [
    ...taggedOpps
      .filter((o) => o.status === "Active")
      .slice(0, 8)
      .map((o) => ({
        id: o.id,
        kind: "opportunity" as const,
        title: o.title,
        detail: o.nextAction || "推进下一步",
        priority: o.priority,
        href: "/opportunities",
        contacts: o.contactNames,
        alignment: o.alignment,
      })),
    ...nodes
      .filter((n) => n.roles.includes("sponsor") || (n.overdue && n.importance >= 4 && n.alignment !== "drift"))
      .slice(0, 6)
      .map((n) => ({
        id: n.id,
        kind: "contact" as const,
        title: n.name,
        detail: n.overdue
          ? `超期未联系（${n.daysSince ?? "?"} 天）· ${n.note || roleMeta(n.roles[0]!).hint}`
          : n.note || "保持对齐",
        priority: n.roles.includes("sponsor") ? "HIGH" : "MEDIUM",
        href: `/contacts?id=${n.id}`,
        contacts: [n.name],
        alignment: n.alignment,
      })),
  ];

  const plays = composePowerPlays({
    nodes,
    opportunities: taggedOpps,
    gaps: gapsFinal,
    activePhaseTitle: activePhaseDto?.title,
  });

  const playbook = POWER_ROLES.map((role) => ({
    ...role,
    ...ROLE_PLAYBOOK[role.id],
    primaryLabels: ROLE_PLAYBOOK[role.id].primary.map(
      (id) => POWER_ACTIONS.find((a) => a.id === id)!.label
    ),
    secondaryLabels: ROLE_PLAYBOOK[role.id].secondary.map(
      (id) => POWER_ACTIONS.find((a) => a.id === id)!.label
    ),
  }));

  return NextResponse.json({
    sop: POWER_SOP,
    northStar: meta?.northStar ?? "",
    decisionFilter: meta?.decisionFilter ?? "",
    activePhase: activePhaseDto
      ? {
          id: activePhaseDto.id,
          title: activePhaseDto.title,
          priorities: activePhaseDto.priorities,
          doList: activePhaseDto.doList,
          dontList: activePhaseDto.dontList,
        }
      : null,
    loop: POWER_LOOP,
    actions: POWER_ACTIONS,
    playbook,
    plays,
    axes: POWER_AXES.map((a) => ({
      ...a,
      coverage: axisCoverage[a.id],
      nodes: nodes
        .filter((n) => n.axes.includes(a.id) && n.alignment !== "drift")
        .slice(0, 5)
        .map((n) => ({ id: n.id, name: n.name, roles: n.roles })),
    })),
    efforts: defaultPowerEfforts(activePhaseDto?.title),
    gaps: gapsFinal,
    byRole,
    nodes,
    moves,
    goals: goals.filter((g) =>
      ["career", "relationship", "learning", "creation"].includes(g.area)
    ),
    stats: {
      nodeCount: nodes.length,
      sponsorCount: sponsors.length,
      physicalAiNodes: realCoreTrack,
      activeOpportunities: opportunities.filter((o) => o.status === "Active").length,
      backupOpportunities: backupOppCount,
      coreOpportunities: coreOppCount,
      playCount: plays.length,
    },
    strategyUpdatedAt: meta?.updatedAt?.toISOString() ?? null,
  });
}
