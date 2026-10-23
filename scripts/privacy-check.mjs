#!/usr/bin/env node
// Pre-push gate: exports the committed tree (HEAD by default), runs privacy-scan on it and,
// when a local database exists, checks that no real contact name/email or habit/project/
// opportunity title from it appears in the export. Exits 1 on any hit.
// Usage: node scripts/privacy-check.mjs [ref]   (PRIVACY_DB=/path/to/dev.db to use another database)
// Generic titles that legitimately appear in code can be listed one per line in
// .privacy-allowlist (git-ignored).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ref = process.argv[2] ?? 'HEAD';
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-privacy-'));

try {
  execFileSync('sh', ['-c', `git archive "${ref}" | tar -x -C "${tmp}"`], { cwd: root, stdio: 'inherit' });

  let failed = false;
  try {
    execFileSync('node', [path.join(root, 'scripts/privacy-scan.mjs'), tmp], { cwd: root, stdio: 'inherit' });
  } catch {
    failed = true;
  }

  const db = process.env.PRIVACY_DB || path.join(root, 'prisma', 'dev.db');
  const allowFile = path.join(root, '.privacy-allowlist');
  const allow = new Set(
    fs.existsSync(allowFile)
      ? fs.readFileSync(allowFile, 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'))
      : []
  );
  if (fs.existsSync(db)) {
    const query = (sql) => {
      try {
        return execFileSync('sqlite3', ['-readonly', db, sql], { encoding: 'utf8' }).split('\n').map((s) => s.trim());
      } catch {
        return [];
      }
    };
    const terms = new Set([
      ...query("SELECT name FROM Contact WHERE length(name) >= 2"),
      ...query("SELECT email FROM Contact WHERE email LIKE '%@%'"),
      ...query('SELECT name FROM Project WHERE length(name) >= 4'),
      ...query('SELECT name FROM Habit WHERE length(name) >= 5'),
      ...query('SELECT title FROM Opportunity WHERE length(title) >= 5'),
    ].filter((t) => t && !allow.has(t)));

    const hits = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(abs);
        else if (entry.name !== 'package-lock.json' && fs.statSync(abs).size < 2_000_000) {
          const text = fs.readFileSync(abs, 'utf8');
          if (text.includes('\0')) continue;
          for (const t of terms) if (text.includes(t)) hits.push(`${path.relative(tmp, abs)}: "${t}"`);
        }
      }
    };
    walk(tmp);
    if (hits.length) {
      failed = true;
      console.error(`Database cross-check found ${hits.length} real name(s)/title(s) in ${ref}:`);
      for (const h of hits) console.error(`  ${h}`);
      console.error('Move them into private/ or, if they are generic, add them to .privacy-allowlist.');
    } else {
      console.log(`Database cross-check passed (${terms.size} names, emails and titles).`);
    }
  } else {
    console.log('No prisma/dev.db here; skipped the database cross-check.');
  }

  if (failed) {
    console.error('Privacy check failed: not pushing.');
    process.exitCode = 1;
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
