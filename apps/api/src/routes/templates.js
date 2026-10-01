import { Router } from "express";
import { loadTemplates } from "../lib/templates.js";

export const templatesRouter = Router();

// Phase 2: read-only list from tenant seeds. CRUD + versioning lands in Phase 8.
templatesRouter.get("/", (_req, res) => {
  const list = loadTemplates().map((t) => ({
    id: t.template?.id,
    version: t.template?.version,
    name: t.template?.name,
    status: t.template?.status,
    tenantId: t.template?.tenantId,
    departmentId: t.template?.departmentId,
  }));
  res.json({ templates: list });
});
