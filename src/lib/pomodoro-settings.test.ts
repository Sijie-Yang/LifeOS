import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { loadTimerState, saveTimerSessionId, saveTimerState, type PomodoroTimerState } from "./pomodoro-settings";

const store = new Map<string, string>();
Object.assign(globalThis, {
  window: globalThis,
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});

const timer: PomodoroTimerState = {
  sessionId: "",
  habitId: "h",
  habitName: "研究",
  habitColor: "#f00",
  phase: "work",
  endsAt: Date.now() + 60_000,
  pausedAt: null,
  remainingMs: 60_000,
  completedWorkCount: 0,
  date: "2026-10-23",
  distractions: 0,
};

describe("saveTimerSessionId", () => {
  beforeEach(() => store.clear());

  it("attaches the session id to a saved timer", () => {
    saveTimerState(timer);
    saveTimerSessionId("s1");
    assert.equal(loadTimerState()?.sessionId, "s1");
  });

  it("does not overwrite an existing id or create a timer", () => {
    saveTimerState({ ...timer, sessionId: "old" });
    saveTimerSessionId("new");
    assert.equal(loadTimerState()?.sessionId, "old");
    store.clear();
    saveTimerSessionId("s1");
    assert.equal(loadTimerState(), null);
  });
});
