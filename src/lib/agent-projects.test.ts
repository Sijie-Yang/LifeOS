import assert from "node:assert/strict";
import { test } from "node:test";
import { matchAgentProject, updateWorkspaceTags, codexWorkspaceFromHead } from "./agent-projects";
const project = (id: string, name: string, tags = "[]") => ({ id, name, tags, status: "ACTIVE" });
const projects = [project("notes", "Notes-Site"), project("world", "Notes-World"), project("home", "Home_Budget_Personal Planner"), project("qa", "QA")];
test("workspace matching normalizes spacing, case, fullwidth and common repo suffixes", () => {
  for (const name of ["notes_site", "Notes Site", "Ｎｏｔｅｓ－Ｓｉｔｅ", "Notes-Site-Platform", "notes-site-web"]) assert.equal(matchAgentProject(name, projects).projectId, "notes");
  assert.equal(matchAgentProject("QA", projects).projectId, "qa");
  assert.equal(matchAgentProject("developer-tools", projects).projectId, null);
});
test("exact names beat suffix matching and ambiguous names are never guessed", () => {
  assert.equal(matchAgentProject("Notes-Site-Platform", [...projects, project("platform", "Notes-Site-Platform")]).projectId, "platform");
  const result = matchAgentProject("Notes-Site", [...projects, project("other", "2026 Notes Site")]);
  assert.equal(result.projectId, null);
  assert.equal(result.method, "ambiguous");
  assert.equal(result.candidates.length, 2);
});
test("explicit workspace bindings override names and survive unrelated project tags", () => {
  const tags = updateWorkspaceTags('["research","workspace:Notes Site"]', "notes-site", false);
  assert.equal(tags, '["research"]');
  const mapped = [...projects, project("custom", "Different project", updateWorkspaceTags(tags, "Notes-Site", true))];
  assert.equal(matchAgentProject("notes site", mapped).projectId, "custom");
  assert.equal(matchAgentProject("alice-home", projects).projectId, null);
});
test("partial matches stay suggestions and stale bindings cannot match deleted projects", () => {
  const result = matchAgentProject("Notes-Site-experiments", projects);
  assert.equal(result.projectId, null);
  assert.deepEqual(result.candidates, [{id:"notes",name:"Notes-Site"}]);
  assert.equal(matchAgentProject("", projects).projectId, null);
});
test("workspace parsing supports escaped Windows paths, trailing slashes and malformed records", () => {
  const head = (cwd: string) => JSON.stringify({type:"session_meta",payload:{cwd}});
  assert.equal(codexWorkspaceFromHead(head('/Users/alice/Notes-Site/')), 'Notes-Site');
  assert.equal(codexWorkspaceFromHead(head('C:\\Work\\Notes-Site')), 'Notes-Site');
  assert.equal(codexWorkspaceFromHead('invalid\n'+head('/tmp/日本語')), '日本語');
  assert.equal(codexWorkspaceFromHead('{"cwd":"wrong"}'), 'Codex');
});

test("generic fallback workspace names require an explicit choice", () => {
  assert.equal(matchAgentProject("Codex", [project("x", "Codex")]).projectId, null);
  assert.equal(matchAgentProject("Codex", [project("x", "Personal OS", '["workspace:Codex"]')]).projectId, "x");
});
