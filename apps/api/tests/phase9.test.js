import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loginUser, registerUser, verifyToken } from "../src/lib/auth.js";
import { createJob, getJob, queueBackend } from "../src/lib/queue.js";

describe("auth (Phase 9)", () => {
  it("registers, logs in, and verifies tokens", async () => {
    const email = `student${Date.now()}@example.com`;
    const token = await registerUser({ email, password: "supersecret1", name: "Stu Dent" });
    assert.ok(typeof token === "string" && token.split(".").length === 3, "expected a JWT");
    const claims = verifyToken(token);
    assert.equal(claims.email, email);
    const again = await loginUser({ email, password: "supersecret1" });
    assert.ok(again, "login should return a token");
  });
  it("rejects duplicates, short passwords, and bad logins", async () => {
    const email = `dupe${Date.now()}@example.com`;
    await registerUser({ email, password: "supersecret1" });
    await assert.rejects(() => registerUser({ email, password: "supersecret1" }), /already registered/);
    await assert.rejects(() => registerUser({ email: "x@y.z", password: "short" }), /at least 8/);
    await assert.rejects(() => loginUser({ email, password: "wrongpassword" }), /Invalid/);
    assert.equal(verifyToken("not.a.token"), null);
  });
});

describe("job queue (Phase 9)", () => {
  it("uses the in-process backend without REDIS_URL", () => {
    assert.equal(queueBackend(), process.env.REDIS_URL ? "bullmq" : "memory");
  });
  it("rejects invalid job input", async () => {
    await assert.rejects(() => createJob("generate", {}), /Invalid input/);
    await assert.rejects(() => createJob("teleport", { aim: "Explore subqueries in SQL" }), /Unsupported/);
  });
  it("enqueues a valid job as pending", async () => {
    const job = await createJob("generate", { aim: "Explore subqueries in SQL", subject: "UHV" });
    assert.equal(job.status, "pending");
    assert.ok(getJob(job.id), "job must be pollable");
    // Let the in-process runner pick it up; it will fail gracefully here
    // (no AI service in unit tests) and land in failed, not hang.
    await new Promise((r) => setTimeout(r, 1500));
    const after = getJob(job.id);
    assert.ok(["generating", "researching", "validating", "failed", "completed"].includes(after.status));
  });
});
