import { Router } from "express";
import { SECTION_NAMES, assignmentContentSchema, generateInputSchema, sectionValueSchemas } from "../schemas.js";
import { generateViaAiService, regenerateSectionViaAiService } from "../lib/aiClient.js";
import { getSubjectProfile } from "../lib/subjects.js";
import { getDefaultTemplateDoc, getTemplateDoc } from "../lib/templateStore.js";
import { getRecord, listRecords, nextAssignmentId, saveRecord } from "../lib/assignmentStore.js";
import { renderHtml } from "../render/html.js";

export const assignmentsRouter = Router();

// Records live in the shared assignment store (Mongo persistence is best-effort; see index.js).

/**
 * POST /api/v1/assignments/generate
 * Body: { aim*, description?, subject?, experimentNumber?, technology?, difficulty?, ... }
 * Flow: validate -> subject profile lookup -> tenant template lookup -> AI service -> validate -> return.
 */
assignmentsRouter.post("/generate", async (req, res) => {
  const parsed = generateInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  const input = parsed.data;
  const profile = getSubjectProfile(input.subject);
  // Template lookup from tenant seeds (requested templateId or the active default).
  const seed = (input.templateId && getTemplateDoc(input.templateId)) || getDefaultTemplateDoc();
  const template = seed
    ? { id: seed.template.id, version: seed.template.version, name: seed.template.name }
    : { id: "default-v1", version: 1, note: "No tenant template seeds found" };

  const aiBase = process.env.AI_SERVICE_URL ?? "http://127.0.0.1:8001";
  try {
    const result = await generateViaAiService(input, aiBase);
    const content = assignmentContentSchema.safeParse(result.content);
    if (!content.success) {
      return res
        .status(502)
        .json({ error: "AI service returned invalid Assignment JSON", details: content.error.flatten() });
    }
    const id = nextAssignmentId();
    const record = {
      id,
      status: "completed",
      input,
      subjectProfile: profile,
      template,
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
    console.error(`[api] generation failed for aim "${input.aim.slice(0, 80)}":`, String(err));
    return res.status(502).json({ error: "Generation failed", details: String(err) });
  }
});

// Phase 9: generation history (summaries, newest first).
assignmentsRouter.get("/", (_req, res) => {
  const items = listRecords().map((r) => ({
    id: r.id,
    status: r.status,
    title: r.content?.title,
    aim: r.content?.aim,
    template: r.template,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
  res.json({ assignments: items });
});

assignmentsRouter.get("/:id", (req, res) => {
  const record = getRecord(req.params.id);
  if (!record) return res.status(404).json({ error: "Not found" });
  return res.json(record);
});

// Phase 2: printable HTML document (header + 50% watermark on every page).
assignmentsRouter.get("/:id/html", (req, res) => {
  const record = getRecord(req.params.id);
  if (!record) return res.status(404).json({ error: "Not found" });
  const seed = getTemplateDoc(record.template?.id) || getDefaultTemplateDoc();
  res.type("html").send(renderHtml(record.content, seed));
});

// Phase 3: regenerate one section; everything else stays untouched.
assignmentsRouter.post("/:id/regenerate-section", async (req, res) => {
  const record = getRecord(req.params.id);
  if (!record) return res.status(404).json({ error: "Not found" });
  const section = req.body?.section;
  if (!SECTION_NAMES.includes(section)) {
    return res.status(400).json({ error: `Invalid section (one of ${SECTION_NAMES.join(", ")})` });
  }
  const aiBase = process.env.AI_SERVICE_URL ?? "http://127.0.0.1:8001";
  try {
    const result = await regenerateSectionViaAiService(
      {
        section,
        aim: record.content.aim,
        subject: record.input?.subject ?? "DBMS",
        current: record.content,
        additionalInstructions: req.body?.additionalInstructions ?? null,
      },
      aiBase,
    );
    const value = sectionValueSchemas[section].safeParse(result.value);
    if (!value.success) {
      return res.status(502).json({ error: "Invalid regenerated section", details: value.error.flatten() });
    }
    record.content = { ...record.content, [section]: value.data };
    record.updatedAt = new Date().toISOString();
    saveRecord(record);
    return res.json(record);
  } catch (err) {
    console.error(`[api] section regeneration failed for ${record.id}:`, String(err));
    return res.status(502).json({ error: "Regeneration failed", details: String(err) });
  }
});

// Phase 3: save user-edited content (full re-validation).
assignmentsRouter.put("/:id", (req, res) => {
  const record = getRecord(req.params.id);
  if (!record) return res.status(404).json({ error: "Not found" });
  const parsed = assignmentContentSchema.safeParse(req.body?.content);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid assignment content", details: parsed.error.flatten() });
  }
  record.content = parsed.data;
  record.editedByUser = true;
  record.updatedAt = new Date().toISOString();
  saveRecord(record);
  return res.json(record);
});

// Phase 4: DOCX download (deterministic template injection, not LLM output).
assignmentsRouter.get("/:id/docx", async (req, res) => {
  const record = getRecord(req.params.id);
  if (!record) return res.status(404).json({ error: "Not found" });
  try {
    const { renderDocx } = await import("../render/docx.js");
    const seed = getTemplateDoc(record.template?.id) || getDefaultTemplateDoc();
    const buf = await renderDocx(record.content, seed);
    res.setHeader("content-type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("content-disposition", `attachment; filename="assignment-${record.id}.docx"`);
    return res.send(Buffer.from(buf));
  } catch (err) {
    return res.status(502).json({ error: "DOCX rendering failed", details: String(err).slice(0, 500) });
  }
});

// Phase 4: view LaTeX source (editable in the frontend via Monaco).
assignmentsRouter.get("/:id/latex", async (req, res) => {
  const record = getRecord(req.params.id);
  if (!record) return res.status(404).json({ error: "Not found" });
  if (record.latexOverride) return res.json({ latex: record.latexOverride, edited: true });
  const { renderLatex } = await import("../render/latex.js");
  const seed = getTemplateDoc(record.template?.id) || getDefaultTemplateDoc();
  return res.json({ latex: renderLatex(record.content, seed), edited: false });
});

// Phase 4: save user-edited LaTeX (treated as untrusted input to the compiler).
assignmentsRouter.put("/:id/latex", (req, res) => {
  const record = getRecord(req.params.id);
  if (!record) return res.status(404).json({ error: "Not found" });
  const latex = req.body?.latex;
  if (typeof latex !== "string" || latex.length < 10 || latex.length > 200000) {
    return res.status(400).json({ error: "Invalid LaTeX (must be 10..200000 chars)" });
  }
  record.latexOverride = latex;
  record.updatedAt = new Date().toISOString();
  saveRecord(record);
  return res.json({ ok: true });
});

// Phase 4: compile to PDF inside an isolated container; failures are explicit.
assignmentsRouter.post("/:id/pdf", async (req, res) => {
  const record = getRecord(req.params.id);
  if (!record) return res.status(404).json({ error: "Not found" });
  try {
    const [{ renderLatex }, { compileLatexToPdf }] = await Promise.all([
      import("../render/latex.js"),
      import("../lib/compile.js"),
    ]);
    const seed = getTemplateDoc(record.template?.id) || getDefaultTemplateDoc();
    const tex = record.latexOverride ?? renderLatex(record.content, seed);
    const out = await compileLatexToPdf(tex, seed);
    if (!out.ok) return res.status(502).json({ error: out.error, log: out.log });
    try {
      const { join } = await import("node:path");
      const { assetsDir } = await import("../lib/storage.js");
      const { writeFileSync } = await import("node:fs");
      writeFileSync(join(assetsDir, "generated", `assignment-${record.id}.pdf`), out.pdf);
    } catch {
      // Non-fatal: streaming the PDF below is what matters.
    }
    res.setHeader("content-type", "application/pdf");
    res.setHeader("content-disposition", `attachment; filename="assignment-${record.id}.pdf"`);
    return res.send(Buffer.from(out.pdf));
  } catch (err) {
    return res.status(502).json({ error: "PDF pipeline failed", details: String(err).slice(0, 500) });
  }
});
