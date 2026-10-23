import fs from "fs";
import path from "path";
import { resolveContainedFile } from "./safe-file-path";

/** Optional local library directory; file contents are not included in JSON backups. */
export const READING_LIBRARY_ROOT =
  process.env.READING_LIBRARY_ROOT ||
  path.join(process.cwd(), "data", "library");

export {
  LIBRARY_KINDS,
  LIBRARY_STATUSES,
  LIBRARY_KIND_LABEL,
  LIBRARY_STATUS_LABEL,
} from "@/lib/library-meta";

const DOC_EXT = new Set([".pdf", ".epub", ".djvu", ".html", ".htm", ".md", ".txt", ".docx"]);

export function ensureLibraryRoot(): string {
  const root = path.resolve(READING_LIBRARY_ROOT);
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  return root;
}

/** Resolve relative path under library root; throws if escapes root. */
export function resolveLibraryFile(relativePath: string): string {
  return resolveContainedFile(ensureLibraryRoot(), relativePath);
}

export function toRelativeLibraryPath(absolutePath: string): string {
  const root = ensureLibraryRoot();
  const rel = path.relative(root, path.resolve(absolutePath));
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("File is outside library root");
  }
  return rel.split(path.sep).join("/");
}

export type ScannedLibraryFile = {
  relativePath: string;
  name: string;
  ext: string;
  size: number;
  mtimeMs: number;
};

export function scanLibraryFiles(max = 500): ScannedLibraryFile[] {
  const root = ensureLibraryRoot();
  const out: ScannedLibraryFile[] = [];

  const walk = (dir: string) => {
    if (out.length >= max) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (out.length >= max) break;
      if (ent.name.startsWith(".")) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
        continue;
      }
      if (!ent.isFile()) continue;
      const ext = path.extname(ent.name).toLowerCase();
      if (!DOC_EXT.has(ext)) continue;
      const stat = fs.statSync(full);
      out.push({
        relativePath: toRelativeLibraryPath(full),
        name: ent.name,
        ext,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
      });
    }
  };

  walk(root);
  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out;
}

export function guessTitleFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function stringifyTags(tags: string[]): string {
  return JSON.stringify(tags.filter(Boolean));
}
