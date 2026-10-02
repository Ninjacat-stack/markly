// Shared assignment record store.
// Memory is the hot cache; Mongo (when connected) is the durable source.
// Every record carries userId ("anonymous" for logged-out/dev use); reads are
// scoped so users only ever see legacy/shared records plus their own.

const store = new Map();
let counter = 0;

export function nextAssignmentId() {
  counter += 1;
  return `asg_${Date.now()}_${counter}`;
}

export function saveRecord(record) {
  store.set(record.id, record);
  return record;
}

export function getRecord(id) {
  return store.get(id) ?? null;
}

export function ownerId(req) {
  return req?.user?.sub ?? "anonymous";
}

export function canAccess(record, requesterId) {
  if (!record) return false;
  const owner = record.userId ?? record.data?.userId ?? "anonymous";
  return owner === "anonymous" || owner === (requesterId ?? "anonymous");
}

// Best-effort durable write (no-op without Mongo). Fire-and-forget safe.
export async function persistRecord(record) {
  try {
    const mongoose = (await import("mongoose")).default;
    if (mongoose.connection.readyState !== 1) return false;
    const { Assignment } = await import("../models/index.js");
    await Assignment.updateOne(
      { recordId: record.id },
      { $set: { recordId: record.id, userId: record.userId ?? "anonymous", data: record } },
      { upsert: true },
    );
    return true;
  } catch {
    return false;
  }
}

// Memory first, then Mongo (warming the cache). Null when missing OR forbidden.
export async function findRecord(id, requesterId) {
  const mem = store.get(id) ?? null;
  if (mem) return canAccess(mem, requesterId) ? mem : null;
  try {
    const mongoose = (await import("mongoose")).default;
    if (mongoose.connection.readyState !== 1) return null;
    const { Assignment } = await import("../models/index.js");
    const doc = await Assignment.findOne({ recordId: id }).lean();
    const record = doc?.data ?? null;
    if (!record) return null;
    if (!canAccess(record, requesterId)) return null;
    store.set(record.id, record);
    return record;
  } catch {
    return null;
  }
}

function compareNewest(a, b) {
  return String(b?.createdAt ?? "").localeCompare(String(a?.createdAt ?? ""));
}

// Union of memory + Mongo visible to this requester (memory wins on conflict).
export async function listRecordsFor(requesterId) {
  const seen = new Map();
  for (const r of store.values()) {
    if (canAccess(r, requesterId)) seen.set(r.id, r);
  }
  try {
    const mongoose = (await import("mongoose")).default;
    if (mongoose.connection.readyState === 1) {
      const { Assignment } = await import("../models/index.js");
      const docs = await Assignment.find({}).lean();
      for (const d of docs) {
        const r = d?.data;
        if (r?.id && !seen.has(r.id) && canAccess(r, requesterId)) seen.set(r.id, r);
      }
    }
  } catch {
    // Memory results stand on their own.
  }
  return [...seen.values()].sort(compareNewest);
}

export function listRecords() {
  return [...store.values()].sort(compareNewest);
}

// Remove everywhere: memory, Mongo, and the generated PDF file (best-effort each).
export async function deleteRecord(id) {
  store.delete(id);
  try {
    const mongoose = (await import("mongoose")).default;
    if (mongoose.connection.readyState === 1) {
      const { Assignment } = await import("../models/index.js");
      await Assignment.deleteOne({ recordId: id });
    }
  } catch {
    // Non-fatal.
  }
  try {
    const { join } = await import("node:path");
    const { unlinkSync, existsSync } = await import("node:fs");
    const { assetsDir } = await import("./storage.js");
    const pdf = join(assetsDir, "generated", `assignment-${id}.pdf`);
    if (existsSync(pdf)) unlinkSync(pdf);
  } catch {
    // Non-fatal.
  }
}
