#!/usr/bin/env node
// Fails when files that would be published contain databases, secrets or personal terms.
// Usage: node scripts/privacy-scan.mjs [dir]
//   With no dir, scans the files git tracks in this checkout.
//   Personal terms (names, places, project names) go one per line in .privacy-denylist,
//   which is git-ignored so the list itself is never published.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(process.argv[2] ?? '.');
const files = process.argv[2]
  ? walk(root)
  : execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);

function walk(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.next') continue;
    const rel = path.join(prefix, entry.name);
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

const forbiddenFiles = [
  [/(^|\/)\.env(\.|$)(?!example$)/, 'environment file'],
  [/\.(db|sqlite3?)($|[-.])/i, 'database file or copy'],
  [/(^|\/)(backups|data|artifacts)\//, 'local data directory'],
  [/\.(pem|key|p12)$/i, 'key material'],
  [/(^|\/)\.privacy-denylist$/, 'the personal denylist itself'],
  [/^private\//, 'private overlay (must stay git-ignored)'],
  [/(^|\/)CLAUDE\.local\.md$/, 'personal agent notes'],
  [/(^|\/)\.privacy-allowlist$/, 'the personal allowlist'],
];

const builtinContent = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}/, 'Resend API key'],
  [/\bsk-[A-Za-z0-9_-]{20,}/, 'API secret key'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/\/Users\/(?!me\/|alice\/|you\/|example\/)[A-Za-z0-9._-]+\//, 'local macOS home path'],
  [/\/home\/(?!me\/|alice\/|you\/|example\/|runner\/)[A-Za-z0-9._-]+\//, 'local Linux home path'],
  [/ntfy\.sh\/[A-Za-z0-9_-]{6,}/, 'ntfy topic'],
  [/[A-Za-z0-9._%+-]+@(?!example\.(com|org)|users\.noreply\.github\.com|anthropic\.com|resend\.dev)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, 'email address'],
];

const denylistFile = path.join(process.cwd(), '.privacy-denylist');
const personal = fs.existsSync(denylistFile)
  ? fs.readFileSync(denylistFile, 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'))
  : [];

// Emails and paths inside dependency lock files are package metadata, not personal data.
const skipContent = new Set(['package-lock.json']);
const findings = [];
for (const rel of files) {
  const posix = rel.split(path.sep).join('/');
  for (const [re, label] of forbiddenFiles) if (re.test(posix)) findings.push(`${posix}: ${label}`);
  if (skipContent.has(path.basename(posix))) continue;
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs) || fs.statSync(abs).size > 2_000_000) continue;
  const text = fs.readFileSync(abs, 'utf8');
  if (text.includes('\0')) continue;
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const [re, label] of builtinContent) if (re.test(line)) findings.push(`${posix}:${i + 1}: ${label}`);
    const lower = line.toLowerCase();
    for (const term of personal) if (lower.includes(term.toLowerCase())) findings.push(`${posix}:${i + 1}: denylisted term "${term}"`);
  });
}

if (!personal.length) console.warn('No .privacy-denylist found; only built-in patterns were checked.');
if (findings.length) {
  console.error(`Privacy scan found ${findings.length} issue(s):`);
  for (const f of findings) console.error(`  ${f}`);
  process.exitCode = 1;
} else {
  console.log(`Privacy scan passed (${files.length} files, ${personal.length} personal terms).`);
}
