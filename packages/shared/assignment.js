// Canonical Assignment shapes (Phase 1). JS mirror of assignment.schema.json.
// JSDoc typedefs below exist for editors only; there is no build step.
//
// @typedef {Object} AssignmentStep
// @property {number} number
// @property {string} title
// @property {string[]} description
// @property {string|null} code
// @property {string|null} language
//
// @typedef {Object} AssignmentContent
// @property {number|null} experimentNumber
// @property {string} title
// @property {string} aim
// @property {string[]} objectives
// @property {string[]} theory
// @property {AssignmentStep[]} steps
// @property {string} conclusion
// @property {Object} metadata

export const GenerationStatuses = Object.freeze([
  "pending",
  "researching",
  "generating",
  "validating",
  "rendering",
  "completed",
  "failed",
]);

export const INITIAL_SUBJECTS = Object.freeze([
  "DBMS",
  "DSA",
  "UHV",
  "DLDCA",
  "Professional Skills / AWS",
]);
