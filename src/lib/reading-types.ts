export const READING_PROJECT_KEYS = ["deep-books", "info-reading", "science-info"] as const;
export type ReadingProjectKey = (typeof READING_PROJECT_KEYS)[number];

export const READING_PROJECT_MATCH: Record<
  ReadingProjectKey,
  { label: string; nameIncludes: string; shortLabel: string }
> = {
  "deep-books": {
    label: "深读书",
    shortLabel: "Book",
    nameIncludes: "深读书",
  },
  "info-reading": {
    label: "Info Reading",
    shortLabel: "Info",
    nameIncludes: "Info Reading",
  },
  "science-info": {
    label: "Science Info",
    shortLabel: "Science",
    nameIncludes: "Science Info",
  },
};

export type ReadingNoteDto = {
  id: string;
  title: string;
  content: string | null;
  type: string;
  readingTag: string | null;
  pinned: boolean;
  sortOrder: number;
  updatedAt: string;
  projectId: string;
  projectKey: ReadingProjectKey | "learning";
  projectName: string;
};

export type ReadingProjectDto = {
  key: ReadingProjectKey;
  id: string;
  name: string;
  progress: number;
  noteCount: number;
};

export type ReadingFocusKind = "book" | "domain" | "source";

/** Homepage-style focus queue: what you're actively learning, ranked. */
export type ReadingFocusItem = {
  id: string;
  kind: ReadingFocusKind;
  projectKey: ReadingProjectKey;
  /** Display name: book / domain / source */
  title: string;
  /** Next concrete step */
  subtitle: string;
  /** Lower = higher on the homepage list */
  rank: number;
  projectPriority: string;
  /** Iron-law current book / today's mapped step */
  isNow: boolean;
  stepId: string | null;
  noteId: string | null;
  readingTag: string | null;
  openSteps: number;
  mappedDate: string | null;
};

export type ReadingPayload = {
  projects: ReadingProjectDto[];
  notes: ReadingNoteDto[];
  focus: ReadingFocusItem[];
};
