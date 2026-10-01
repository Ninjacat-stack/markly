import { existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

// File storage abstraction. Local filesystem for development;
// swap the internals for cloud object storage later (same function names).
// Large binaries (templates, DOCX, LaTeX, PDFs) must never go into MongoDB.

const here = dirname(fileURLToPath(import.meta.url));
export const assetsDir = join(here, "..", "..", "assets");

export function ensureDirs() {
  for (const sub of ["", "uploads", "generated"]) {
    const dir = join(assetsDir, sub);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

// Resolve a template asset reference (e.g. "/assets/tcet-header.png") to a
// filesystem path. Returns null when the file is missing so renderers can
// degrade gracefully instead of emitting broken images.
export function resolveAsset(ref) {
  if (typeof ref !== "string" || !ref.startsWith("/assets/")) return null;
  const name = basename(ref);
  if (name !== ref.slice("/assets/".length)) return null; // no subpaths/traversal
  const full = join(assetsDir, name);
  return existsSync(full) ? full : null;
}

export function assetUrl(ref) {
  return typeof ref === "string" && ref.startsWith("/assets/") ? ref : null;
}
