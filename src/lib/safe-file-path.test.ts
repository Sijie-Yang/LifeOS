import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { resolveContainedFile } from "./safe-file-path";

test("library paths reject traversal, absolute paths and symlink escapes", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "lifeos-path-test-"));
  try {
    const root = path.join(base, "library");
    fs.mkdirSync(root);
    fs.writeFileSync(path.join(base, "private.txt"), "fixture");
    fs.symlinkSync(base, path.join(root, "outside"));
    fs.symlinkSync(path.join(base, "private.txt"), path.join(root, "private.txt"));
    fs.mkdirSync(path.join(root, "books"));
    fs.symlinkSync(path.join(root, "books"), path.join(root, "inside"));
    for (const file of ["../private.txt", "/etc/passwd", "outside/private.txt", "outside/missing.txt", "private.txt", "."]) {
      assert.throws(() => resolveContainedFile(root, file));
    }
    assert.equal(resolveContainedFile(root, "books/missing.pdf"), path.join(fs.realpathSync(root), "books/missing.pdf"));
    assert.equal(resolveContainedFile(root, "inside/book.pdf"), path.join(fs.realpathSync(root), "inside/book.pdf"));
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
