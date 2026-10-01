import { assignmentContentSchema, generateInputSchema } from "../schemas.js";
import { getRecord, nextAssignmentId, saveRecord } from "./assignmentStore.js";
import { generateViaAiService } from "./aiClient.js";
import { getSubjectProfile } from "./subjects.js";
import { getDefaultTemplateDoc, getTemplateDoc } from "./templateStore.js";

// Background generation jobs (Phase 9).
// Transport: BullMQ + Redis when REDIS_URL is set, otherwise an in-process
// queue. The jobs map below is the status source of truth either way
// (multi-process BullMQ deployments should move status into Redis/Mongo).

const jobs = new Map();
let counter = 0;
let bullmqQueue = null;
let bullmqWarned = false;

export function queueBackend() {
  return process.env.REDIS_URL ? "bullmq" : "memory";
}

function setStatus(job, status, patch = {}) {
  Object.assign(job, { status, updatedAt: new Date().toISOString() }, patch);
}

export function getJob(id) {
  return jobs.get(id) ?? null;
}

async function ensureBullmq() {
  if (bullmqQueue || !process.env.REDIS_URL) return bullmqQueue;
  try {
    const { Queue, Worker } = await import("bullmq");
    const connection = { url: process.env.REDIS_URL };
    bullmqQueue = new Queue("assignmentai-generation", { connection });
    const worker = new Worker(
      "assignmentai-generation",
      async (bjob) => runGenerationJob(bjob.data.input, bjob.data.jobId),
      { connection },
    );
    worker.on("failed", (bjob, err) => {
      const job = bjob?.data?.jobId ? jobs.get(bjob.data.jobId) : null;
      if (job && job.status !== "completed") setStatus(job, "failed", { error: String(err?.message ?? err) });
    });
    return bullmqQueue;
  } catch (err) {
    if (!bullmqWarned) {
      console.warn("[queue] BullMQ/Redis unavailable, falling back to in-process queue:", String(err).slice(0, 200));
      bullmqWarned = true;
    }
    return null;
  }
}

export async function createJob(type, input) {
  if (type !== "generate") throw new Error('Unsupported job type (only "generate")');
  const parsed = generateInputSchema.safeParse(input ?? {});
  if (!parsed.success) throw new Error("Invalid input for generation job");
  counter += 1;
  const job = {
    id: `job_${Date.now()}_${counter}`,
    type,
    status: "pending",
    progress: 0,
    backend: queueBackend(),
    input: parsed.data,
    assignmentId: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  const q = await ensureBullmq();
  if (q) {
    await q.add("generate", { jobId: job.id, input: job.input }).catch((err) => {
      console.warn("[queue] BullMQ enqueue failed, running in-process:", String(err).slice(0, 200));
      setImmediate(() => void runGenerationJob(job.input, job.id));
    });
  } else {
    setImmediate(() => void runGenerationJob(job.input, job.id));
  }
  return job;
}

export async function runGenerationJob(input, jobId) {
  const job = jobs.get(jobId);
  if (!job) throw new Error("Job not found");
  const aiBase = process.env.AI_SERVICE_URL ?? "http://127.0.0.1:8001";
  try {
    setStatus(job, "researching", { progress: 10 });
    const profile = getSubjectProfile(input.subject);
    const seed = (input.templateId && getTemplateDoc(input.templateId)) || getDefaultTemplateDoc();
    setStatus(job, "generating", { progress: 40 });
    const result = await generateViaAiService(input, aiBase);
    setStatus(job, "validating", { progress: 75 });
    const content = assignmentContentSchema.safeParse(result.content);
    if (!content.success) throw new Error("AI service returned invalid Assignment JSON");
    const record = {
      id: nextAssignmentId(),
      status: "completed",
      input,
      subjectProfile: profile,
      template: seed?.template
        ? { id: seed.template.id, version: seed.template.version, name: seed.template.name }
        : { id: "default-v1", version: 1 },
      content: content.data,
      sources: result.sources ?? [],
      provenance: {
        provider: result.provider,
        model: result.model,
        promptVersion: result.promptVersion,
        validation: result.validation,
        researchProvider: result.researchProvider ?? "none",
      },
      createdAt: new Date().toISOString(),
    };
    saveRecord(record);
    setStatus(job, "completed", { progress: 100, assignmentId: record.id });
    return record;
  } catch (err) {
    setStatus(job, "failed", { error: String(err?.message ?? err).slice(0, 500) });
    throw err;
  }
}

export function getAssignmentForJob(job) {
  return job.assignmentId ? getRecord(job.assignmentId) : null;
}
