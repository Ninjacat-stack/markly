import { Router } from "express";
import multer from "multer";
import {
  createTemplate,
  getTemplateVersion,
  listTemplates,
  updateTemplate,
} from "../lib/templateStore.js";

export const templatesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Only .pdf uploads are accepted"));
    }
  },
});

function aiBase() {
  return (process.env.AI_SERVICE_URL ?? "http://127.0.0.1:8001").replace(/\/$/, "");
}

function summary(t) {
  return {
    id: t.id,
    version: t.version,
    name: t.name,
    status: t.status,
    tenantId: t.tenantId,
    departmentId: t.departmentId,
  };
}

// Phase 8: list latest version of each template.
templatesRouter.get("/", (_req, res) => {
  res.json({ templates: listTemplates().map(summary) });
});

// Phase 8: get a version (?version=N, default latest). Old versions stay readable forever.
templatesRouter.get("/:id", (req, res) => {
  const t = getTemplateVersion(req.params.id, req.query.version ?? null);
  if (!t) return res.status(404).json({ error: "Template not found" });
  return res.json({ template: t });
});

// Phase 8: create (always starts at v1 draft).
templatesRouter.post("/", (req, res) => {
  const { name, tenantId, departmentId, header, watermark, footer, page, requiredSections } = req.body ?? {};
  if (!name || typeof name !== "string" || name.trim().length < 3) {
    return res.status(400).json({ error: "Template name (min 3 chars) is required" });
  }
  try {
    const t = createTemplate({ name, tenantId, departmentId, header, watermark, footer, page, requiredSections });
    tryPersist(t);
    return res.status(201).json({ template: t });
  } catch (err) {
    return res.status(409).json({ error: String(err.message ?? err) });
  }
});

// Phase 8: update forks a NEW immutable version (never mutates history).
templatesRouter.put("/:id", (req, res) => {
  const allowed = ["name", "status", "header", "watermark", "footer", "page", "typography", "requiredSections", "studentMetadataFields"];
  const patch = Object.fromEntries(Object.entries(req.body ?? {}).filter(([k]) => allowed.includes(k)));
  const t = updateTemplate(req.params.id, patch);
  if (!t) return res.status(404).json({ error: "Template not found" });
  tryPersist(t);
  return res.json({ template: t });
});

// Phase 8: upload a sample PDF -> structure draft -> saved as v1 draft for review.
templatesRouter.post("/from-pdf", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF file uploaded (field name: file)" });
  try {
    const form = new FormData();
    form.append("file", new Blob([req.file.buffer], { type: "application/pdf" }), req.file.originalname);
    const r = await fetch(`${aiBase()}/v1/analyze-template`, { method: "POST", body: form });
    const draft = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json(draft);
    const t = createTemplate({
      name: `${String(req.body?.name ?? draft.suggestedName ?? "Imported template").slice(0, 120)}`,
      tenantId: req.body?.tenantId,
      departmentId: req.body?.departmentId,
      requiredSections: draft.requiredSections,
      status: "draft",
    });
    tryPersist(t);
    return res.status(201).json({ template: t, analysis: draft });
  } catch (err) {
    return res.status(502).json({ error: "Template extraction failed", details: String(err).slice(0, 500) });
  }
});

async function tryPersist(t) {
  try {
    const mongoose = (await import("mongoose")).default;
    if (mongoose.connection.readyState !== 1) return;
    const { Template } = await import("../models/index.js");
    await Template.updateOne(
      { name: t.name, version: t.version },
      { $set: { ...t, tenantId: t.tenantId ?? null, departmentId: t.departmentId ?? null } },
      { upsert: true },
    );
  } catch {
    // Non-fatal in local mode.
  }
}
