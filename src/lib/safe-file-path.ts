import fs from "node:fs";
import path from "node:path";

/** Restrict reads to an existing directory, including through symbolic links. */
export function resolveContainedFile(rootPath: string, relativePath: string): string {
  const root = fs.realpathSync(rootPath);
  if (path.isAbsolute(relativePath) || relativePath.includes("\0")) throw new Error("Invalid relative path");
  const candidate = path.resolve(root, relativePath);
  const inside = (file: string) => file.startsWith(root + path.sep);
  if (!inside(candidate)) throw new Error("Path escapes library root");
  // Resolve the nearest existing ancestor too, so missing files under an external symlink cannot escape.
  let ancestor = candidate;
  while (!fs.existsSync(ancestor)) {
    if (fs.lstatSync(ancestor, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error("Broken symbolic link");
    ancestor = path.dirname(ancestor);
  }
  const realAncestor = fs.realpathSync(ancestor);
  if (realAncestor !== root && !inside(realAncestor)) throw new Error("Symbolic link escapes library root");
  return candidate;
}
