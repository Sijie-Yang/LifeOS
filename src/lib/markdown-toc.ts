export type MdHeading = {
  level: number;
  text: string;
  id: string;
};

export type MdHeadingNode = MdHeading & {
  children: MdHeadingNode[];
};

/** Nest flat headings into a tree by level (h2 under nearest preceding h1, etc.). */
export function buildHeadingTree(headings: MdHeading[]): MdHeadingNode[] {
  const roots: MdHeadingNode[] = [];
  const stack: MdHeadingNode[] = [];

  for (const h of headings) {
    const node: MdHeadingNode = { ...h, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  return roots;
}

/** Ancestor ids from root → parent of `id` (not including self). */
export function headingAncestorIds(tree: MdHeadingNode[], id: string): string[] {
  const path: string[] = [];

  const walk = (nodes: MdHeadingNode[], trail: string[]): boolean => {
    for (const n of nodes) {
      if (n.id === id) {
        path.push(...trail);
        return true;
      }
      if (n.children.length && walk(n.children, [...trail, n.id])) return true;
    }
    return false;
  };

  walk(tree, []);
  return path;
}

export function collectExpandableIds(tree: MdHeadingNode[]): string[] {
  const ids: string[] = [];
  const walk = (nodes: MdHeadingNode[]) => {
    for (const n of nodes) {
      if (n.children.length) {
        ids.push(n.id);
        walk(n.children);
      }
    }
  };
  walk(tree);
  return ids;
}

/** Stable id for in-page scroll targets */
export function slugifyHeading(text: string, index: number): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fff-]/g, "")
    .slice(0, 48);
  return `mdh-${index}-${base || "section"}`;
}

/** Extract #–#### headings (skips fenced code blocks). */
export function extractMarkdownHeadings(md: string, maxLevel = 4): MdHeading[] {
  if (!md.trim()) return [];
  const out: MdHeading[] = [];
  let inFence = false;

  for (const line of md.split("\n")) {
    if (/^(`{3,}|~{3,})/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const level = m[1].length;
    if (level > maxLevel) continue;
    const text = m[2].trim();
    if (!text) continue;
    out.push({ level, text, id: slugifyHeading(text, out.length) });
  }
  return out;
}

export function markdownChildrenToText(children: unknown): string {
  if (children == null || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(markdownChildrenToText).join("");
  if (typeof children === "object" && children !== null && "props" in children) {
    const props = (children as { props?: { children?: unknown } }).props;
    return markdownChildrenToText(props?.children);
  }
  return "";
}
