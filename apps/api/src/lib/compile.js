import { execFile } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { resolveAsset } from "./storage.js";

const execFileAsync = promisify(execFile);

// PDF compilation (Phase 4). NEVER runs pdflatex on the host.
// Default strategy: one-shot texlive container. Override with PDF_COMPILE_CMD,
// a shell template using {dir} (working dir holding doc.tex) — e.g. on a
// machine with native Docker:  docker run --rm -v "{dir}:/work" -w /work texlive/texlive:latest ...
// From Windows with Docker inside WSL:  wsl docker run --rm -v "$(wslpath '{dir}'):/work" -w /work texlive/texlive:latest ...
// Compilation failures return { ok: false } with the compiler output attached.

const DEFAULT_CMD =
  process.env.PDF_COMPILE_CMD ??
  'docker run --rm -v "{dir}:/work" -w /work texlive/texlive:latest pdflatex -interaction=nonstopmode -halt-on-error doc.tex';

function fillCmd(dir) {
  return DEFAULT_CMD.replaceAll("{dir}", dir).replaceAll("{tex}", join(dir, "doc.tex"));
}

export async function compileLatexToPdf(tex, template) {
  const dir = mkdtempSync(join(tmpdir(), "assignmentai-tex-"));
  try {
    writeFileSync(join(dir, "doc.tex"), tex);
    // Asset filenames are fixed so \includegraphics{header.png} resolves.
    const header = resolveAsset(template?.template?.header?.image);
    const wm = resolveAsset(template?.template?.watermark?.image);
    if (header) copyFileSync(header, join(dir, "header.png"));
    if (wm) copyFileSync(wm, join(dir, "watermark.png"));

    const cmd = fillCmd(dir);
    try {
      await execFileAsync(cmd, { shell: true, timeout: 120000, cwd: dir, maxBuffer: 4 * 1024 * 1024 });
    } catch (err) {
      const log = tailFile(join(dir, "doc.log"), 60);
      return { ok: false, error: `PDF compilation failed: ${String(err.message ?? err).slice(0, 500)}`, log };
    }
    return { ok: true, pdf: readFileSync(join(dir, "doc.pdf")) };
  } catch (err) {
    return { ok: false, error: `PDF pipeline error: ${String(err.message ?? err).slice(0, 500)}`, log: "" };
  }
}

function tailFile(path, lines) {
  try {
    const all = readFileSync(path, "utf8").split("\n");
    return all.slice(-lines).join("\n");
  } catch {
    return "";
  }
}
