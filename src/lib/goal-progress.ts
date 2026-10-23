export type ProjectForProgress = {
  id?: string;
  name?: string;
  progress: number;
  status: string;
  archiveDate?: Date | string | null;
};

/** 项目视为完成：状态已完成、已归档、或进度 100% */
export function isProjectDone(p: ProjectForProgress): boolean {
  return p.status === "COMPLETED" || p.progress >= 100 || !!p.archiveDate;
}

export function projectDoneLabel(p: ProjectForProgress): string {
  if (p.status === "COMPLETED") return "已完成";
  if (p.archiveDate) return "已归档";
  if (p.progress >= 100) return "100%";
  return `${p.progress}%`;
}

/** 目标进度 = 关联项目中已完成的比例 */
export function syncGoalProgress(projects: ProjectForProgress[]): number {
  if (projects.length === 0) return 0;
  const done = projects.filter(isProjectDone).length;
  return Math.round((done / projects.length) * 100);
}

/** KR 完成 = 所关联项目全部完成；无关联项目则未完成 */
export function deriveKeyResultCompleted(linkedProjects: ProjectForProgress[]): boolean {
  if (linkedProjects.length === 0) return false;
  return linkedProjects.every(isProjectDone);
}

export type KeyResultWithProjects = {
  id: string;
  title: string;
  completed: boolean;
  sortOrder: number;
  projects?: Array<{
    id: string;
    projectId: string;
    project: ProjectForProgress & { id: string; name: string };
  }>;
};

export function enrichKeyResult<T extends KeyResultWithProjects>(kr: T): T & { completed: boolean } {
  const linked = (kr.projects ?? []).map((lp) => lp.project);
  return {
    ...kr,
    completed: deriveKeyResultCompleted(linked),
  };
}

export function enrichKeyResults<T extends KeyResultWithProjects>(krs: T[]) {
  return krs.map(enrichKeyResult);
}
