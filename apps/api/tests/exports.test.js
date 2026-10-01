import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderLatex, escapeLatex } from "../src/render/latex.js";
import { renderDocx } from "../src/render/docx.js";
import { compileLatexToPdf, fillCmd, toWslPath } from "../src/lib/compile.js";
import { getDefaultTemplate } from "../src/lib/templates.js";
import { WATERMARK_OPACITY } from "../src/render/html.js";

const doc = {
  experimentNumber: 7,
  title: "Exploring subqueries in SQL",
  aim: "Explore subqueries in SQL",
  objectives: ["Understand scalar and correlated subqueries"],
  theory: ["A subquery is a query nested inside another query with context."],
  steps: [
    {
      number: 1,
      title: "Scalar subquery",
      description: ["Write and run a scalar subquery."],
      code: "SELECT * FROM t WHERE x = (SELECT MAX(x) FROM t);",
      language: "sql",
    },
  ],
  conclusion: "Subqueries were explored and observed outputs recorded.",
  metadata: {},
};

describe("LaTeX renderer", () => {
  it("enforces 50% watermark via transparent package", () => {
    assert.equal(WATERMARK_OPACITY, 0.5);
    const tex = renderLatex(doc, getDefaultTemplate());
    assert.ok(tex.includes("\\transparent{0.5}"), "watermark must use \\transparent{0.5}");
    assert.ok(tex.includes("AddToShipoutPictureBG"), "watermark must be on every page");
    assert.ok(tex.includes("fancyhead"), "header must be configured");
  });
  it("escapes LaTeX special characters", () => {
    assert.equal(escapeLatex("100% sure & $5 #1 _x_"), "100\\% sure \\& \\$5 \\#1 \\_x\\_");
    const tex = renderLatex({ ...doc, aim: "Use 100% & more" }, getDefaultTemplate());
    assert.ok(tex.includes("100\\% \\& more"));
  });
});

describe("DOCX renderer", () => {
  it("produces a valid non-empty .docx package", async () => {
    const buf = Buffer.from(await renderDocx(doc, getDefaultTemplate()));
    assert.ok(buf.length > 2000, `suspiciously small docx (${buf.length} bytes)`);
    assert.equal(buf[0], 0x50);
    assert.equal(buf[1], 0x4b); // PK zip magic
  });
});

describe("PDF compiler", () => {
  it("fails gracefully when no compiler is available", async () => {
    const prev = process.env.PDF_COMPILE_CMD;
    process.env.PDF_COMPILE_CMD = "definitely-not-a-real-command-xyz {dir}";
    try {
      const out = await compileLatexToPdf("\\documentclass{article}\\begin{document}hi\\end{document}", null);
      assert.equal(out.ok, false);
      assert.ok(out.error.length > 0, "expected an explanatory error, not a crash");
    } finally {
      if (prev === undefined) delete process.env.PDF_COMPILE_CMD;
      else process.env.PDF_COMPILE_CMD = prev;
    }
  });
});

describe("WSL compile command", () => {
  it("translates Windows temp paths for WSL docker mounts", () => {
    assert.equal(toWslPath("C:\\Users\\Admin\\Temp\\assignmentai-tex-abc"), "/mnt/c/Users/Admin/Temp/assignmentai-tex-abc");
    assert.equal(toWslPath("/tmp/assignmentai-tex-abc"), "/tmp/assignmentai-tex-abc");
  });
  it("fills {wslDir} from PDF_COMPILE_CMD", () => {
    const prev = process.env.PDF_COMPILE_CMD;
    process.env.PDF_COMPILE_CMD = 'wsl docker run --rm -v "{wslDir}:/work" img';
    try {
      const cmd = fillCmd("C:\\Users\\Admin\\Temp\\workdir");
      assert.ok(cmd.includes("/mnt/c/Users/Admin/Temp/workdir:/work"), `got: ${cmd}`);
      assert.ok(!cmd.includes("{wslDir}"), "placeholder must be replaced");
    } finally {
      if (prev === undefined) delete process.env.PDF_COMPILE_CMD;
      else process.env.PDF_COMPILE_CMD = prev;
    }
  });
});
