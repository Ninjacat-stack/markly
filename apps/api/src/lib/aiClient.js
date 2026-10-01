// Thin client for the Python AI service. Business logic lives here (Node);
// the AI service only runs the Planner->LLM->Validate pipeline.
//
// Every call carries a timeout: Node's fetch has NO default timeout, so a
// stalled gateway connection would otherwise hang the request (and the UI)
// forever. Timeouts convert to a clear 502 instead.
const DEFAULT_TIMEOUT_MS = Number(process.env.AI_SERVICE_TIMEOUT_MS ?? 180000);

async function postJson(url, payload, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err?.name === "TimeoutError") {
      throw new Error(`AI service timed out after ${timeoutMs}ms (gateway slow or stalled)`);
    }
    throw err;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI service ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

export function generateViaAiService(payload, baseUrl, timeoutMs) {
  return postJson(`${String(baseUrl).replace(/\/$/, "")}/v1/generate`, payload, timeoutMs);
}

export function regenerateSectionViaAiService(payload, baseUrl, timeoutMs) {
  return postJson(`${String(baseUrl).replace(/\/$/, "")}/v1/regenerate-section`, payload, timeoutMs);
}
