/**
 * 站内指向单个项目 / 机会的链接（/projects?id=… /opportunities?id=… /social?id=…）。
 * 全局点击拦截用它判断要不要改成原地弹窗。
 */
export type EntityLinkTarget = { kind: "project" | "opportunity"; id: string; page: string };

const PAGES: Record<string, EntityLinkTarget["kind"]> = {
  "/projects": "project",
  "/opportunities": "opportunity",
  "/social": "opportunity",
};

export function parseEntityHref(href: string | null | undefined): EntityLinkTarget | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, "https://lifeos.local");
  } catch {
    return null;
  }
  if (url.origin !== "https://lifeos.local" && !href.startsWith("/")) return null;
  const kind = PAGES[url.pathname];
  const id = url.searchParams.get("id");
  if (!kind || !id) return null;
  return { kind, id, page: url.pathname };
}
