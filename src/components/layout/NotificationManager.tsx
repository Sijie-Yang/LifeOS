"use client";

import { useCallback, useEffect, useRef } from "react";
import { toDateString } from "@/lib/utils";

const MORNING_HOUR = 8;
const EVENING_HOUR = 21;

async function shouldSendNudge(key: string, date: string): Promise<boolean> {
  const res = await fetch(`/api/nudge?date=${date}`);
  if (!res.ok) return false;
  const data = await res.json();
  return !data.sent?.includes(key);
}

async function markNudgeSent(key: string, date: string) {
  await fetch("/api/nudge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, date }),
  });
}

async function fetchBriefing(date: string) {
  const res = await fetch(`/api/briefing?date=${date}`);
  if (!res.ok) return null;
  return res.json();
}

function minutesUntilBedtime(bedtimeTarget: string, now = new Date()): number | null {
  const [h, m] = bedtimeTarget.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

async function notifyDeadlineDigest(date: string) {
  const key = "deadline-browser";
  if (!(await shouldSendNudge(key, date))) return;

  const res = await fetch("/api/reminders");
  if (!res.ok) return;
  const data = await res.json();
  const tasks = (data.tasksDueSoon || []) as Array<{ title: string; daysLeft: number }>;
  const opps = (data.opportunitiesDueSoon || []) as Array<{ title: string; daysLeft: number }>;
  const urgentTasks = tasks.filter((t) => t.daysLeft <= 3);
  const urgentOpps = opps.filter((o) => o.daysLeft <= 3);
  if (urgentTasks.length === 0 && urgentOpps.length === 0) return;

  const parts: string[] = [];
  if (urgentTasks.length) parts.push(`${urgentTasks.length} 个任务 ≤3 天`);
  if (urgentOpps.length) parts.push(`${urgentOpps.length} 个机会 ≤3 天`);
  new Notification("LifeOS 截止提醒", {
    body: parts.join(" · "),
    tag: key,
    icon: "/favicon.ico",
  });
  await markNudgeSent(key, date);
}

export function NotificationManager() {
  const checkedRef = useRef<string>("");

  const tryNotify = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const now = new Date();
    const hour = now.getHours();
    const date = toDateString(now);

    // Bedtime wind-down (30 min before target)
    try {
      const settingsRes = await fetch("/api/settings");
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        if (settings.bedtimeTarget) {
          const mins = minutesUntilBedtime(settings.bedtimeTarget, now);
          const bedtimeKey = "bedtime-winddown";
          if (mins != null && mins <= 30 && mins >= 25) {
            if (await shouldSendNudge(bedtimeKey, date)) {
              new Notification("LifeOS 睡前提醒", {
                body: `距目标就寝（${settings.bedtimeTarget}）还有约 ${mins} 分钟，开始 wind-down？`,
                tag: bedtimeKey,
                icon: "/favicon.ico",
              });
              await markNudgeSent(bedtimeKey, date);
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // Deadline digest once per day when app is open during daytime
    if (hour >= MORNING_HOUR && hour < EVENING_HOUR) {
      try {
        await notifyDeadlineDigest(date);
      } catch {
        // ignore
      }
    }

    const slot = hour >= MORNING_HOUR && hour < 12 ? "morning" : hour >= EVENING_HOUR ? "evening" : null;
    if (!slot) return;

    const checkKey = `${date}-${slot}`;
    if (checkedRef.current === checkKey) return;
    checkedRef.current = checkKey;

    const nudgeKey = slot === "morning" ? "morning-briefing" : "evening-close";
    if (!(await shouldSendNudge(nudgeKey, date))) return;

    const briefing = await fetchBriefing(date);
    if (!briefing) return;

    if (slot === "morning") {
      const parts: string[] = [];
      if (briefing.mustDoCount > 0) parts.push(`${briefing.mustDoCount} 项必做`);
      if (briefing.tasks?.length) parts.push(`${briefing.tasks.length} 个任务`);
      if (briefing.meetings?.length) parts.push(`${briefing.meetings.length} 场会议`);
      const body = parts.length > 0 ? parts.join(" · ") : "查看今日安排";
      new Notification("LifeOS 晨间简报", {
        body,
        tag: nudgeKey,
        icon: "/favicon.ico",
      });
    } else {
      const parts: string[] = [];
      if (briefing.uncheckedHabits?.length) parts.push(`${briefing.uncheckedHabits.length} 个习惯未打卡`);
      if (!briefing.hasWellness) parts.push("状态未记录");
      if (parts.length === 0) return;
      new Notification("LifeOS 晚间收尾", {
        body: parts.join(" · "),
        tag: nudgeKey,
        icon: "/favicon.ico",
      });
    }

    await markNudgeSent(nudgeKey, date);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const requestPermission = () => {
      if (Notification.permission === "default") {
        void Notification.requestPermission();
      }
    };

    requestPermission();
    void tryNotify();

    const interval = window.setInterval(() => void tryNotify(), 15 * 60 * 1000);
    const onFocus = () => void tryNotify();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [tryNotify]);

  return null;
}
