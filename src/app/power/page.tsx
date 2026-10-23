"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, EmptyState } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  CachedContent,
  fetchJson,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import { useContactQuickView } from "@/components/contacts/ContactQuickView";
import { CONTACT_SOP_SUMMARY } from "@/lib/contact-sop";
import { cn, GOAL_AREAS } from "@/lib/utils";
import type { PowerActionId, PowerAxisId, PowerRoleId } from "@/lib/power-map";
import {
  Compass,
  Crosshair,
  AlertTriangle,
  Users,
  Target,
  ArrowRight,
  BookOpen,
  Route,
  RefreshCw,
  Swords,
} from "lucide-react";
import { UI_COPY } from "@/lib/ui-copy";

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

type PowerPayload = {
  sop: string;
  northStar: string;
  decisionFilter: string;
  activePhase: {
    id: string;
    title: string;
    priorities: string[];
    doList: string[];
    dontList: string[];
  } | null;
  loop?: Array<{ step: number; id: string; label: string; detail: string }>;
  actions?: Array<{
    id: PowerActionId;
    label: string;
    verb: string;
    color: string;
    meaning: string;
    result: string;
    when: string;
  }>;
  playbook?: Array<{
    id: PowerRoleId;
    label: string;
    color: string;
    primaryLabels: string[];
    secondaryLabels: string[];
    expect: string;
    avoid: string;
  }>;
  plays?: Array<{
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
  }>;
  axes: Array<{
    id: PowerAxisId;
    label: string;
    hint: string;
    coverage: number;
    nodes: Array<{ id: string; name: string; roles: PowerRoleId[] }>;
  }>;
  efforts: Array<{
    id: string;
    title: string;
    why: string;
    actions: string[];
    href?: string;
  }>;
  gaps: Array<{
    id: string;
    title: string;
    severity: "critical" | "high" | "medium";
    detail: string;
    action: string;
    href?: string;
  }>;
  byRole: Array<{
    id: PowerRoleId;
    label: string;
    color: string;
    hint: string;
    nodes: PowerNode[];
  }>;
  moves: Array<{
    id: string;
    kind: "opportunity" | "contact";
    title: string;
    detail: string;
    priority: string;
    href: string;
    contacts: string[];
    alignment: "core" | "support" | "backup" | "drift";
  }>;
  goals: Array<{
    id: string;
    title: string;
    area: string;
    progress: number;
    status: string;
  }>;
  stats: {
    nodeCount: number;
    sponsorCount: number;
    physicalAiNodes: number;
    activeOpportunities: number;
    backupOpportunities: number;
    coreOpportunities: number;
    playCount?: number;
  };
};

const ALIGN_META = {
  core: { label: "主航道", className: "bg-amber-100 text-amber-900" },
  support: { label: "支撑", className: "bg-indigo-50 text-indigo-800" },
  backup: { label: "Backup", className: "bg-zinc-100 text-zinc-600" },
  drift: { label: "降权", className: "bg-rose-50 text-rose-700" },
} as const;

const SEV = {
  critical: "border-rose-300 bg-rose-50 text-rose-900",
  high: "border-amber-300 bg-amber-50 text-amber-950",
  medium: "border-zinc-200 bg-zinc-50 text-zinc-800",
} as const;

function NodeRow({
  node,
  onOpen,
}: {
  node: PowerNode;
  onOpen: (id: string) => void;
}) {
  const align = ALIGN_META[node.alignment];
  return (
    <button
      type="button"
      onClick={() => onOpen(node.id)}
      className="w-full text-left px-3 py-2.5 hover:bg-zinc-50 border-b border-zinc-100 last:border-0"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-zinc-900">{node.name}</span>
            <Badge className={cn(align.className, "text-[10px] px-1.5 py-0")}>{align.label}</Badge>
            {node.overdue && (
              <Badge className="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0">超期</Badge>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
            {[node.institution[0], node.category, node.daysSince != null ? `${node.daysSince}天前` : "未联系"]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {node.note && (
            <p className="text-[11px] text-zinc-600 mt-1 line-clamp-2">{node.note}</p>
          )}
        </div>
        <span className="text-[10px] text-zinc-400 shrink-0">重要 {node.importance}</span>
      </div>
    </button>
  );
}

export default function PowerPage() {
  const [data, setData] = useState<PowerPayload | null>(() =>
    peekFetchCache<PowerPayload>("/api/power")
  );
  const [loading, setLoading] = useState(() => shouldShowPageLoading(["/api/power"]));
  const [error, setError] = useState<string | null>(null);
  const { openContact } = useContactQuickView();

  const load = useCallback(async () => {
    if (shouldShowPageLoading(["/api/power"])) setLoading(true);
    setError(null);
    try {
      const stale = peekFetchCache<PowerPayload>("/api/power");
      const force = !stale?.plays?.length;
      setData(await fetchJson<PowerPayload>("/api/power", { force }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filterLines = (data?.decisionFilter || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title="权力地图"
        description="定位 → 出招 → 收结果 → 更新地图：把关系变成可操作的权力闭环"
        action={
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="/strategy" className="text-indigo-600 hover:underline inline-flex items-center gap-1">
              <Route className="h-3.5 w-3.5" /> 人生策略
            </Link>
            <Link href="/contacts" className="text-indigo-600 hover:underline inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> 联系人
            </Link>
            <Link href="/opportunities" className="text-indigo-600 hover:underline inline-flex items-center gap-1">
              <Crosshair className="h-3.5 w-3.5" /> 机会
            </Link>
            <Link href="/library" className="text-indigo-600 hover:underline inline-flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" /> Power 书
            </Link>
          </div>
        }
      />

      <CachedContent loading={loading} error={error} onRetry={load} hasData={!!data}>
      {data && (
      <>
      <p className="mb-4 text-xs text-zinc-500 border-l-2 border-amber-400 pl-3">
        闭环：{data.sop} · 联系人：{CONTACT_SOP_SUMMARY}
      </p>

      {/* Operation loop */}
      {data.loop && data.loop.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-800 mb-2 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-amber-700" />
            权力操作闭环
          </h2>
          <div className="grid gap-2 sm:grid-cols-5">
            {data.loop.map((step, i) => (
              <div
                key={step.id}
                className="relative rounded-lg border border-zinc-200 bg-white px-3 py-2.5"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                  {step.step}. {step.label}
                </p>
                <p className="text-[11px] text-zinc-600 mt-1 leading-snug">{step.detail}</p>
                {i < data.loop!.length - 1 && (
                  <span className="hidden sm:block absolute -right-1.5 top-1/2 -translate-y-1/2 text-zinc-300 text-xs z-10">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            缺「产价值」或「收结果」= 社交忙碌；缺「记账→再出招」= 同一招空转。
          </p>
        </section>
      )}

      {/* Six action types */}
      {data.actions && data.actions.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-800 mb-2 flex items-center gap-2">
            <Swords className="h-4 w-4 text-amber-700" />
            六种行动 → 各带来什么结果
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.actions.map((a) => (
              <div key={a.id} className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Badge className={cn(a.color, "text-[11px] px-1.5 py-0")}>{a.label}</Badge>
                  <span className="text-[11px] text-zinc-400">{a.verb}</span>
                </div>
                <p className="text-[12px] text-zinc-700 mt-1.5">{a.meaning}</p>
                <p className="text-[11px] text-emerald-800 mt-1 bg-emerald-50 rounded px-1.5 py-1">
                  结果：{a.result}
                </p>
                <p className="text-[10px] text-zinc-500 mt-1">何时：{a.when}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Composed plays — the operational heart */}
      {data.plays && data.plays.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-800 mb-1">
            本周出招清单（角色 × 行动 → 结果 → 下一招）
          </h2>
          <p className="text-[11px] text-zinc-500 mb-3">
            定位只回答「对谁」；这里回答「出哪招、收什么、成/败后怎么转」。
          </p>
          <div className="space-y-2">
            {data.plays.map((play) => {
              const action = data.actions?.find((a) => a.id === play.action);
              return (
                <div
                  key={play.id}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-3"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      className={cn(
                        play.priority === "HIGH"
                          ? "bg-rose-100 text-rose-800"
                          : play.priority === "MEDIUM"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-zinc-100 text-zinc-600",
                        "text-[10px] px-1.5 py-0"
                      )}
                    >
                      {play.priority}
                    </Badge>
                    {action && (
                      <Badge className={cn(action.color, "text-[10px] px-1.5 py-0")}>
                        {action.label}
                      </Badge>
                    )}
                    <span className="text-sm font-medium text-zinc-900">{play.targetName}</span>
                    <span className="text-[10px] text-zinc-400">· {play.targetRole}</span>
                  </div>
                  <p className="text-[13px] text-zinc-800 mt-1.5 leading-snug">{play.move}</p>
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2 text-[11px]">
                    <p className="text-emerald-900 bg-emerald-50 rounded px-2 py-1">
                      <span className="font-medium">期望结果：</span>
                      {play.expect}
                    </p>
                    <p className="text-indigo-900 bg-indigo-50 rounded px-2 py-1">
                      <span className="font-medium">如何收：</span>
                      {play.capture}
                    </p>
                    <p className="text-zinc-700 bg-zinc-50 rounded px-2 py-1">
                      <span className="font-medium">成 → </span>
                      {play.nextIfYes}
                    </p>
                    <p className="text-zinc-700 bg-zinc-50 rounded px-2 py-1">
                      <span className="font-medium">败 → </span>
                      {play.nextIfNo}
                    </p>
                  </div>
                  {play.href && (
                    <div className="mt-2">
                      {play.targetId ? (
                        <button
                          type="button"
                          onClick={() => openContact(play.targetId!)}
                          className="text-[11px] text-indigo-600 hover:underline"
                        >
                          打开联系人 →
                        </button>
                      ) : (
                        <Link href={play.href} className="text-[11px] text-indigo-600 hover:underline">
                          相关页面 →
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Role → action playbook */}
      {data.playbook && data.playbook.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-800 mb-2">角色怎么组成行动</h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">角色</th>
                  <th className="px-3 py-2 font-medium">主招</th>
                  <th className="px-3 py-2 font-medium">辅招</th>
                  <th className="px-3 py-2 font-medium">期望结果</th>
                  <th className="px-3 py-2 font-medium">禁止空转</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.playbook.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <Badge className={cn(row.color, "text-[10px] px-1.5 py-0")}>{row.label}</Badge>
                    </td>
                    <td className="px-3 py-2 text-zinc-800">{row.primaryLabels.join(" · ")}</td>
                    <td className="px-3 py-2 text-zinc-500">{row.secondaryLabels.join(" · ")}</td>
                    <td className="px-3 py-2 text-zinc-700">{row.expect}</td>
                    <td className="px-3 py-2 text-rose-700/80">{row.avoid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* North star + phase */}
      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2 border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Compass className="h-4 w-4 text-amber-700" />
              北极星与决策滤镜
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">
              {data.northStar || "尚未设置北极星 — 请到人生策略填写"}
            </p>
            {filterLines.length > 0 && (
              <ul className="space-y-1">
                {filterLines.map((line) => (
                  <li key={line} className="text-[12px] text-zinc-600 flex gap-2">
                    <span className="text-amber-600 shrink-0">›</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-600" />
              当前阶段
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.activePhase ? (
              <div className="space-y-2">
                <Badge className="bg-indigo-100 text-indigo-800">{data.activePhase.title}</Badge>
                <ul className="space-y-1.5">
                  {data.activePhase.priorities.slice(0, 4).map((p) => (
                    <li key={p} className="text-[12px] text-zinc-700 leading-snug">
                      · {p}
                    </li>
                  ))}
                </ul>
                {data.activePhase.doList[0] && (
                  <p className="text-[11px] text-emerald-800 bg-emerald-50 rounded px-2 py-1.5 mt-2">
                    做：{data.activePhase.doList[0]}
                  </p>
                )}
                {data.activePhase.dontList[0] && (
                  <p className="text-[11px] text-rose-800 bg-rose-50 rounded px-2 py-1.5">
                    不做：{data.activePhase.dontList[0]}
                  </p>
                )}
              </div>
            ) : (
              <EmptyState title="无活跃阶段" description="到人生策略标记一个 active 阶段" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {[
          ["权力节点", data.stats.nodeCount],
          ["赞助人", data.stats.sponsorCount],
          [UI_COPY.power.coreNodesLabel, data.stats.physicalAiNodes],
          ["进行中机会", data.stats.activeOpportunities],
          ["Backup 机会", data.stats.backupOpportunities],
          ["主航道机会", data.stats.coreOpportunities],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[10px] text-zinc-400 uppercase tracking-wide">{label}</p>
            <p className="text-lg font-semibold text-zinc-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Gaps */}
      {data.gaps.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-800 mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            结构缺口
          </h2>
          <div className="grid gap-2 md:grid-cols-2">
            {data.gaps.map((g) => (
              <div key={g.id} className={cn("rounded-lg border px-3 py-2.5", SEV[g.severity])}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{g.title}</p>
                  <span className="text-[10px] uppercase opacity-70">{g.severity}</span>
                </div>
                <p className="text-[12px] mt-1 opacity-90">{g.detail}</p>
                <p className="text-[12px] mt-1.5 font-medium">
                  → {g.action}
                  {g.href && (
                    <Link href={g.href} className="ml-2 underline opacity-80">
                      去处理
                    </Link>
                  )}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Five axes */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-zinc-800 mb-2">五轴覆盖 · 资金 / 署名 / 机会 / 渠道 / 声誉</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {data.axes.map((ax) => (
            <div
              key={ax.id}
              className={cn(
                "rounded-lg border bg-white px-3 py-2.5",
                ax.coverage === 0 ? "border-rose-200" : "border-zinc-200"
              )}
            >
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold text-zinc-900">{ax.label}</p>
                <span className="text-xs text-zinc-400">{ax.coverage} 人</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">{ax.hint}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {ax.nodes.length === 0 ? (
                  <span className="text-[10px] text-rose-600">空档</span>
                ) : (
                  ax.nodes.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => openContact(n.id)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    >
                      {n.name.split(" ")[0]}
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Effort directions */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-zinc-800 mb-2">应该努力的方向</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {data.efforts.map((e, i) => (
            <Card key={e.id}>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-900">
                    {i + 1}
                  </span>
                  {e.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-[12px] text-zinc-600 leading-relaxed">{e.why}</p>
                <ul className="space-y-1">
                  {e.actions.map((a) => (
                    <li key={a} className="text-[12px] text-zinc-800 flex gap-1.5">
                      <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-amber-600" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
                {e.href && (
                  <Link href={e.href} className="text-[11px] text-indigo-600 hover:underline inline-block">
                    相关页面 →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5 mb-6">
        {/* Network by role */}
        <section className="lg:col-span-3 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-800">权力关系网（按角色）</h2>
          {data.byRole.length === 0 ? (
            <EmptyState title="暂无权力节点" description="提高关键联系人重要度，或补充机会关联" />
          ) : (
            data.byRole.map((group) => (
              <div key={group.id} className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
                <div className={cn("px-3 py-2 border-b border-zinc-100 flex items-center justify-between", group.color)}>
                  <div>
                    <p className="text-sm font-semibold">{group.label}</p>
                    <p className="text-[11px] opacity-80">{group.hint}</p>
                  </div>
                  <span className="text-xs font-medium">{group.nodes.length}</span>
                </div>
                <div>
                  {group.nodes.slice(0, group.id === "peer" ? 8 : 12).map((n) => (
                    <NodeRow key={`${group.id}-${n.id}`} node={n} onOpen={openContact} />
                  ))}
                  {group.id === "peer" && group.nodes.length > 8 && (
                    <p className="px-3 py-2 text-[11px] text-zinc-400">
                      另有 {group.nodes.length - 8} 位圈层同伴 — 在联系人页维护即可
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </section>

        {/* Moves + goals */}
        <section className="lg:col-span-2 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-800 mb-2">近期权力动作</h2>
            <div className="rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-100">
              {data.moves.length === 0 ? (
                <p className="px-3 py-6 text-sm text-zinc-500 text-center">暂无进行中动作</p>
              ) : (
                data.moves.slice(0, 10).map((m) => (
                  <Link
                    key={`${m.kind}-${m.id}`}
                    href={m.href}
                    className="block px-3 py-2.5 hover:bg-zinc-50"
                    onClick={(e) => {
                      if (m.kind === "contact") {
                        e.preventDefault();
                        openContact(m.id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          ALIGN_META[m.alignment].className
                        )}
                      >
                        {ALIGN_META[m.alignment].label}
                      </Badge>
                      <Badge className="bg-zinc-100 text-zinc-600 text-[10px] px-1.5 py-0">
                        {m.kind === "opportunity" ? "机会" : "人"}
                      </Badge>
                      {m.priority === "HIGH" && (
                        <Badge className="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0">HIGH</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-zinc-900 mt-1">{m.title}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{m.detail}</p>
                    {m.contacts.length > 0 && (
                      <p className="text-[10px] text-zinc-400 mt-1">{m.contacts.join(" · ")}</p>
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-zinc-800 mb-2">相关目标</h2>
            <div className="rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-100">
              {data.goals.map((g) => {
                const area = GOAL_AREAS[g.area as keyof typeof GOAL_AREAS];
                return (
                  <Link
                    key={g.id}
                    href={`/goals/${g.id}`}
                    className="block px-3 py-2.5 hover:bg-zinc-50"
                  >
                    <p className="text-sm font-medium text-zinc-900">{g.title}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {area?.label ?? g.area} · 进度 {g.progress}%
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </div>
      </>
      )}
      </CachedContent>
    </>
  );
}
