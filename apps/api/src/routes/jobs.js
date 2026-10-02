import { Router } from "express";
import { createJob, getAssignmentForJob, getJob } from "../lib/queue.js";
import { ownerId } from "../lib/assignmentStore.js";

export const jobsRouter = Router();

// Phase 9: enqueue a background generation job (202 + pollable status).
jobsRouter.post("/", async (req, res) => {
  try {
    const job = await createJob(req.body?.type ?? "generate", req.body?.input ?? {}, ownerId(req));
    return res.status(202).json({ job });
  } catch (err) {
    return res.status(400).json({ error: String(err.message ?? err) });
  }
});

// Phase 9: poll job status (pending -> researching -> generating -> validating -> completed/failed).
jobsRouter.get("/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  // Jobs are private to their owner (anonymous jobs are shared, like legacy records).
  const requester = ownerId(req);
  if (job.userId && job.userId !== "anonymous" && job.userId !== requester) {
    return res.status(404).json({ error: "Job not found" });
  }
  const assignment = job.status === "completed" ? getAssignmentForJob(job) : null;
  return res.json({ job, assignment });
});
