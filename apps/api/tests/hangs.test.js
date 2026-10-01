import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { generateViaAiService } from "../src/lib/aiClient.js";
import { closeQueue, createJob, getJob } from "../src/lib/queue.js";

describe("hang guards", () => {
  it("aborts a stalled AI service instead of hanging forever", async () => {
    const server = http.createServer((_req, _res) => {
      // Accept the connection, never respond (wedged gateway simulation).
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const port = server.address().port;
    const start = Date.now();
    try {
      await assert.rejects(
        () => generateViaAiService({ aim: "0123456789" }, `http://127.0.0.1:${port}`, 400),
        /timed out/,
      );
      assert.ok(Date.now() - start < 10000, "must fail fast instead of hanging");
    } finally {
      server.close();
    }
  });

  it("stays on the memory queue unless BullMQ is explicitly enabled", async () => {
    const prevRedis = process.env.REDIS_URL;
    const prevFlag = process.env.BULLMQ_ENABLED;
    const prevAi = process.env.AI_SERVICE_URL;
    // Dead redis configured but NOT opted in -> must not even attempt BullMQ.
    process.env.REDIS_URL = "redis://127.0.0.1:6399";
    delete process.env.BULLMQ_ENABLED;
    // Dead AI port: instant refusal, no real AI touched.
    process.env.AI_SERVICE_URL = "http://127.0.0.1:9";
    try {
      const job = await createJob("generate", { aim: "Fallback probe XYZ", subject: "UHV" });
      assert.equal(job.backend, "memory");
      await new Promise((r) => setTimeout(r, 2500));
      const after = getJob(job.id);
      // Fetch refuses instantly -> graceful failure. Key point: it settles, never hangs.
      assert.ok(["failed", "completed"].includes(after.status), `status=${after.status}`);
    } finally {
      if (prevRedis === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = prevRedis;
      if (prevFlag === undefined) delete process.env.BULLMQ_ENABLED;
      else process.env.BULLMQ_ENABLED = prevFlag;
      if (prevAi === undefined) delete process.env.AI_SERVICE_URL;
      else process.env.AI_SERVICE_URL = prevAi;
      await closeQueue();
    }
  });
});
