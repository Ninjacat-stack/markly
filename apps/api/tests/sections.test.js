import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SECTION_NAMES, sectionValueSchemas } from "../src/schemas.js";

describe("section schemas (Phase 3)", () => {
  it("covers exactly the six editable sections", () => {
    assert.deepEqual([...SECTION_NAMES].sort(), ["aim", "conclusion", "objectives", "steps", "theory", "title"]);
  });
  it("accepts valid per-section values", () => {
    assert.equal(sectionValueSchemas.title.safeParse("Exploring subqueries in SQL").success, true);
    assert.equal(sectionValueSchemas.objectives.safeParse(["Learn subqueries well"]).success, true);
    assert.equal(
      sectionValueSchemas.steps.safeParse([
        { number: 1, title: "Do it", description: ["Run the queries."], code: null, language: null },
      ]).success,
      true,
    );
  });
  it("rejects bad section values", () => {
    assert.equal(sectionValueSchemas.title.safeParse("abc").success, false);
    assert.equal(sectionValueSchemas.objectives.safeParse([]).success, false);
    assert.equal(
      sectionValueSchemas.steps.safeParse([
        { number: 2, title: "Do it", description: ["Run the queries."], code: null, language: null },
      ]).success,
      false,
    );
  });
});
