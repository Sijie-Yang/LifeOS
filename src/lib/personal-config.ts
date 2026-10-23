/**
 * Small personal knobs with neutral defaults.
 *
 * To use your own values, copy this file to `private/src/lib/personal-config.ts`
 * (git-ignored) and edit it there: every `@/lib/...` import resolves to `private/src/`
 * first, so the app picks up your copy without changing tracked code.
 * See docs/private-overlay.md.
 */

/**
 * Morning habits checked off side by side at the start of the day, in this order.
 * Matched by name prefix, so "Coffee · black, before noon" counts as "Coffee".
 */
export const MORNING_HABIT_NAMES: readonly string[] = ["早上洗漱", "早餐", "日计划"];

/** Power map keyword heuristics for contacts and opportunities. */
export const POWER_HINTS = {
  /** Your main track: tags / opportunity titles marked as the core direction. */
  coreTrack: /主航道|核心方向|north\s*star|core\s*track|dream\s*(job|role)/i,
  /** Fallback options. */
  backup: /备选|backup|plan\s*b|保底|兜底/i,
  /** Media channels. */
  media: /媒体|采访|播客|podcast|press|interview/i,
  /** Gatekeeper roles: recruiters, media, gate owners. */
  gate: /招聘|媒体|media|recruit|gate/,
};
