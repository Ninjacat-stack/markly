import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getSubjectProfile } from "../src/lib/subjects.js";

describe("subject profiles (regression)", () => {
  it("loads the real shared profiles file, not the fallback", () => {
    // Regression: the loader previously pointed at non-existent paths, so every
    // subject silently fell back to requiresResearch=false and research never ran.
    const dbms = getSubjectProfile("DBMS");
    assert.equal(dbms.requiresResearch, true);
    assert.equal(dbms.requiresCode, true);
    assert.equal(getSubjectProfile("dbms").requiresResearch, true);
    assert.equal(getSubjectProfile("DSA").requiresResearch, false);
    assert.equal(getSubjectProfile("Professional Skills / AWS").requiresResearch, true);
  });
});
