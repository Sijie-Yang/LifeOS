"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Badge";
import { PageLoading, PageError, fetchJson, invalidateFetchCache } from "@/components/ui/PageState";
import { DayScheduleGrid, type DayScheduleBlockItem } from "@/components/schedule/DayScheduleGrid";
import {
  DayScheduleBlockModal,
  type DayScheduleForm,
} from "@/components/schedule/DayScheduleBlockModal";
import { isWeeklyVirtualId, weeklyIdFromVirtual } from "@/lib/day-schedule";

type GoalOption = { id: string; title: string };
type TaskOption = { id: string; title: string };

const emptyForm: DayScheduleForm = {
  title: "",
  description: "",
  startTime: "09:00",
  endTime: "10:00",
  color: "#6366f1",
  taskId: "",
  goalId: "",
};

function addOneHour(time: string) {
  const [h, m] = time.split(":").map(Number);
  const next = h + 1;
  if (next >= 24) return "23:59";
  return `${String(next).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type DaySchedulePanelProps = {
  date: string;
  /** When true, show a section header suitable for embedding under 日计划 */
  embedded?: boolean;
  showNowLine?: boolean;
};

export function DaySchedulePanel({ date, embedded = false, showNowLine = true }: DaySchedulePanelProps) {
  const [blocks, setBlocks] = useState<DayScheduleBlockItem[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [goals, setGoals] = useState<GoalOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DayScheduleBlockItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: string, force = false) => {
    if (force) invalidateFetchCache(`/api/day-schedule?date=${d}`);
    setLoading(true);
    setError(null);
    try {
      const [blocksData, tasksData, goalsData] = await Promise.all([
        fetchJson<DayScheduleBlockItem[]>(`/api/day-schedule?date=${d}`, { force }),
        fetchJson<{ tasks: TaskOption[] }>("/api/tasks?filter=open", { force }),
        fetchJson<GoalOption[]>("/api/goals", { force }),
      ]);
      setBlocks(blocksData);
      setTasks(tasksData.tasks ?? []);
      setGoals(goalsData.map((g) => ({ id: g.id, title: g.title })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const openCreate = (startTime?: string) => {
    setEditing(null);
    const start = startTime ?? "09:00";
    setForm({ ...emptyForm, startTime: start, endTime: addOneHour(start) });
    setModalOpen(true);
  };

  const openEdit = (block: DayScheduleBlockItem) => {
    if (isWeeklyVirtualId(block.id)) return;
    setEditing(block);
    setForm({
      title: block.title,
      description: block.description || "",
      startTime: block.startTime,
      endTime: block.endTime,
      color: block.color,
      taskId: block.taskId || "",
      goalId: block.goalId || "",
    });
    setModalOpen(true);
  };

  const save = async () => {
    const payload = {
      ...form,
      date,
      taskId: form.taskId || null,
      goalId: form.goalId || null,
    };
    if (editing) {
      await fetch(`/api/day-schedule/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/day-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setModalOpen(false);
    void load(date, true);
  };

  const skipHabitBlock = async (block: DayScheduleBlockItem) => {
    const scheduleBlockId =
      block.scheduleBlockId ?? (isWeeklyVirtualId(block.id) ? weeklyIdFromVirtual(block.id) : null);
    if (!scheduleBlockId) return;
    if (!confirm(`今日跳过「${block.title}」？只影响今天，下周同日仍会显示。`)) return;

    setBlocks((prev) => prev.filter((b) => b.id !== block.id));
    await fetch("/api/day-schedule/skip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, scheduleBlockId }),
    });
    void load(date, true);
  };

  const remove = async () => {
    if (!editing || !confirm("确定删除？")) return;
    if (editing.scheduleBlockId) {
      await skipHabitBlock(editing);
      setModalOpen(false);
      return;
    }
    await fetch(`/api/day-schedule/${editing.id}`, { method: "DELETE" });
    setModalOpen(false);
    void load(date, true);
  };

  const handleBlockTimeChange = async (id: string, startTime: string, endTime: string) => {
    if (isWeeklyVirtualId(id)) {
      const scheduleBlockId = weeklyIdFromVirtual(id);
      setBlocks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, startTime, endTime } : b))
      );
      const res = await fetch("/api/day-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, scheduleBlockId, startTime, endTime }),
      });
      if (res.ok) {
        const created = (await res.json()) as DayScheduleBlockItem;
        setBlocks((prev) => [...prev.filter((b) => b.id !== id), created]);
      } else {
        void load(date, true);
      }
      return;
    }

    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, startTime, endTime } : b))
    );
    await fetch(`/api/day-schedule/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime, endTime }),
    });
  };

  const toolbar = (
    <div className="flex items-center gap-2">
      {embedded && (
        <Link href="/calendar/week">
          <Button variant="secondary" size="sm">
            <Clock className="h-4 w-4" /> 周日历
          </Button>
        </Link>
      )}
      <Button size="sm" onClick={() => openCreate()}>
        <Plus className="h-4 w-4" /> 添加时间块
      </Button>
    </div>
  );

  const body = (
    <>
      {loading && blocks.length === 0 && !error ? (
        <PageLoading />
      ) : error && blocks.length === 0 ? (
        <PageError message={error} onRetry={() => void load(date, true)} />
      ) : blocks.length === 0 ? (
        <EmptyState
          title="今日暂无安排"
          description="点击时间格或「添加时间块」开始规划；有周习惯时会自动显示"
        />
      ) : (
        <DayScheduleGrid
          blocks={blocks}
          showNowLine={showNowLine}
          onBlockClick={openEdit}
          onSlotClick={openCreate}
          onBlockTimeChange={handleBlockTimeChange}
          onHabitSkip={(block) => void skipHabitBlock(block)}
        />
      )}

      <DayScheduleBlockModal
        open={modalOpen}
        editing={editing}
        form={form}
        tasks={tasks}
        goals={goals}
        onClose={() => setModalOpen(false)}
        onChange={setForm}
        onSave={() => void save()}
        onDelete={editing ? () => void remove() : undefined}
      />
    </>
  );

  if (!embedded) {
    return (
      <>
        <div className="flex justify-end mb-3">{toolbar}</div>
        {body}
      </>
    );
  }

  return (
    <Card className="mt-6 border-emerald-100/80">
      <CardHeader className="flex flex-row items-center justify-between gap-3 py-3 px-4 border-b border-emerald-50">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-emerald-600" />
          日时间表
        </CardTitle>
        {toolbar}
      </CardHeader>
      <CardContent className="p-3 sm:p-4">{body}</CardContent>
    </Card>
  );
}
