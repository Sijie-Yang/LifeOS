import fs from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';

// Temporary debt ratchet. Existing findings remain visible; new findings fail CI.
// Do not raise this baseline to make a pull request pass.
const eslint = new ESLint();
const results = await eslint.lintFiles(['.']);
const counts = {};
for (const result of results) {
  for (const message of result.messages) {
    const key = `${path.relative(process.cwd(), result.filePath).split(path.sep).join('/')}|${message.ruleId ?? 'parse-error'}|${message.severity}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
}
const baseline = JSON.parse(fs.readFileSync(new URL('../docs/lint-baseline.json', import.meta.url), 'utf8'));
const regressions = Object.entries(counts).filter(([key, count]) => count > (baseline[key] ?? 0));
const errors = results.reduce((n, r) => n + r.errorCount, 0);
const warnings = results.reduce((n, r) => n + r.warningCount, 0);
console.log(`Full lint currently reports ${errors} errors and ${warnings} warnings. See docs/lint-baseline.json; this is not a clean-lint result.`);
if (regressions.length) {
  for (const [key, count] of regressions) console.error(`New lint findings: ${key} (${count} > ${baseline[key] ?? 0})`);
  process.exitCode = 1;
} else {
  console.log('No additional findings against the documented baseline. Reduce baseline counts when fixing existing issues.');
}
