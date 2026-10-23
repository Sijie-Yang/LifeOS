export function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export function stringifyTags(tags: string[]): string {
  return JSON.stringify(tags.filter(Boolean));
}

export function tagsFromInput(input: string): string[] {
  return input
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function tagsToInput(tags: string[]): string {
  return tags.join(", ");
}
