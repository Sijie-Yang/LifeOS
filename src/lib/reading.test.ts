import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveReadingLane, resolveStepLane } from "./reading";

describe("resolveReadingLane", () => {
  it("keeps deep-book notes and steps", () => {
    assert.equal(resolveReadingLane({ title: "书籍计划 · 一本读透" }), "deep-books");
    assert.equal(resolveReadingLane({ title: "01 · 读透《Power》" }), "deep-books");
    assert.equal(resolveReadingLane({ title: "Models · Mark Manson" }), "deep-books");
  });

  it("keeps Info / Science notes by prefix or tag", () => {
    assert.equal(resolveReadingLane({ title: "Info Reading · 系统" }), "info-reading");
    assert.equal(resolveReadingLane({ title: "Info · 某播客" }), "info-reading");
    assert.equal(resolveReadingLane({ title: "公开课笔记", readingTag: "lecture" }), "info-reading");
    assert.equal(resolveReadingLane({ title: "Science Info · 系统" }), "science-info");
    assert.equal(resolveReadingLane({ title: "Science · DreamerV3" }), "science-info");
    assert.equal(resolveReadingLane({ title: "量子优化", readingTag: "quantum-opt" }), "science-info");
  });

  it("leaves AI / English overviews unlaned", () => {
    assert.equal(resolveReadingLane({ title: "项目概览 · AI" }), null);
    assert.equal(resolveReadingLane({ title: "项目概览 · English" }), null);
    assert.equal(resolveStepLane("AI · ISLP Ch.1 · 制卡"), null);
  });
});
