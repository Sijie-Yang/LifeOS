import { parseTags, stringifyTags } from "@/lib/tags";

export const CRUSH_TAG = "心动";

export function hasCrushTag(tags: string[] | string | null | undefined): boolean {
  const list = Array.isArray(tags) ? tags : parseTags(tags || "[]");
  return list.some((t) => t.trim() === CRUSH_TAG);
}

export function setCrushTag(tags: string[], on: boolean): string[] {
  const without = tags.filter((t) => t.trim() !== CRUSH_TAG);
  return on ? [...without, CRUSH_TAG] : without;
}

export function applyCrushToTagJson(
  existingJson: string,
  incomingTags: string[] | undefined,
  crush: boolean | undefined
): string {
  const base = incomingTags ?? parseTags(existingJson || "[]");
  if (crush === undefined) return stringifyTags(base);
  return stringifyTags(setCrushTag(base, crush));
}
