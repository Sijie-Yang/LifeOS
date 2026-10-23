"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  GOAL_STATUS,
  MEETING_STATUS,
  OPPORTUNITY_STATUS,
  PROJECT_PRIORITY,
  PROJECT_STATUS,
} from "@/lib/utils";
import { SOURCE_LABELS, type TimelineItem, type TimelineSource } from "@/lib/timeline";

export type TimelineEditTarget = Pick<
  TimelineItem,
  "source" | "sourceId" | "title" | "href"
> & {
  detail?: string;
  start?: string;
  end?: string;
};

type EditForm = {
  title: string;
  detail: string;
  status: string;
  priority: string;
  startDate: string;
  endDate: string;
  date: string;
  time: string;
};

const FORESIGHT_SOURCES = new Set<TimelineSource>([
  "foresight-era",
  "foresight-vision",
  "foresight-prediction",
]);

function initialForm(target: TimelineEditTarget): EditForm {
  return {
    title: target.title,
    detail: target.detail ?? "",
    status: "",
    priority: "",
    startDate: target.start ?? "",
    endDate: target.end ?? "",
    date: target.start ?? "",
    time: "",
  };
}

function dateValue(value: unknown) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function formFromData(target: TimelineEditTarget, data: Record<string, unknown>): EditForm {
  if (target.source === "project") {
    return {
      ...initialForm(target),
      title: String(data.name ?? target.title),
      detail: String(data.description ?? ""),
      status: String(data.status ?? ""),
      priority: String(data.priority ?? ""),
      startDate: dateValue(data.startDate),
      endDate: dateValue(data.targetDate),
    };
  }
  if (target.source === "opportunity") {
    return {
      ...initialForm(target),
      title: String(data.title ?? target.title),
      detail: String(data.nextAction ?? ""),
      status: String(data.status ?? ""),
      priority: String(data.priority ?? ""),
      date: dateValue(data.deadline),
    };
  }
  if (target.source === "meeting") {
    return {
      ...initialForm(target),
      title: String(data.title ?? target.title),
      detail: String(data.purpose ?? ""),
      status: String(data.status ?? ""),
      priority: String(data.priority ?? ""),
      date: dateValue(data.meetingDate),
      time: String(data.meetingTime ?? "").slice(0, 5),
    };
  }
  if (target.source === "goal") {
    return {
      ...initialForm(target),
      title: String(data.title ?? target.title),
      detail: String(data.description ?? ""),
      status: String(data.status ?? ""),
      date: dateValue(data.targetDate),
    };
  }
  if (target.source === "strategy-phase") {
    return {
      ...initialForm(target),
      title: String(data.title ?? target.title),
      detail: String(data.summary ?? ""),
      status: String(data.status ?? ""),
      startDate: dateValue(data.startDate),
      endDate: dateValue(data.endDate),
    };
  }
  return initialForm(target);
}

function loadUrl(target: TimelineEditTarget) {
  if (target.source === "project") return `/api/projects/${target.sourceId}`;
  if (target.source === "opportunity") return `/api/opportunities/${target.sourceId}`;
  if (target.source === "meeting") return `/api/meetings/${target.sourceId}`;
  if (target.source === "goal") return `/api/goals/${target.sourceId}`;
  if (target.source === "strategy-phase") return "/api/strategy";
  return null;
}

export function TimelineEntityEditor({
  target,
  onClose,
  onSaved,
}: {
  target: TimelineEditTarget | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  if (!target) return null;
  return (
    <TimelineEntityEditorBody
      key={`${target.source}:${target.sourceId}`}
      target={target}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function TimelineEntityEditorBody({
  target,
  onClose,
  onSaved,
}: {
  target: TimelineEditTarget;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState(() => initialForm(target));
  const [loading, setLoading] = useState(Boolean(loadUrl(target)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = loadUrl(target);
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("加载失败");
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const data =
          target.source === "strategy-phase"
            ? ((payload.phases as Array<Record<string, unknown>> | undefined)?.find(
                (phase) => phase.id === target.sourceId
              ) ?? {})
            : payload;
        setForm(formFromData(target, data));
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [target]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      let url = "";
      let body: Record<string, unknown> = {};
      if (target.source === "project") {
        url = `/api/projects/${target.sourceId}`;
        body = {
          name: form.title,
          description: form.detail || null,
          status: form.status,
          priority: form.priority,
          startDate: form.startDate || null,
          targetDate: form.endDate || null,
        };
      } else if (target.source === "opportunity") {
        url = `/api/opportunities/${target.sourceId}`;
        body = {
          title: form.title,
          nextAction: form.detail || null,
          status: form.status,
          priority: form.priority,
          deadline: form.date || null,
        };
      } else if (target.source === "meeting") {
        url = `/api/meetings/${target.sourceId}`;
        body = {
          title: form.title,
          purpose: form.detail || null,
          status: form.status,
          priority: form.priority,
          meetingDate: form.date,
          meetingTime: form.time || null,
        };
      } else if (target.source === "goal") {
        url = `/api/goals/${target.sourceId}`;
        body = {
          title: form.title,
          description: form.detail || null,
          status: form.status,
          targetDate: form.date || null,
        };
      } else if (target.source === "strategy-phase") {
        url = "/api/strategy/phases";
        body = {
          id: target.sourceId,
          title: form.title,
          summary: form.detail || null,
          status: form.status,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        };
      } else if (FORESIGHT_SOURCES.has(target.source)) {
        url = "/api/timeline/override";
        body = {
          source: target.source,
          sourceId: target.sourceId,
          title: form.title,
          detail: form.detail,
          startDate:
            target.source === "foresight-era"
              ? form.startDate || null
              : form.date || null,
          endDate: form.endDate || null,
        };
      } else {
        throw new Error("此类型暂不支持编辑");
      }

      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "保存失败");
      }
      onClose();
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const isProject = target.source === "project";
  const isOpportunity = target.source === "opportunity";
  const isMeeting = target.source === "meeting";
  const isGoal = target.source === "goal";
  const isPhase = target.source === "strategy-phase";
  const isForesight = FORESIGHT_SOURCES.has(target.source);

  return (
    <Modal
      open
      onClose={onClose}
      title={`编辑${SOURCE_LABELS[target.source]}`}
      wide
    >
      {loading ? (
        <p className="py-8 text-center text-sm text-zinc-500">加载中…</p>
      ) : (
        <div className="space-y-4">
          <Field>
            <Label>标题</Label>
            <Input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </Field>

          {(isProject || isOpportunity || isMeeting || isGoal || isPhase || isForesight) && (
            <Field>
              <Label>
                {isOpportunity ? "下一步" : isMeeting ? "目的" : isPhase ? "摘要" : "说明"}
              </Label>
              <Textarea
                value={form.detail}
                onChange={(event) => setForm({ ...form, detail: event.target.value })}
              />
            </Field>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(isProject || isOpportunity || isMeeting || isGoal || isPhase) && (
              <Field>
                <Label>状态</Label>
                <Select
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                >
                  {Object.entries(
                    isProject
                      ? PROJECT_STATUS
                      : isOpportunity
                        ? OPPORTUNITY_STATUS
                        : isMeeting
                          ? MEETING_STATUS
                          : isGoal
                            ? GOAL_STATUS
                            : {
                                planned: { label: "计划中" },
                                active: { label: "进行中" },
                                completed: { label: "已完成" },
                              }
                  ).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {(isProject || isOpportunity || isMeeting) && (
              <Field>
                <Label>优先级</Label>
                <Select
                  value={form.priority}
                  onChange={(event) => setForm({ ...form, priority: event.target.value })}
                >
                  {Object.entries(PROJECT_PRIORITY).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          {(isProject || isPhase || (isForesight && target.source === "foresight-era")) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <Label>开始日期</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                />
              </Field>
              <Field>
                <Label>结束日期</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                />
              </Field>
            </div>
          )}

          {(isOpportunity || isMeeting || isGoal || (isForesight && target.source !== "foresight-era")) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <Label>{isMeeting ? "会议日期" : isOpportunity ? "截止日期" : "日期"}</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                />
              </Field>
              {isMeeting && (
                <Field>
                  <Label>时间</Label>
                  <Input
                    type="time"
                    value={form.time}
                    onChange={(event) => setForm({ ...form, time: event.target.value })}
                  />
                </Field>
              )}
            </div>
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button disabled={saving || !form.title.trim()} onClick={() => void save()}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
