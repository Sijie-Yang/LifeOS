"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Label, Field, Textarea } from "@/components/ui/Input";
import { invalidateFetchCache } from "@/components/ui/PageState";
import { URGE_TRIGGERS, URGE_OUTCOMES, URGES_UPDATED_EVENT, type UrgeOutcome } from "@/lib/urges";
import { Waves, X } from "lucide-react";

type Category = { id: string; name: string; color: string; isPrivate: boolean };

type Step = "closed" | "pick" | "surf" | "log";

const BREATH_TEXTS = [
  "冲动像浪，会自己退下去。",
  "不用立刻行动，先呼吸。",
  "90 秒后，你会更清醒。",
  "观察这个感觉，不要评判自己。",
];

export const URGE_CAPTURE_EVENT = "lifeos:urge-capture";

export function UrgeCapture() {
  const [step, setStep] = useState<Step>("closed");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(90);
  const [intensity, setIntensity] = useState(3);
  const [trigger, setTrigger] = useState<string>("");
  const [outcome, setOutcome] = useState<UrgeOutcome>("surfed");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [breathIdx, setBreathIdx] = useState(0);

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/urges/categories");
    if (!res.ok) return;
    const data = await res.json();
    setCategories(data.categories ?? []);
  }, []);

  useEffect(() => {
    const onOpen = () => setStep((s) => (s === "closed" ? "pick" : s));
    window.addEventListener(URGE_CAPTURE_EVENT, onOpen);
    return () => window.removeEventListener(URGE_CAPTURE_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (step !== "closed") void loadCategories();
  }, [step, loadCategories]);

  useEffect(() => {
    if (step !== "surf" || countdown <= 0) return;
    const t = window.setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [step, countdown]);

  useEffect(() => {
    if (step !== "surf") return;
    const t = window.setInterval(
      () => setBreathIdx((i) => (i + 1) % BREATH_TEXTS.length),
      4000
    );
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    if (step === "surf" && countdown <= 0) setStep("log");
  }, [step, countdown]);

  const reset = () => {
    setStep("closed");
    setSelectedId(null);
    setCountdown(90);
    setIntensity(3);
    setTrigger("");
    setOutcome("surfed");
    setNote("");
  };

  const save = async () => {
    if (!selectedId) return;
    setSaving(true);
    await fetch("/api/urges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: selectedId, intensity, trigger, outcome, note }),
    });
    invalidateFetchCache("/api/urges");
    invalidateFetchCache("/api/insights");
    window.dispatchEvent(new CustomEvent(URGES_UPDATED_EVENT));
    setSaving(false);
    reset();
  };

  if (step === "closed") return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={reset} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl border border-zinc-200 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
            <Waves className="h-4 w-4 text-orange-500" />
            {step === "pick" && "哪种冲动？"}
            {step === "surf" && "冲动冲浪"}
            {step === "log" && "记录结果"}
          </h3>
          <button type="button" onClick={reset} className="p-1 rounded hover:bg-zinc-100">
            <X className="h-4 w-4 text-zinc-500" />
          </button>
        </div>

        {step === "pick" && (
          <>
            <div className="space-y-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(c.id);
                    setCountdown(90);
                    setStep("surf");
                  }}
                  className="w-full flex items-center gap-3 rounded-xl border border-zinc-100 px-4 py-3 hover:border-orange-200 hover:bg-orange-50/50 text-left"
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="text-sm font-medium text-zinc-800">{c.name}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-400 text-center">选分类后进入 90 秒缓冲</p>
          </>
        )}

        {step === "surf" && (
          <div className="text-center py-6 space-y-4">
            <p className="text-5xl font-bold text-orange-500 tabular-nums">{countdown}</p>
            <p className="text-sm text-zinc-600 leading-relaxed px-4">{BREATH_TEXTS[breathIdx]}</p>
            <p className="text-xs text-zinc-400">缓慢吸气 4 秒 · 屏息 4 秒 · 呼气 6 秒</p>
            <Button variant="secondary" size="sm" onClick={() => setStep("log")}>
              跳过，直接记录
            </Button>
          </div>
        )}

        {step === "log" && (
          <>
            <Field>
              <Label className="text-xs">强度 (1-5)</Label>
              <div className="flex gap-1.5 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setIntensity(n)}
                    className={`h-8 flex-1 rounded-lg text-sm font-medium ${
                      intensity === n ? "bg-orange-500 text-white" : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Field>
            <Field>
              <Label className="text-xs">触发因素</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {URGE_TRIGGERS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTrigger(t)}
                    className={`px-2.5 py-1 rounded-lg text-xs ${
                      trigger === t ? "bg-orange-100 text-orange-700" : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field>
              <Label className="text-xs">结果</Label>
              <div className="space-y-1.5 mt-1">
                {URGE_OUTCOMES.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setOutcome(o.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                      outcome === o.value
                        ? "bg-orange-50 border border-orange-200 text-orange-800"
                        : "bg-zinc-50 text-zinc-700"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field>
              <Label className="text-xs">备注（可选）</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[50px] text-sm"
                placeholder="当时在想什么…"
              />
            </Field>
            <Button onClick={() => void save()} disabled={saving} className="w-full">
              {saving ? "保存中…" : "保存记录"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
