"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea, Label, Field } from "@/components/ui/Input";
import { Trash2 } from "lucide-react";
import type { DayScheduleBlockItem } from "@/components/schedule/DayScheduleGrid";

export type DayScheduleForm = {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  color: string;
  taskId: string;
  goalId: string;
};

type TaskOption = { id: string; title: string };
type GoalOption = { id: string; title: string };

type DayScheduleBlockModalProps = {
  open: boolean;
  editing: DayScheduleBlockItem | null;
  form: DayScheduleForm;
  tasks: TaskOption[];
  goals: GoalOption[];
  onClose: () => void;
  onChange: (form: DayScheduleForm) => void;
  onSave: () => void;
  onDelete?: () => void;
};

export function DayScheduleBlockModal({
  open,
  editing,
  form,
  tasks,
  goals,
  onClose,
  onChange,
  onSave,
  onDelete,
}: DayScheduleBlockModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={editing ? "编辑时间块" : "添加时间块"}>
      <div className="space-y-4">
        <Field>
          <Label>标题 *</Label>
          <Input value={form.title} onChange={(e) => onChange({ ...form, title: e.target.value })} />
        </Field>
        <Field>
          <Label>描述</Label>
          <Textarea
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <Label>开始</Label>
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => onChange({ ...form, startTime: e.target.value })}
            />
          </Field>
          <Field>
            <Label>结束</Label>
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => onChange({ ...form, endTime: e.target.value })}
            />
          </Field>
          <Field>
            <Label>关联任务</Label>
            <Select value={form.taskId} onChange={(e) => onChange({ ...form, taskId: e.target.value })}>
              <option value="">无</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label>关联目标</Label>
            <Select value={form.goalId} onChange={(e) => onChange({ ...form, goalId: e.target.value })}>
              <option value="">无</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field>
          <Label>颜色</Label>
          <Input
            type="color"
            value={form.color}
            onChange={(e) => onChange({ ...form, color: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex justify-between mt-6">
        {editing && onDelete ? (
          <Button variant="danger" size="sm" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" /> 删除
          </Button>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={onSave} disabled={!form.title}>
            保存
          </Button>
        </div>
      </div>
    </Modal>
  );
}
