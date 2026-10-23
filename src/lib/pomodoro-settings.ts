export type PomodoroSettings = {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
};

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
};

export const MICRO_WORK_MINUTES = 15;

export const BREAK_SUGGESTIONS = [
  "站起来走动 2 分钟",
  "喝一大杯水",
  "望向窗外 20 秒，让眼睛休息",
  "做 5 个深呼吸",
  "伸展肩颈，不要碰手机",
];

const STORAGE_KEY = "lifeos-pomodoro-settings";

export function loadPomodoroSettings(): PomodoroSettings {
  if (typeof window === "undefined") return DEFAULT_POMODORO_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_POMODORO_SETTINGS;
    return { ...DEFAULT_POMODORO_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_POMODORO_SETTINGS;
  }
}

export function savePomodoroSettings(settings: PomodoroSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export type PomodoroTimerState = {
  sessionId: string;
  habitId: string;
  habitName: string;
  habitColor: string;
  phase: "work" | "short_break" | "long_break";
  endsAt: number;
  pausedAt: number | null;
  remainingMs: number;
  completedWorkCount: number;
  date: string;
  distractions: number;
};

const TIMER_KEY = "lifeos-pomodoro-timer";

export function loadTimerState(): PomodoroTimerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as PomodoroTimerState;
    if (state.pausedAt) return state;
    if (state.endsAt <= Date.now() && state.phase !== "work") return null;
    return state;
  } catch {
    return null;
  }
}

export function saveTimerState(state: PomodoroTimerState | null) {
  if (state) localStorage.setItem(TIMER_KEY, JSON.stringify(state));
  else localStorage.removeItem(TIMER_KEY);
}

/** The session id arrives after the timer is first saved; attach it so a reload can still settle the session. */
export function saveTimerSessionId(sessionId: string) {
  const state = loadTimerState();
  if (state && !state.sessionId) saveTimerState({ ...state, sessionId });
}
