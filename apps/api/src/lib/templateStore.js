import { loadTemplates } from "./templates.js";

// Versioned template store (Phase 8). Seeds load as v1; every update creates a
// NEW immutable version — historical assignments keep working because records
// store { templateId, templateVersion } snapshots, never live references.

const versions = new Map(); // `${id}@${version}` -> template object
const latest = new Map(); // id -> version number

function key(id, version) {
  return `${id}@${version}`;
}

function seed() {
  if (versions.size) return;
  for (const doc of loadTemplates()) {
    const t = doc.template;
    if (!t?.id) continue;
    versions.set(key(t.id, t.version ?? 1), { ...t, version: t.version ?? 1 });
    latest.set(t.id, Math.max(latest.get(t.id) ?? 0, t.version ?? 1));
  }
}

function slugify(name) {
  return String(name ?? "template").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-+|-+$/g, "").slice(0, 60) || "template";
}

export function listTemplates() {
  seed();
  return [...latest.entries()].map(([id, v]) => versions.get(key(id, v)));
}

export function getTemplateVersion(id, version) {
  seed();
  if (version == null) {
    const v = latest.get(id);
    return v == null ? null : versions.get(key(id, v));
  }
  return versions.get(key(id, Number(version))) ?? null;
}

// Renderer-compatible doc shape { template }.
export function getTemplateDoc(id, version) {
  const t = getTemplateVersion(id, version);
  return t ? { template: t } : null;
}

export function getDefaultTemplateDoc() {
  seed();
  const all = listTemplates();
  return { template: all.find((t) => t.status === "active") ?? all[0] ?? null };
}

export function createTemplate(data) {
  seed();
  const id = data.id ?? `${slugify(data.name)}-${Date.now().toString(36)}`;
  if (latest.has(id)) throw new Error(`Template "${id}" already exists (update it for a new version)`);
  const t = {
    status: "draft",
    requiredSections: ["title", "aim", "objectives", "theory", "steps", "conclusion"],
    page: { size: "A4", margin: { top: "110px", right: "18mm", bottom: "20mm", left: "18mm" } },
    typography: { fontFamily: "Georgia, 'Times New Roman', serif", baseSize: "12pt", lineHeight: 1.6 },
    header: { image: null, everyPage: true },
    watermark: { image: null, everyPage: true },
    footer: { text: "", showPageNumber: true },
    ...data,
    id,
    version: 1,
  };
  versions.set(key(id, 1), t);
  latest.set(id, 1);
  return t;
}

export function updateTemplate(id, patch) {
  seed();
  const current = getTemplateVersion(id);
  if (!current) return null;
  if (current.seedImmutable && patch.version == null) {
    // Seeds are immutable: updates always fork a new version, never mutate.
  }
  const next = { ...current, ...patch, id, version: (latest.get(id) ?? 1) + 1 };
  delete next.seedImmutable;
  versions.set(key(id, next.version), next);
  latest.set(id, next.version);
  return next;
}
