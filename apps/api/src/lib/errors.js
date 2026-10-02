// Friendly-error contract (see deployment-notes §7 / system-overview §8):
// clients only ever receive a short, safe `error` string. Anything technical
// (stacks, driver text, compiler logs, validation dumps) is written to the
// server log instead — never into the response body, and therefore never onto
// the user's screen or into their browser console.

export function sendError(res, status, safeMessage, detail) {
  if (detail !== undefined) {
    if (status >= 500) console.error(`[api] ${safeMessage}:`, detail);
    else console.warn(`[api] ${safeMessage}:`, detail);
  }
  return res.status(status).json({ error: safeMessage });
}
