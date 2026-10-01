import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Shared assignment record store (extracted for reuse by routes + job queue).
// Persisted to a JSON file so records survive API restarts — otherwise every
// restart wipes history and old ids 404 for the frontend.
const store = new Map();
let counter = 0;

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data");
const dataFile = join(dataDir, "assignments.json");

function loadPersisted() {
  if (!existsSync(dataFile)) return;
  try {
    const parsed = JSON.parse(readFileSync(dataFile, "utf8"));
    for (const record of parsed.records ?? []) {
      if (record?.id) store.set(record.id, record);
    }
    counter = Number(parsed.counter) || 0;
  } catch (err) {
    console.warn("[store] could not load persisted assignments, starting empty:", String(err));
  }
}

function persist() {
  // node --test doesn't set NODE_ENV; detect the test runner so tests never
  // write fixtures into the real runtime data file.
  if (
    process.env.NODE_ENV === "test" ||
    process.env.NODE_TEST_CONTEXT ||
    process.execArgv.includes("--test")
  ) {
    return;
  }
  try {
    mkdirSync(dataDir, { recursive: true });
    const tmp = `${dataFile}.tmp`;
    writeFileSync(tmp, JSON.stringify({ counter, records: [...store.values()] }));
    renameSync(tmp, dataFile);
  } catch (err) {
    console.warn("[store] could not persist assignments:", String(err));
  }
}

loadPersisted();

export function nextAssignmentId() {
  counter += 1;
  return `asg_${Date.now()}_${counter}`;
}

export function saveRecord(record) {
  store.set(record.id, record);
  persist();
  return record;
}

export function getRecord(id) {
  return store.get(id) ?? null;
}

export function listRecords() {
  return [...store.values()].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}
