#!/usr/bin/env tsx
import { importObsidianVault, DEFAULT_OBSIDIAN_VAULT } from "../src/lib/obsidian-import";

async function main() {
  const vault = process.argv[2] || DEFAULT_OBSIDIAN_VAULT;
  console.log(`Importing Obsidian vault:\n  ${vault}\n`);

  const stats = await importObsidianVault(vault);

  console.log("Import complete:");
  console.log(`  People:     ${stats.people}`);
  console.log(`  Projects:   ${stats.projects}`);
  console.log(`  Meetings:   ${stats.meetings}`);
  console.log(`  Posts:      ${stats.posts}`);
  console.log(`  Daily logs: ${stats.dailyLogs}`);
  console.log(`  Habits:     ${stats.habits} (new)`);
  console.log(`  Check-ins:  ${stats.checkIns}`);
  console.log(`  Reviews:    ${stats.reviews}`);
  console.log(`  SOPs:       ${stats.sops}`);
  console.log(`  Tasks:      ${stats.tasks}`);
  console.log(`  Skipped:    ${stats.skipped} (already imported)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
