// Shared assignment record store (extracted for reuse by routes + job queue).
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

export function listRecords() {
  return [...store.values()].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}
