import { Router } from "express";
import multer from "multer";
import { sendError } from "../lib/errors.js";

export const examplesRouter = Router();

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

// Phase 6: upload a sample assignment PDF -> normalized example in the corpus.
examplesRouter.post("/ingest", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF file uploaded (field name: file)" });
  try {
    const form = new FormData();
    form.append("file", new Blob([req.file.buffer], { type: "application/pdf" }), req.file.originalname);
    form.append("subject", String(req.body?.subject ?? ""));
    const r = await fetch(`${aiBase()}/v1/ingest`, { method: "POST", body: form });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("[api] ingest failed:", r.status, JSON.stringify(data).slice(0, 500));
      return res.status(r.status).json({ error: "Ingestion failed" });
    }
    return res.json(data);
  } catch (err) {
    return sendError(res, 502, "Ingestion failed", String(err).slice(0, 500));
  }
});

// Phase 6: retrieve relevant ingested examples.
examplesRouter.get("/", async (req, res) => {
  try {
    const params = new URLSearchParams({
      subject: String(req.query.subject ?? ""),
      q: String(req.query.q ?? ""),
      k: String(req.query.k ?? 2),
    });
    const r = await fetch(`${aiBase()}/v1/examples?${params}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("[api] examples fetch failed:", r.status, JSON.stringify(data).slice(0, 500));
      return res.status(r.status).json({ error: "Example retrieval failed" });
    }
    return res.json(data);
  } catch (err) {
    return sendError(res, 502, "Example retrieval failed", String(err).slice(0, 500));
  }
});
