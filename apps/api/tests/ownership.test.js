import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canAccess, ownerId } from "../src/lib/assignmentStore.js";

describe("record ownership (auth + Mongo matter now)", () => {
  it("derives anonymous owner without a token", () => {
    assert.equal(ownerId({}), "anonymous");
    assert.equal(ownerId({ user: { sub: "usr_1" } }), "usr_1");
  });
  it("legacy records without userId stay visible to everyone", () => {
    const legacy = { id: "asg_old", content: {} };
    assert.equal(canAccess(legacy, "anonymous"), true);
    assert.equal(canAccess(legacy, "usr_1"), true);
  });
  it("anonymous records are shared", () => {
    const r = { id: "asg_1", userId: "anonymous" };
    assert.equal(canAccess(r, "anonymous"), true);
    assert.equal(canAccess(r, "usr_1"), true);
  });
  it("owned records are private to their owner", () => {
    const r = { id: "asg_2", userId: "usr_1" };
    assert.equal(canAccess(r, "usr_1"), true);
    assert.equal(canAccess(r, "usr_2"), false);
    assert.equal(canAccess(r, "anonymous"), false);
  });
  it("missing records are never accessible", () => {
    assert.equal(canAccess(null, "usr_1"), false);
  });
});
