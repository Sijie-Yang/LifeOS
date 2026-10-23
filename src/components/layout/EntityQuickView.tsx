"use client";

import { Suspense, createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ProjectsWorkspace } from "@/components/projects/ProjectsWorkspace";
import { OpportunitiesBoard } from "@/components/opportunities/OpportunitiesBoard";
import { OPPORTUNITY_BOARD_PRESETS } from "@/components/opportunities/board-presets";
import { parseEntityHref, type EntityLinkTarget } from "@/lib/entity-links";
import type { OpportunityLane } from "@/lib/utils";

type EntityQuickViewCtx = {
  openProject: (id: string) => void;
  openOpportunity: (id: string) => void;
  closeEntity: () => void;
};

const Ctx = createContext<EntityQuickViewCtx | null>(null);

export function useEntityQuickView(): EntityQuickViewCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      openProject: (id) => {
        window.location.href = `/projects?id=${id}`;
      },
      openOpportunity: (id) => {
        window.location.href = `/opportunities?id=${id}`;
      },
      closeEntity: () => {},
    };
  }
  return ctx;
}

/**
 * 项目 / 机会的全局快速弹窗：站内任何指向 /projects?id= 或 /opportunities?id= 的链接，
 * 点了都在原地弹编辑窗，关掉还在原来的页面。只有已经在对应列表页时才交给页面自己处理。
 */
export function EntityQuickViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<EntityLinkTarget | null>(null);

  const openProject = useCallback((id: string) => setView({ kind: "project", id, page: "/projects" }), []);
  const openOpportunity = useCallback((id: string) => setView({ kind: "opportunity", id, page: "/opportunities" }), []);
  const closeEntity = useCallback(() => setView(null), []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (!anchor || anchor.getAttribute("target") === "_blank") return;
      const target = parseEntityHref(anchor.getAttribute("href"));
      if (!target) return;
      // 已经在项目 / 机会列表页：让页面自己按 ?id 打开
      if (window.location.pathname === target.page) return;
      e.preventDefault();
      e.stopPropagation();
      setView(target);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const value = useMemo(() => ({ openProject, openOpportunity, closeEntity }), [openProject, openOpportunity, closeEntity]);
  const quickView = useMemo(() => (view ? { id: view.id, onClose: closeEntity } : null), [view, closeEntity]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {quickView && view?.kind === "project" && (
        <Suspense fallback={null}>
          <ProjectsWorkspace key={view.id} quickView={quickView} />
        </Suspense>
      )}
      {quickView && view?.kind === "opportunity" && (
        <Suspense fallback={null}>
          <OpportunityQuickView key={view.id} id={view.id} onClose={closeEntity} />
        </Suspense>
      )}
    </Ctx.Provider>
  );
}

/** 先查这条机会属于哪条车道（职业 / 生活），再用对应的文案渲染编辑弹窗 */
function OpportunityQuickView({ id, onClose }: { id: string; onClose: () => void }) {
  const [lane, setLane] = useState<OpportunityLane | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/opportunities/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((o: { lane?: string } | null) => {
        if (cancelled) return;
        if (o) setLane(o.lane === "life" ? "life" : "career");
        else onClose();
      })
      .catch(() => {
        if (!cancelled) onClose();
      });
    return () => {
      cancelled = true;
    };
  }, [id, onClose]);
  const quickView = useMemo(() => ({ id, onClose }), [id, onClose]);
  if (!lane) return null;
  return <OpportunitiesBoard lane={lane} {...OPPORTUNITY_BOARD_PRESETS[lane]} quickView={quickView} />;
}
