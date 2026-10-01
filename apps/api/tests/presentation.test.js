import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateInputSchema } from "../src/schemas.js";
import { renderHtml } from "../src/render/html.js";
import { renderLatex } from "../src/render/latex.js";
import { renderDocx } from "../src/render/docx.js";
import { getDefaultTemplateDoc } from "../src/lib/templateStore.js";

const doc = {
  experimentNumber: 7,
  title: "Exploring subqueries in SQL",
  aim: "Explore subqueries in SQL",
  objectives: ["Understand scalar and correlated subqueries well"],
  theory: ["A subquery is a query nested inside another query with context."],
  steps: [
    { number: 1, title: "Setup", description: ["Create sample tables."], code: null, language: null },
  ],
  conclusion: "Subqueries were explored and observed outputs recorded.",
  metadata: {},
};

describe("presentation flags (viva + handwritten conclusion)", () => {
  it("defaults to no viva heading and typed conclusion", () => {
    const parsed = generateInputSchema.safeParse({ aim: "Explore subqueries in SQL" });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.includeVivaTitle, false);
    assert.equal(parsed.data.typedConclusion, true);
  });

  it("never generates viva questions — heading only, when enabled", () => {
    const off = renderHtml(doc, getDefaultTemplateDoc(), {});
    assert.ok(!off.includes("Viva Questions"), "viva heading must be off by default");
    const on = renderHtml(doc, getDefaultTemplateDoc(), { includeVivaTitle: true });
    assert.ok(on.includes("<h2>Viva Questions</h2>"), "viva heading missing when enabled");
    assert.ok(!/viva(?! questions)/i.test(on.replace("Viva Questions", "")), "no viva question text allowed");
    const tex = renderLatex(doc, getDefaultTemplateDoc(), { includeVivaTitle: true });
    assert.ok(tex.includes("\\section*{Viva Questions}"), "latex viva heading missing");
  });

  it("renders blank handwriting space instead of typed conclusion when asked", () => {
    const typed = renderHtml(doc, getDefaultTemplateDoc(), { typedConclusion: true });
    assert.ok(typed.includes("observed outputs recorded"), "typed conclusion missing");
    const blank = renderHtml(doc, getDefaultTemplateDoc(), { typedConclusion: false });
    assert.ok(!blank.includes("observed outputs recorded"), "conclusion text must not render in handwritten mode");
    assert.ok(blank.includes('class="handwrite"'), "handwriting space missing");
    const tex = renderLatex(doc, getDefaultTemplateDoc(), { typedConclusion: false });
    assert.ok(!tex.includes("observed outputs recorded"), "latex must not carry typed conclusion");
    assert.ok(tex.includes("\\vspace{45mm}"), "latex handwriting space missing");
  });

  it("builds DOCX with flags without errors", async () => {
    const buf = Buffer.from(
      await renderDocx(doc, getDefaultTemplateDoc(), { includeVivaTitle: true, typedConclusion: false }),
    );
    assert.ok(buf.length > 2000, "suspiciously small docx");
  });
});
