"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { toDateString } from "@/lib/utils";
import {
  DEFAULT_POMODORO_SETTINGS,
  loadPomodoroSettings,
  loadTimerState,
  saveTimerState,
  saveTimerSessionId,
  MICRO_WORK_MINUTES,
  type PomodoroSettings,
  type PomodoroTimerState,
} from "@/lib/pomodoro-settings";

export type PomodoroHabit = {
  id: string;
  name: string;
  color: string;
  startTime: string | null;
  endTime: string | null;
};

type Phase = "idle" | "work" | "short_break" | "long_break";

type PomodoroApiValue = {
  habits: PomodoroHabit[];
  scheduledIds: Set<string>;
  selectedHabitId: string | null;
  setSelectedHabitId: (id: string | null) => void;
  phase: Phase;
  completedWorkCount: number;
  isRunning: boolean;
  isPaused: boolean;
  expanded: boolean;
  setExpanded: Dispatch<SetStateAction<boolean>>;
  settings: PomodoroSettings;
  activeSessionId: string | null;
  distractions: number;
  fullscreen: boolean;
  setFullscreen: Dispatch<SetStateAction<boolean>>;
  incrementDistraction: () => void;
  pendingBreakQuality: boolean;
  submitBreakQuality: (rating: number | null) => Promise<void>;
  workMinutesUsed: number;
  startWork: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  skipBreak: () => void;
  stop: () => Promise<void>;
  refreshHabits: () => Promise<void>;
  openWithHabit: (habitId: string) => void;
};

type PomodoroContextValue = PomodoroApiValue & { remainingSec: number };

const PomodoroContext = createContext<PomodoroApiValue | null>(null);
const PomodoroTickContext = createContext(0);

function formatRemaining(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export { formatRemaining };

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState<PomodoroHabit[]>([]);
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(new Set());
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [remainingSec, setRemainingSec] = useState(0);
  const [completedWorkCount, setCompletedWorkCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [settings] = useState<PomodoroSettings>(() =>
    typeof window !== "undefined" ? loadPomodoroSettings() : DEFAULT_POMODORO_SETTINGS
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [distractions, setDistractions] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [pendingBreakQuality, setPendingBreakQuality] = useState(false);
  const [workMinutesUsed, setWorkMinutesUsed] = useState(settings.workMinutes);

  const endsAtRef = useRef<number>(0);
  const pausedRemainingRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const sessionIdRef = useRef<string | null>(null);
  const habitRef = useRef<PomodoroHabit | null>(null);
  const workCountRef = useRef(0);
  const distractionsRef = useRef(0);
  const completedSessionForBreakRef = useRef<string | null>(null);
  const workMinutesRef = useRef(settings.workMinutes);
  const preEnergyRef = useRef<number | null>(null);

  const clearTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const persistTimer = useCallback(
    (nextPhase: Phase, endsAt: number, paused: boolean, remainingMs: number) => {
      const habit = habitRef.current;
      if (!habit || nextPhase === "idle") {
        saveTimerState(null);
        return;
      }
      saveTimerState({
        sessionId: sessionIdRef.current || "",
        habitId: habit.id,
        habitName: habit.name,
        habitColor: habit.color,
        phase: nextPhase === "work" ? "work" : nextPhase === "long_break" ? "long_break" : "short_break",
        endsAt,
        pausedAt: paused ? Date.now() : null,
        remainingMs,
        completedWorkCount: workCountRef.current,
        date: toDateString(),
        distractions: distractionsRef.current,
      });
    },
    []
  );

  const completeWorkSession = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (sessionId) {
      await fetch(`/api/pomodoro/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          distractions: distractionsRef.current,
        }),
      });
      completedSessionForBreakRef.current = sessionId;
      sessionIdRef.current = null;
      setActiveSessionId(null);
    }
    workCountRef.current += 1;
    setCompletedWorkCount(workCountRef.current);
    window.dispatchEvent(new CustomEvent("lifeos:pomodoro-updated"));
  }, []);

  const cancelWorkSession = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (sessionId) {
      await fetch(`/api/pomodoro/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      sessionIdRef.current = null;
      setActiveSessionId(null);
    }
  }, []);

  const startPhase = useCallback(
    (nextPhase: Phase, durationMin: number, createSession: boolean) => {
      clearTick();
      phaseRef.current = nextPhase;
      setPhase(nextPhase);
      const durationMs = durationMin * 60 * 1000;
      endsAtRef.current = Date.now() + durationMs;
      pausedRemainingRef.current = durationMs;
      setRemainingSec(durationMin * 60);
      setIsRunning(true);
      setIsPaused(false);
      persistTimer(nextPhase, endsAtRef.current, false, durationMs);

      if (createSession && nextPhase === "work" && habitRef.current) {
        void (async () => {
          const res = await fetch("/api/pomodoro", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              habitId: habitRef.current!.id,
              plannedMinutes: workMinutesRef.current,
              preEnergy: preEnergyRef.current,
            }),
          });
          if (res.ok) {
            const session = await res.json();
            sessionIdRef.current = session.id;
            setActiveSessionId(session.id);
            saveTimerSessionId(session.id);
          }
        })();
      }

      tickRef.current = setInterval(() => {
        if (phaseRef.current === "idle") return;
        const left = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
        setRemainingSec(left);
        pausedRemainingRef.current = left * 1000;
        if (left <= 0) {
          clearTick();
          setIsRunning(false);
          void handlePhaseEnd();
        }
      }, 250);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persistTimer, settings.workMinutes]
  );

  const handlePhaseEnd = useCallback(async () => {
    const current = phaseRef.current;
    if (current === "work") {
      await completeWorkSession();
      const nextBreak =
        workCountRef.current > 0 && workCountRef.current % settings.longBreakInterval === 0
          ? "long_break"
          : "short_break";
      const breakMin =
        nextBreak === "long_break" ? settings.longBreakMinutes : settings.shortBreakMinutes;
      startPhase(nextBreak, breakMin, false);
      return;
    }
    if (current === "short_break" || current === "long_break") {
      phaseRef.current = "idle";
      setPhase("idle");
      saveTimerState(null);
      setIsRunning(false);
      if (completedSessionForBreakRef.current) {
        setPendingBreakQuality(true);
      } else {
        setExpanded(true);
      }
    }
  }, [completeWorkSession, settings, startPhase]);

  const habitsCacheRef = useRef<{ at: number; habits: PomodoroHabit[]; scheduled: string[] } | null>(
    null
  );

  const refreshHabits = useCallback(async (force = false) => {
    const cached = habitsCacheRef.current;
    if (!force && cached && Date.now() - cached.at < 60_000) {
      setHabits(cached.habits);
      setScheduledIds(new Set(cached.scheduled));
      return;
    }
    try {
      const res = await fetch("/api/pomodoro/habits");
      if (!res.ok) return;
      const data = await res.json();
      habitsCacheRef.current = {
        at: Date.now(),
        habits: data.habits,
        scheduled: data.scheduled.map((h: PomodoroHabit) => h.id),
      };
      setHabits(data.habits);
      setScheduledIds(new Set(habitsCacheRef.current.scheduled));
    } catch {
      // Ignore transient network failures during dev recompiles
    }
  }, []);

  useEffect(() => {
    void refreshHabits();
  }, [refreshHabits]);

  useEffect(() => {
    const saved = loadTimerState();
    if (!saved) return;

    const habit: PomodoroHabit = {
      id: saved.habitId,
      name: saved.habitName,
      color: saved.habitColor,
      startTime: null,
      endTime: null,
    };
    habitRef.current = habit;
    setSelectedHabitId(saved.habitId);
    workCountRef.current = saved.completedWorkCount;
    setCompletedWorkCount(saved.completedWorkCount);
    distractionsRef.current = saved.distractions ?? 0;
    setDistractions(saved.distractions ?? 0);
    sessionIdRef.current = saved.sessionId || null;
    setActiveSessionId(saved.sessionId || null);

    const phaseMap: Record<string, Phase> = {
      work: "work",
      short_break: "short_break",
      long_break: "long_break",
    };
    const restoredPhase = phaseMap[saved.phase] || "idle";
    phaseRef.current = restoredPhase;
    setPhase(restoredPhase);

    if (saved.pausedAt) {
      const remainingMs = saved.remainingMs;
      pausedRemainingRef.current = remainingMs;
      setRemainingSec(Math.ceil(remainingMs / 1000));
      setIsPaused(true);
      setIsRunning(false);
      return;
    }

    const leftMs = saved.endsAt - Date.now();
    if (leftMs <= 0) {
      void (async () => {
        if (restoredPhase === "work") {
          await completeWorkSession();
        }
        phaseRef.current = "idle";
        setPhase("idle");
        saveTimerState(null);
      })();
      return;
    }

    endsAtRef.current = saved.endsAt;
    setRemainingSec(Math.ceil(leftMs / 1000));
    setIsRunning(true);
    clearTick();
    tickRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) {
        clearTick();
        setIsRunning(false);
        void handlePhaseEnd();
      }
    }, 250);

    return () => clearTick();
  }, [completeWorkSession, handlePhaseEnd]);

  const startWork = useCallback(async () => {
    if (!selectedHabitId) return;
    const habit = habits.find((h) => h.id === selectedHabitId);
    if (!habit) return;
    habitRef.current = habit;
    distractionsRef.current = 0;
    setDistractions(0);

    let energy: number | null = null;
    try {
      const res = await fetch(`/api/daily-log?date=${toDateString()}`);
      if (res.ok) {
        const data = await res.json();
        energy = data.log?.energy ?? null;
      }
    } catch {
      // ignore
    }
    preEnergyRef.current = energy;
    const minutes = energy != null && energy <= 2 ? MICRO_WORK_MINUTES : settings.workMinutes;
    workMinutesRef.current = minutes;
    setWorkMinutesUsed(minutes);
    startPhase("work", minutes, true);
    setExpanded(true);
  }, [selectedHabitId, habits, settings.workMinutes, startPhase]);

  const incrementDistraction = useCallback(() => {
    distractionsRef.current += 1;
    setDistractions(distractionsRef.current);
    persistTimer(phaseRef.current, endsAtRef.current, isPaused, pausedRemainingRef.current);
  }, [isPaused, persistTimer]);

  const submitBreakQuality = useCallback(async (rating: number | null) => {
    const sessionId = completedSessionForBreakRef.current;
    if (sessionId && rating != null) {
      await fetch(`/api/pomodoro/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ breakQuality: rating }),
      });
    }
    completedSessionForBreakRef.current = null;
    setPendingBreakQuality(false);
    setExpanded(true);
  }, []);

  const pause = useCallback(() => {
    if (!isRunning || isPaused) return;
    clearTick();
    const remainingMs = Math.max(0, endsAtRef.current - Date.now());
    pausedRemainingRef.current = remainingMs;
    setRemainingSec(Math.ceil(remainingMs / 1000));
    setIsRunning(false);
    setIsPaused(true);
    persistTimer(phaseRef.current, endsAtRef.current, true, remainingMs);
  }, [isRunning, isPaused, persistTimer]);

  const resume = useCallback(() => {
    if (!isPaused) return;
    endsAtRef.current = Date.now() + pausedRemainingRef.current;
    setIsPaused(false);
    setIsRunning(true);
    persistTimer(phaseRef.current, endsAtRef.current, false, pausedRemainingRef.current);
    clearTick();
    tickRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) {
        clearTick();
        setIsRunning(false);
        void handlePhaseEnd();
      }
    }, 250);
  }, [isPaused, persistTimer, handlePhaseEnd]);

  const skipBreak = useCallback(() => {
    if (phaseRef.current !== "short_break" && phaseRef.current !== "long_break") return;
    clearTick();
    phaseRef.current = "idle";
    setPhase("idle");
    setIsRunning(false);
    setIsPaused(false);
    saveTimerState(null);
    if (completedSessionForBreakRef.current) {
      setPendingBreakQuality(true);
    }
  }, []);

  const stop = useCallback(async () => {
    clearTick();
    if (phaseRef.current === "work") {
      await cancelWorkSession();
    }
    phaseRef.current = "idle";
    setPhase("idle");
    setIsRunning(false);
    setIsPaused(false);
    setRemainingSec(0);
    saveTimerState(null);
    window.dispatchEvent(new CustomEvent("lifeos:pomodoro-updated"));
  }, [cancelWorkSession]);

  const openWithHabit = useCallback((habitId: string) => {
    setSelectedHabitId(habitId);
    const habit = habits.find((h) => h.id === habitId);
    if (habit) habitRef.current = habit;
    setExpanded(true);
  }, [habits]);

  useEffect(() => {
    const onStart = (e: Event) => {
      const habitId = (e as CustomEvent<{ habitId: string }>).detail?.habitId;
      if (habitId) openWithHabit(habitId);
    };
    window.addEventListener("lifeos:start-pomodoro", onStart);
    return () => window.removeEventListener("lifeos:start-pomodoro", onStart);
  }, [openWithHabit]);

  useEffect(() => () => clearTick(), []);

  const api = useMemo<PomodoroApiValue>(
    () => ({
      habits,
      scheduledIds,
      selectedHabitId,
      setSelectedHabitId,
      phase,
      completedWorkCount,
      isRunning,
      isPaused,
      expanded,
      setExpanded,
      settings,
      activeSessionId,
      distractions,
      fullscreen,
      setFullscreen,
      incrementDistraction,
      pendingBreakQuality,
      submitBreakQuality,
      workMinutesUsed,
      startWork,
      pause,
      resume,
      skipBreak,
      stop,
      refreshHabits,
      openWithHabit,
    }),
    [
      habits,
      scheduledIds,
      selectedHabitId,
      phase,
      completedWorkCount,
      isRunning,
      isPaused,
      expanded,
      settings,
      activeSessionId,
      distractions,
      fullscreen,
      incrementDistraction,
      pendingBreakQuality,
      submitBreakQuality,
      workMinutesUsed,
      startWork,
      pause,
      resume,
      skipBreak,
      stop,
      refreshHabits,
      openWithHabit,
    ]
  );

  return (
    <PomodoroContext.Provider value={api}>
      <PomodoroTickContext.Provider value={remainingSec}>{children}</PomodoroTickContext.Provider>
    </PomodoroContext.Provider>
  );
}

export function usePomodoro(): PomodoroContextValue {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error("usePomodoro must be used within PomodoroProvider");
  const remainingSec = useContext(PomodoroTickContext);
  return { ...ctx, remainingSec };
}
