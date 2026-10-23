export type ProjectNote = {
  id: string;
  title: string;
  content: string | null;
  type: string;
  pinned: boolean;
  sortOrder: number;
  updatedAt: string;
};

export function sortProjectNotes(list: ProjectNote[]) {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

/** 将旧版项目 description 迁移为「项目概览」笔记 */
export async function migrateDescriptionToNote(
  projectId: string,
  description: string | null
): Promise<ProjectNote | null> {
  if (!description?.trim()) return null;
  const res = await fetch(`/api/projects/${projectId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "项目概览",
      content: description,
      type: "overview",
      pinned: true,
    }),
  });
  if (!res.ok) return null;
  await fetch(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: null }),
  });
  return res.json();
}

export function pickDefaultNoteId(notes: ProjectNote[]): string | null {
  const sorted = sortProjectNotes(notes);
  return sorted[0]?.id ?? null;
}
