"use client";

import { useMemo, useRef, useState } from "react";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  UNCIRCLED_ID,
  UNCIRCLED_NAME,
  circleColor,
  closeness,
  isProactive,
  placeCircles,
  shadeColor,
  shortContactName,
} from "@/lib/contact-circles";
import { cn } from "@/lib/utils";

export type CircleContact = {
  id: string;
  name: string;
  categoryId: string | null;
  category: { id: string; name: string; color: string } | null;
  importance: number;
  contactFrequencyDays: number;
  lastContactAt: string | null;
  responseLevel: number | null;
};

type Category = { id: string; name: string; color: string };

type Props = {
  contacts: CircleContact[];
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onLog: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, categoryId: string | null) => void;
};

export function ContactCircleMap({
  contacts,
  categories,
  selectedId,
  onSelect,
  onEdit,
  onLog,
  onDelete,
  onMove,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverCircle, setHoverCircle] = useState<string | null>(null);

  const placed = useMemo(() => {
    const byId = new Map<string, CircleContact[]>(categories.map((c) => [c.id, []]));
    byId.set(UNCIRCLED_ID, []);
    for (const c of contacts) {
      const key = c.categoryId ?? UNCIRCLED_ID;
      const list = byId.get(key) ?? [];
      list.push(c);
      byId.set(key, list);
    }
    const groups = [...byId.entries()].map(([id, members], index) => {
      const category = categories.find((c) => c.id === id);
      const name = category?.name ?? UNCIRCLED_NAME;
      const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name, "zh"));
      return {
        id,
        name,
        color: category?.color ?? circleColor(name, index),
        memberIds: sorted.map((m) => m.id),
      };
    });
    return placeCircles(groups);
  }, [contacts, categories]);

  const byContact = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  const bounds = useMemo(() => {
    if (placed.length === 0) return { w: 640, h: 420 };
    const maxX = Math.max(...placed.map((c) => c.cx + c.r)) + 28;
    const maxY = Math.max(...placed.map((c) => c.cy + c.r)) + 28;
    return { w: Math.max(640, maxX), h: Math.max(420, maxY) };
  }, [placed]);

  const selected = selectedId ? byContact.get(selectedId) : undefined;


  const circleAt = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const loc = pt.matrixTransform(ctm.inverse());
    return (
      placed.find((c) => Math.hypot(c.cx - loc.x, c.cy - loc.y) <= c.r)?.id ?? null
    );
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2">
        <span className="text-xs text-zinc-500">圈子地图 · 可滚动查看</span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" aria-label="缩小地图" disabled={zoom <= 0.75} onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}>−</Button>
          <button type="button" className="w-12 text-xs text-zinc-500" title="重置缩放" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <Button size="sm" variant="ghost" aria-label="放大地图" disabled={zoom >= 2} onClick={() => setZoom((z) => Math.min(2, z + 0.25))}>＋</Button>
        </div>
      </div>
      <div className="max-h-[560px] overflow-auto overscroll-contain">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${bounds.w} ${bounds.h}`}
        className="w-full h-auto bg-zinc-50"
        style={{ minWidth: bounds.w * zoom }}
        onPointerMove={(e) => {
          if (!dragId) return;
          setHoverCircle(circleAt(e.clientX, e.clientY));
        }}
        onPointerUp={(e) => {
          if (!dragId) return;
          const target = circleAt(e.clientX, e.clientY);
          const person = byContact.get(dragId);
          if (person && target && target !== (person.categoryId ?? UNCIRCLED_ID)) {
            onMove(dragId, target === UNCIRCLED_ID ? null : target);
          }
          setDragId(null);
          setHoverCircle(null);
        }}
        onPointerLeave={() => {
          if (dragId) {
            setDragId(null);
            setHoverCircle(null);
          }
        }}
      >
        {placed.map((circle) => (
          <g key={circle.id}>
            <circle
              cx={circle.cx}
              cy={circle.cy}
              r={circle.r}
              fill={circle.color}
              fillOpacity={hoverCircle === circle.id ? 0.16 : 0.07}
              stroke={circle.color}
              strokeOpacity={0.55}
              strokeWidth={hoverCircle === circle.id ? 2.5 : 1.25}
            />
            <text
              x={circle.cx}
              y={circle.cy}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={circle.color}
              fontSize={13}
              fontWeight={650}
            >
              {circle.name}
            </text>
            <text
              x={circle.cx}
              y={circle.cy + 16}
              textAnchor="middle"
              fill={circle.color}
              fillOpacity={0.7}
              fontSize={10}
            >
              {circle.nodes.length}
            </text>
          </g>
        ))}
        {placed.flatMap((circle) =>
          circle.nodes.map((node) => {
            const person = byContact.get(node.id);
            if (!person) return null;
            const score = closeness(person);
            const proactive = isProactive(person.responseLevel);
            const active = selectedId === person.id;
            return (
              <g
                key={person.id}
                transform={`translate(${node.x} ${node.y})`}
                className="cursor-pointer outline-none focus:opacity-70"
                role="button"
                tabIndex={0}
                aria-label={`${person.name}，${circle.name}`}
                aria-pressed={active}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(person.id); } }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDragId(person.id);
                  (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(person.id);
                }}
              >
                {proactive && (
                  <circle r={16} fill="none" stroke="#b45309" strokeWidth={1.6} strokeDasharray="3 2" />
                )}
                <circle
                  r={active ? 13 : 11}
                  fill={shadeColor(circle.color, score)}
                  stroke={active ? "#18181b" : "white"}
                  strokeWidth={active ? 2 : 1.5}
                  opacity={dragId === person.id ? 0.45 : 1}
                />
                <text
                  y={1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={9}
                  fill="#18181b"
                  style={{ pointerEvents: "none" }}
                >
                  {shortContactName(person.name)}
                </text>
                <title>
                  {person.name}
                  {proactive ? " · 对方主动" : ""}
                  {` · 密切 ${Math.round(score * 100)}`}
                </title>
              </g>
            );
          })
        )}
      </svg>
      </div>

      {selected && (
        <div
          className="flex flex-wrap items-center gap-1 border-t border-zinc-100 bg-white px-3 py-2"
        >
          <span className="text-xs font-medium text-zinc-800 max-w-[140px] truncate pr-1">
            {selected.name}
          </span>
          {isProactive(selected.responseLevel) && (
            <span className="text-[10px] font-medium text-amber-800 bg-amber-100 rounded px-1.5 py-0.5">
              主动
            </span>
          )}
          <Button size="sm" variant="ghost" title="编辑" onClick={() => onEdit(selected.id)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" title="记录联系" onClick={() => onLog(selected.id)}>
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" title="删除" onClick={() => onDelete(selected.id)}>
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </Button>
          <select
            className="text-[11px] border border-zinc-200 rounded px-1 py-1 max-w-[88px]"
            value={selected.categoryId ?? ""}
            onChange={(e) => onMove(selected.id, e.target.value || null)}
            aria-label="换圈子"
          >
            <option value="">未分圈</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={cn("flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 text-[11px] text-zinc-500 border-t border-zinc-100")}>
        <span>颜色深浅是联系密切程度：重要程度、联系周期、最近一次联系。</span>
        <span>虚线圆圈是对方主动（回应积极度 5）。</span>
        <span>拖到另一个圈子，或在选中后的菜单里换圈子。</span>
      </div>
    </div>
  );
}
