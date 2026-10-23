"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Activity } from "lucide-react";

export type WellnessTrendPoint = {
  weekStart: string;
  label: string;
  avgEnergy: number | null;
  avgMood: number | null;
  avgSleep: number | null;
  logDays: number;
};

function LineChart({
  data,
  valueKey,
  color,
  suffix = "",
  max = 5,
}: {
  data: WellnessTrendPoint[];
  valueKey: "avgEnergy" | "avgMood" | "avgSleep";
  color: string;
  suffix?: string;
  max?: number;
}) {
  const values = data.map((d) => d[valueKey]).filter((v): v is number => v != null);
  if (values.length === 0) {
    return <p className="text-xs text-zinc-400 text-center py-6">暂无数据</p>;
  }

  const chartMax = valueKey === "avgSleep" ? Math.max(...values, 8) : max;

  return (
    <div className="flex items-end gap-1 h-24 pt-2">
      {data.map((d) => {
        const v = d[valueKey];
        const h = v != null ? Math.max(6, (v / chartMax) * 100) : 4;
        return (
          <div key={d.weekStart} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-[9px] text-zinc-400 truncate w-full text-center">{d.label}</span>
            <div
              className={`w-full rounded-t min-h-[4px] ${v != null ? color : "bg-zinc-100"}`}
              style={{ height: `${h}%` }}
              title={v != null ? `${d.label}: ${v.toFixed(1)}${suffix}` : "无记录"}
            />
          </div>
        );
      })}
    </div>
  );
}

export function WellnessTrendChart({ data }: { data: WellnessTrendPoint[] }) {
  if (data.length < 2) {
    return (
      <Card className="mb-6">
        <CardContent className="py-8 text-center text-sm text-zinc-500">
          身心数据不足，无法展示趋势（至少需要 2 周记录）
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-5 w-5 text-violet-500" />
          身心状态趋势
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="text-xs font-medium text-zinc-500 mb-2">平均精力 (1-5)</p>
          <LineChart data={data} valueKey="avgEnergy" color="bg-violet-400" />
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-500 mb-2">平均情绪 (1-5)</p>
          <LineChart data={data} valueKey="avgMood" color="bg-pink-400" />
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-500 mb-2">平均睡眠 (小时)</p>
          <LineChart data={data} valueKey="avgSleep" color="bg-indigo-400" suffix="h" max={10} />
        </div>
      </CardContent>
    </Card>
  );
}
