import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createTemplate,
  getDefaultTemplateDoc,
  getTemplateDoc,
  getTemplateVersion,
  listTemplates,
  updateTemplate,
} from "../src/lib/templateStore.js";

describe("template store (Phase 8)", () => {
  it("seeds the TCET template as v1", () => {
    const doc = getTemplateDoc("tcet-computer-engineering");
    assert.ok(doc, "seed missing");
    assert.equal(doc.template.version, 1);
    assert.equal(doc.template.header.everyPage, true);
  });
  it("updates fork new immutable versions", () => {
    const created = createTemplate({ name: "Versioning test template" });
    assert.equal(created.version, 1);
    const v2 = updateTemplate(created.id, { name: "Versioning test template", footer: { text: "F2" } });
    assert.equal(v2.version, 2);
    assert.equal(v2.footer.text, "F2");
    const v1 = getTemplateVersion(created.id, 1);
    assert.equal(v1.version, 1);
    assert.notEqual(v1.footer?.text, "F2", "v1 must stay immutable");
    assert.equal(getTemplateVersion(created.id).version, 2, "latest must be v2");
  });
  it("rejects duplicate ids and unknown lookups", () => {
    assert.equal(getTemplateVersion("no-such-template"), null);
    assert.throws(() => createTemplate({ id: "tcet-computer-engineering", name: "Duplicate attempt here" }), /already exists/);
  });
  it("lists latest versions only", () => {
    const ids = listTemplates().map((t) => `${t.id}@${t.version}`);
    assert.ok(ids.includes("tcet-computer-engineering@1"));
    assert.ok(getDefaultTemplateDoc().template, "expected a default template");
  });
});
