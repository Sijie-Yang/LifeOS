"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState } from "@/components/ui/Badge";
import { Input, Textarea, Label, Field } from "@/components/ui/Input";
import {
  CachedContent,
  fetchJson,
  invalidateFetchCache,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import {
  RECORD_DOMAINS,
  RECORD_DOMAIN_META,
  type LifeRecordDto,
  type RecordDomain,
} from "@/lib/life-records-meta";
import { cn, toDateString } from "@/lib/utils";
import { Camera, ImagePlus, Trash2, Pin, BookOpen, FlaskConical, HeartPulse, Users } from "lucide-react";

type RecordsPayload = {
  records: LifeRecordDto[];
  stats: {
    total: number;
    withPhoto: number;
    activeDays: number;
    streak: number;
    byDomain: Record<string, { count: number; withPhoto: number }>;
    days28: Array<{ date: string; count: number }>;
  };
};

const DOMAIN_ICON = {
  reading: BookOpen,
  research: FlaskConical,
  body: HeartPulse,
  social: Users,
} as const;

type DomainFilter = "all" | RecordDomain;

function metaLine(r: LifeRecordDto) {
  const m = r.meta || {};
  const parts = [m.subject, m.detail, m.note, m.chapter, m.paper, m.place, m.people]
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  return parts.join(" · ");
}

export default function RecordsPage() {
  const [domain, setDomain] = useState<DomainFilter>("all");
  const [data, setData] = useState<RecordsPayload | null>(() =>
    peekFetchCache<RecordsPayload>("/api/records")
  );
  const [loading, setLoading] = useState(() => shouldShowPageLoading(["/api/records"]));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formDomain, setFormDomain] = useState<RecordDomain>("body");
  const [date, setDate] = useState(toDateString());
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const qs = domain === "all" ? "" : `?domain=${domain}`;
    const url = `/api/records${qs}`;
    if (shouldShowPageLoading([url])) setLoading(true);
    setError(null);
    try {
      setData(await fetchJson<RecordsPayload>(url));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const meta = RECORD_DOMAIN_META[formDomain];

  const grouped = useMemo(() => {
    const map = new Map<string, LifeRecordDto[]>();
    for (const r of data?.records ?? []) {
      if (!map.has(r.date)) map.set(r.date, []);
      map.get(r.date)!.push(r);
    }
    return [...map.entries()];
  }, [data]);

  const submit = async () => {
    if (!title.trim()) {
      alert("请填标题");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("date", date);
      fd.set("domain", formDomain);
      fd.set("title", title.trim());
      fd.set("content", content);
      fd.set("subject", subject);
      if (photo) fd.set("photo", photo);
      const res = await fetch("/api/records", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || "保存失败");
        return;
      }
      setTitle("");
      setSubject("");
      setContent("");
      setPhoto(null);
      invalidateFetchCache("/api/records");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("删除这条记录？照片也会删掉。")) return;
    await fetch(`/api/records/${id}`, { method: "DELETE" });
    invalidateFetchCache("/api/records");
    await load();
  };

  const stats = data?.stats;

  return (
    <>
      <PageHeader
        title="记录中心"
        description="照片优先 · 阅读 / 研究 / 身材气质 / 社交 — 看见自己在变"
      />
      <CachedContent loading={loading} error={error} onRetry={load} hasData={!!data}>

      {/* Progress strip */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            ["连续记录", `${stats.streak} 天`],
            ["总条目", String(stats.total)],
            ["带照片", String(stats.withPhoto)],
            ["活跃天数", String(stats.activeDays)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
              <p className="text-[10px] text-zinc-400 uppercase tracking-wide">{k}</p>
              <p className="text-lg font-semibold text-zinc-900">{v}</p>
            </div>
          ))}
        </div>
      )}

      {/* 28-day heat */}
      {stats?.days28 && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white px-3 py-3">
          <p className="text-xs font-medium text-zinc-600 mb-2">近 28 天记录密度</p>
          <div className="flex flex-wrap gap-1">
            {stats.days28.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.count} 条`}
                className={cn(
                  "h-3.5 w-3.5 rounded-sm",
                  d.count === 0 && "bg-zinc-100",
                  d.count === 1 && "bg-amber-200",
                  d.count === 2 && "bg-amber-400",
                  d.count >= 3 && "bg-amber-600"
                )}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {RECORD_DOMAINS.map((d) => {
              const s = stats.byDomain[d];
              return (
                <div key={d} className={cn("rounded-md border px-2 py-1.5 text-[11px]", RECORD_DOMAIN_META[d].color)}>
                  <span className="font-medium">{RECORD_DOMAIN_META[d].label}</span>
                  <span className="ml-1 opacity-80">
                    {s?.count ?? 0} 条 · 照片 {s?.withPhoto ?? 0}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Capture */}
      <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-4 md:p-5">
        <h2 className="text-sm font-semibold text-zinc-800 mb-3 flex items-center gap-2">
          <Camera className="h-4 w-4 text-amber-700" />
          今日记录
        </h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {RECORD_DOMAINS.map((d) => {
            const Icon = DOMAIN_ICON[d];
            return (
              <button
                key={d}
                type="button"
                onClick={() => setFormDomain(d)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  formDomain === d
                    ? RECORD_DOMAIN_META[d].color + " ring-2 ring-offset-1 ring-amber-400"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {RECORD_DOMAIN_META[d].label}
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-zinc-500 mb-3">{meta.hint} — 能拍照就先拍照</p>

        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div>
            <div
              className={cn(
                "relative aspect-[3/4] rounded-lg border-2 border-dashed overflow-hidden bg-zinc-50",
                preview ? "border-amber-300" : "border-zinc-200"
              )}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="预览" className="h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 gap-2 px-3 text-center">
                  <ImagePlus className="h-8 w-8" />
                  <span className="text-xs">照片优先</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="h-3.5 w-3.5" /> 拍照
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="h-3.5 w-3.5" /> 相册
              </Button>
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
            {photo && (
              <button
                type="button"
                className="mt-1 text-[11px] text-zinc-500 hover:text-rose-600"
                onClick={() => setPhoto(null)}
              >
                清除照片
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label>日期</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field>
                <Label>补充标签</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={meta.placeholders.metaHint}
                />
              </Field>
            </div>
            <Field>
              <Label>标题</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={meta.placeholders.title}
              />
            </Field>
            <Field>
              <Label>文字（可选）</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={meta.placeholders.content}
                className="min-h-[88px]"
              />
            </Field>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? "保存中…" : "保存记录"}
            </Button>
          </div>
        </div>
      </section>

      {/* Filter feed */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setDomain("all")}
          className={cn(
            "text-xs px-3 py-1.5 rounded-full border font-medium",
            domain === "all"
              ? "bg-zinc-900 text-white border-transparent"
              : "border-zinc-200 text-zinc-600"
          )}
        >
          全部
        </button>
        {RECORD_DOMAINS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDomain(d)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border font-medium",
              domain === d
                ? RECORD_DOMAIN_META[d].color + " ring-1 ring-amber-400"
                : "border-zinc-200 text-zinc-600"
            )}
          >
            {RECORD_DOMAIN_META[d].label}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          title="还没有记录"
          description="先拍一张：书页、屏幕进度、身材、或一场见面"
        />
      ) : (
        <div className="space-y-8">
          {grouped.map(([day, items]) => (
            <section key={day}>
              <h3 className="text-sm font-semibold text-zinc-800 mb-3 sticky top-0 bg-[#f4f6f9]/90 backdrop-blur py-1 z-10">
                {day}
                <span className="ml-2 text-[11px] font-normal text-zinc-400">{items.length} 条</span>
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((r) => {
                  const dm = RECORD_DOMAIN_META[r.domain];
                  const Icon = DOMAIN_ICON[r.domain];
                  const extra = metaLine(r);
                  return (
                    <article
                      key={r.id}
                      className="rounded-xl border border-zinc-200 bg-white overflow-hidden flex flex-col"
                    >
                      {r.photoUrl ? (
                        <div className="relative aspect-[4/3] bg-zinc-100">
                          {/* next/image needs remote config for /api — use img for local API */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={r.photoUrl}
                            alt={r.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="aspect-[4/3] bg-zinc-50 flex items-center justify-center text-zinc-300">
                          <Icon className="h-10 w-10" />
                        </div>
                      )}
                      <div className="p-3 flex-1 flex flex-col">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Badge className={cn(dm.color, "text-[10px] px-1.5 py-0")}>
                            {dm.label}
                          </Badge>
                          {r.pinned && <Pin className="h-3 w-3 text-amber-600" />}
                        </div>
                        <h4 className="text-sm font-medium text-zinc-900">{r.title}</h4>
                        {extra && (
                          <p className="text-[11px] text-zinc-500 mt-0.5">{extra}</p>
                        )}
                        {r.content && (
                          <p className="text-[12px] text-zinc-600 mt-1.5 line-clamp-3 whitespace-pre-wrap">
                            {r.content}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => void remove(r.id)}
                          className="mt-auto pt-3 self-end text-zinc-400 hover:text-rose-600"
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      </CachedContent>
    </>
  );
}
