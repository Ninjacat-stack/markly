import { Router } from "express";
import { assignmentContentSchema, generateInputSchema } from "../schemas.js";
import { generateViaAiService } from "../lib/aiClient.js";
import { getSubjectProfile } from "../lib/subjects.js";

export const assignmentsRouter = Router();

// In-memory store for Phase 1 (Mongo persistence activates when MONGODB_URI is set; see index.js).
const store = new Map();
let counter = 0;

/**
 * POST /api/v1/assignments/generate
 * Body: { aim*, description?, subject?, experimentNumber?, technology?, difficulty?, ... }
 * Flow: validate -> subject profile lookup -> template lookup (stub) -> AI service -> validate -> return.
 */
assignmentsRouter.post("/generate", async (req, res) => {
  const parsed = generateInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  const input = parsed.data;
  const profile = getSubjectProfile(input.subject);
  // Phase 1: template lookup is a stub (default template); full Template model lands in Phase 8.
  const template = { id: "default-v1", version: 1, note: "Phase 1 default template" };

  const aiBase = process.env.AI_SERVICE_URL ?? "http://127.0.0.1:8001";
  try {
    const result = await generateViaAiService(input, aiBase);
    const content = assignmentContentSchema.safeParse(result.content);
    if (!content.success) {
      return res
        .status(502)
        .json({ error: "AI service returned invalid Assignment JSON", details: content.error.flatten() });
    }
    counter += 1;
    const id = `asg_${Date.now()}_${counter}`;
    const record = {
      id,
      status: "completed",
      input,
      subjectProfile: profile,
      template,
      content: content.data,
      provenance: {
        provider: result.provider,
        model: result.model,
        promptVersion: result.promptVersion,
        validation: result.validation,
      },
      createdAt: new Date().toISOString(),
    };
    store.set(id, record);

    // Best-effort Mongo persistence (optional in Phase 1).
    try {
      const { Assignment } = await import("../models/index.js");
      const mongoose = (await import("mongoose")).default;
      if (mongoose.connection.readyState === 1) {
        await Assignment.create({
          userId: "anonymous",
          input,
          generatedContent: content.data,
          status: "completed",
        });
      }
    } catch {
      // Non-fatal: in-memory record above is the source of truth for the POC.
    }

    return res.json(record);
  } catch (err) {
    return res.status(502).json({ error: "Generation failed", details: String(err) });
  }
});

assignmentsRouter.get("/:id", (req, res) => {
  const record = store.get(req.params.id);
  if (!record) return res.status(404).json({ error: "Not found" });
  return res.json(record);
});
