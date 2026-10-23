import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseEntityHref } from "./entity-links";

describe("entity links", () => {
  it("recognises project and opportunity deep links", () => {
    assert.deepEqual(parseEntityHref("/projects?id=p1"), { kind: "project", id: "p1", page: "/projects" });
    assert.deepEqual(parseEntityHref("/opportunities?id=o1"), { kind: "opportunity", id: "o1", page: "/opportunities" });
    assert.deepEqual(parseEntityHref("/social?id=o2"), { kind: "opportunity", id: "o2", page: "/social" });
  });

  it("ignores everything else", () => {
    assert.equal(parseEntityHref("/projects"), null);
    assert.equal(parseEntityHref("/timeline?scale=day"), null);
    assert.equal(parseEntityHref("https://example.com/projects?id=p1"), null);
    assert.equal(parseEntityHref(null), null);
    assert.equal(parseEntityHref("not a url at all"), null);
  });
});
