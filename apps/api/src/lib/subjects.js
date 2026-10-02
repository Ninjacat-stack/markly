import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FALLBACK = {
  requiresCode: false,
  languages: [],
  requiresResearch: false,
  validation: {},
};

let cache = null;

function loadAll() {
  if (cache) return cache;
  const here = dirname(fileURLToPath(import.meta.url));
  // src/lib -> root is 4 levels up; plus cwd-based fallbacks however the server is launched.
  const candidates = [
    process.env.SUBJECT_PROFILES_PATH,
    join(here, "..", "..", "..", "..", "packages", "shared", "subject-profiles.json"),
    join(process.cwd(), "..", "..", "packages", "shared", "subject-profiles.json"),
    join(process.cwd(), "packages", "shared", "subject-profiles.json"),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (existsSync(p)) {
        const raw = JSON.parse(readFileSync(p, "utf8"));
        cache = raw.subjects ?? {};
        return cache;
      }
    } catch {
      // fall through to fallback
    }
  }
  cache = {};
  return cache;
}

export function getSubjectProfile(subject) {
  const all = loadAll();
  for (const [key, value] of Object.entries(all)) {
    if (key.toLowerCase() === (subject ?? "").toLowerCase()) return value;
  }
  return all[subject] ?? FALLBACK;
}
