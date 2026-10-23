import assert from "node:assert/strict";
import { test } from "node:test";
import { contactInputError } from "./contact-validation";

test("contact writes reject empty names, invalid cadence, ratings and dates", () => {
  for (const body of [null, [], {}, { name: " " }, { name: "A", importance: 0 }, { name: "A", responseLevel: 6 }, { name: "A", contactFrequencyDays: 0 }, { name: "A", contactFrequencyDays: 1.5 }, { name: "A", birthday: "bad" }]) assert.ok(contactInputError(body));
  assert.equal(contactInputError({name:"A", importance:5, contactFrequencyDays:14}),null);
});
test("partial contact writes preserve unrelated fields and allow clearing optional values", () => {
  assert.equal(contactInputError({categoryId:null,responseLevel:null,birthday:""},true),null);
  assert.equal(contactInputError({notes:"notes"},true),null);
});
