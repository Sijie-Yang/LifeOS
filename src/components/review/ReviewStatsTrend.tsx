"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { fmtMoney } from "@/lib/utils";

export type ReviewTrendPoint = {
  key: string;
  label: string;
  habitRate: number;
  habitCheckIns: number;
  habitExpected: number;
  avgProgress: number;
  contacted: number;
  contentPublished?: number;
  monthBalance?: number;
};

function MiniBarChart({
  data,
  valueKey,
  suffix = "",
  color = "bg-indigo-400",
  formatValue,
}: {
  data: ReviewTrendPoint[];
  valueKey: keyof ReviewTrendPoint;
  suffix?: string;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  if (data.length === 0) return null;
  const values = data.map((d) => Number(d[valueKey]) || 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  return (
    <div className="flex items-end gap-1 h-24 pt-2">
      {data.map((d) => {
        const v = Number(d[valueKey]) || 0;
        const h = Math.max(6, ((v - min) / range) * 100);
        const display = formatValue ? formatValue(v) : `${v}${suffix}`;
        return (
          <div key={d.key} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-[9px] text-zinc-400 truncate w-full text-center" title={display}>
              {d.label}
            </span>
            <div
              className={`w-full rounded-t ${color} transition-all min-h-[4px]`}
              style={{ height: `${h}%` }}
              title={`${d.label}: ${display}`}
            />
          </div>
        );
      })}
    </div>
  );
}

export function ReviewStatsTrend({
  data,
  currentKey,
  showFinance = false,
  periodUnit = "期",
}: {
  data: ReviewTrendPoint[];
  currentKey: string;
  showFinance?: boolean;
  periodUnit?: string;
}) {
  if (data.length < 2) {
    return (
      <Card className="mb-6">
        <CardContent className="py-8 text-center text-sm text-zinc-500">
          数据不足，无法展示趋势（至少需要 2 个{periodUnit}）
        </CardContent>
      </Card>
    );
  }

  const current = data.find((d) => d.key === currentKey);
  const prev = data[data.findIndex((d) => d.key === currentKey) - 1];

  const delta = (cur: number, prevVal: number | undefined) => {
    if (prevVal === undefined) return null;
    const d = cur - prevVal;
    if (d === 0) return "→ 持平";
    return d > 0 ? `↑ +${d}` : `↓ ${d}`;
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>数据趋势（近 {data.length} {periodUnit}）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <p className="text-sm font-medium text-zinc-700">习惯完成率</p>
              {current && prev && (
                <span className={`text-xs ${current.habitRate >= prev.habitRate ? "text-emerald-600" : "text-red-500"}`}>
                  {delta(current.habitRate, prev.habitRate)}%
                </span>
              )}
            </div>
            <MiniBarChart data={data} valueKey="habitRate" suffix="%" color="bg-emerald-400" />
          </div>
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <p className="text-sm font-medium text-zinc-700">项目均进度</p>
              {current && prev && (
                <span className={`text-xs ${current.avgProgress >= prev.avgProgress ? "text-emerald-600" : "text-red-500"}`}>
                  {delta(current.avgProgress, prev.avgProgress)}%
                </span>
              )}
            </div>
            <MiniBarChart data={data} valueKey="avgProgress" suffix="%" color="bg-amber-400" />
          </div>
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <p className="text-sm font-medium text-zinc-700">联系人数</p>
              {current && prev && (
                <span className="text-xs text-zinc-500">{delta(current.contacted, prev.contacted)} 人</span>
              )}
            </div>
            <MiniBarChart data={data} valueKey="contacted" suffix="" color="bg-pink-400" />
          </div>
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <p className="text-sm font-medium text-zinc-700">打卡次数</p>
              {current && prev && (
                <span className="text-xs text-zinc-500">{delta(current.habitCheckIns, prev.habitCheckIns)} 次</span>
              )}
            </div>
            <MiniBarChart data={data} valueKey="habitCheckIns" suffix="" color="bg-indigo-400" />
          </div>
          {showFinance && (
            <div className="md:col-span-2">
              <div className="flex justify-between items-baseline mb-2">
                <p className="text-sm font-medium text-zinc-700">收支结余</p>
                {current?.monthBalance != null && prev?.monthBalance != null && (
                  <span className={`text-xs ${current.monthBalance >= prev.monthBalance ? "text-emerald-600" : "text-red-500"}`}>
                    {delta(current.monthBalance, prev.monthBalance)}
                  </span>
                )}
              </div>
              <MiniBarChart
                data={data}
                valueKey="monthBalance"
                color="bg-violet-400"
                formatValue={(v) => fmtMoney(v, "CNY", { showSign: true })}
              />
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-100">
                <th className="text-left py-2 pr-2">{periodUnit}份</th>
                <th className="text-right py-2 px-1">习惯%</th>
                <th className="text-right py-2 px-1">打卡</th>
                <th className="text-right py-2 px-1">项目%</th>
                <th className="text-right py-2 px-1">联系</th>
                {showFinance && <th className="text-right py-2 pl-1">结余</th>}
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr
                  key={d.key}
                  className={`border-b border-zinc-50 ${d.key === currentKey ? "bg-indigo-50/60 font-medium" : ""}`}
                >
                  <td className="py-2 pr-2 text-zinc-700">{d.label}</td>
                  <td className="text-right py-2 px-1">{d.habitRate}%</td>
                  <td className="text-right py-2 px-1">{d.habitCheckIns}/{d.habitExpected || "—"}</td>
                  <td className="text-right py-2 px-1">{d.avgProgress}%</td>
                  <td className="text-right py-2 px-1">{d.contacted}</td>
                  {showFinance && (
                    <td className={`text-right py-2 pl-1 ${(d.monthBalance ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {d.monthBalance != null ? fmtMoney(d.monthBalance, "CNY", { showSign: true }) : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
