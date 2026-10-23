import fs from "fs";
import path from "path";
import { resolveContainedFile } from "./safe-file-path";
import type { RecordDomain } from "@/lib/life-records-meta";

export {
  RECORD_DOMAINS,
  RECORD_DOMAIN_META,
  isRecordDomain,
  parseRecordMeta,
  toRecordDto,
  type RecordDomain,
  type LifeRecordDto,
} from "@/lib/life-records-meta";

export const LIFE_RECORDS_ROOT =
  process.env.LIFE_RECORDS_ROOT || path.join(process.cwd(), "data", "life-records");

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
]);

export function ensureRecordsRoot(): string {
  const root = path.resolve(LIFE_RECORDS_ROOT);
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

export function resolveRecordPhoto(relativePath: string): string {
  return resolveContainedFile(ensureRecordsRoot(), relativePath);
}

export function extForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("png")) return ".png";
  if (m.includes("webp")) return ".webp";
  if (m.includes("gif")) return ".gif";
  if (m.includes("heic") || m.includes("heif")) return ".heic";
  return ".jpg";
}

export function isImageMime(mime: string): boolean {
  return IMAGE_MIME.has(mime.toLowerCase());
}

/** Save uploaded photo under YYYY/MM/domain/id.ext */
export async function saveRecordPhoto(opts: {
  id: string;
  date: string;
  domain: RecordDomain;
  file: File;
}): Promise<{ photoPath: string; photoMime: string }> {
  const mime = opts.file.type || "image/jpeg";
  if (!isImageMime(mime)) {
    throw new Error("只支持图片（jpg/png/webp/heic/gif）");
  }
  const maxBytes = 12 * 1024 * 1024;
  if (opts.file.size > maxBytes) {
    throw new Error("图片请小于 12MB");
  }

  const [y, m] = opts.date.split("-");
  const relDir = `${y}/${m}/${opts.domain}`;
  const absDir = path.join(ensureRecordsRoot(), relDir);
  fs.mkdirSync(absDir, { recursive: true });

  const ext = extForMime(mime);
  const relPath = `${relDir}/${opts.id}${ext}`;
  const absPath = resolveRecordPhoto(relPath);
  const buf = Buffer.from(await opts.file.arrayBuffer());
  fs.writeFileSync(absPath, buf);
  return { photoPath: relPath, photoMime: mime };
}

export function deleteRecordPhotoFile(photoPath: string | null | undefined) {
  if (!photoPath) return;
  try {
    const abs = resolveRecordPhoto(photoPath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    // ignore
  }
}
