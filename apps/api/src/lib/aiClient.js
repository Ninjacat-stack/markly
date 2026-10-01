// Thin client for the Python AI service. Business logic lives here (Node);
// the AI service only runs the Planner->LLM->Validate pipeline.
export async function generateViaAiService(payload, baseUrl) {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/generate`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI service ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}
