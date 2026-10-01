import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assignmentContentSchema, generateInputSchema } from "../src/schemas.js";

const validDoc = {
  experimentNumber: 7,
  title: "Exploring subqueries in SQL",
  aim: "Explore subqueries in SQL",
  objectives: ["Understand scalar and correlated subqueries"],
  theory: ["A subquery is a query nested inside another query with explanatory context."],
  steps: [
    { number: 1, title: "Setup", description: ["Create sample tables for the exercise."], code: null, language: null },
    { number: 2, title: "Scalar subquery", description: ["Write and run a scalar subquery."], code: "SELECT * FROM t WHERE x = (SELECT MAX(x) FROM t);", language: "sql" },
  ],
  conclusion: "Subqueries were explored and documented with observed outputs recorded.",
  metadata: {},
};

describe("input validation", () => {
  it("rejects missing aim", () => {
    assert.equal(generateInputSchema.safeParse({ subject: "DBMS" }).success, false);
  });
  it("accepts aim-only request (rest inferred)", () => {
    const r = generateInputSchema.safeParse({ aim: "Explore subqueries in SQL" });
    assert.equal(r.success, true);
  });
});

describe("assignment schema", () => {
  it("accepts a valid document", () => {
    assert.equal(assignmentContentSchema.safeParse(validDoc).success, true);
  });
  it("rejects viva questions", () => {
    const bad = { ...validDoc, conclusion: "Viva questions: what is SQL?" };
    const r = assignmentContentSchema.safeParse(bad);
    assert.equal(r.success, false);
  });
  it("rejects malformed LLM output (bad step numbering)", () => {
    const bad = { ...validDoc, steps: [{ ...validDoc.steps[0], number: 5 }, validDoc.steps[1]] };
    assert.equal(assignmentContentSchema.safeParse(bad).success, false);
  });
  it("rejects non-sequential steps and unknown keys", () => {
    const bad = { ...validDoc, steps: [validDoc.steps[1], validDoc.steps[0]], extra: 1 };
    assert.equal(assignmentContentSchema.safeParse(bad).success, false);
  });
});
