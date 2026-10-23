export type SortDirection = "asc" | "desc";

export function toggleSortDirection(
  currentKey: string,
  nextKey: string,
  currentDir: SortDirection
): SortDirection {
  if (currentKey === nextKey) {
    return currentDir === "asc" ? "desc" : "asc";
  }
  return "asc";
}

export function compareStrings(a: string, b: string, dir: SortDirection): number {
  const result = a.localeCompare(b, "zh-CN");
  return dir === "asc" ? result : -result;
}

export function compareNumbers(a: number, b: number, dir: SortDirection): number {
  const result = a - b;
  return dir === "asc" ? result : -result;
}

export function compareByOrder(
  valueA: string,
  valueB: string,
  order: string[],
  dir: SortDirection
): number {
  const indexA = order.indexOf(valueA);
  const indexB = order.indexOf(valueB);
  const rankA = indexA === -1 ? order.length : indexA;
  const rankB = indexB === -1 ? order.length : indexB;
  return compareNumbers(rankA, rankB, dir);
}

export function compareDates(
  a: string | null | undefined,
  b: string | null | undefined,
  dir: SortDirection
): number {
  const timeA = a ? new Date(a).getTime() : null;
  const timeB = b ? new Date(b).getTime() : null;
  if (timeA === null && timeB === null) return 0;
  if (timeA === null) return 1;
  if (timeB === null) return -1;
  return compareNumbers(timeA, timeB, dir);
}
