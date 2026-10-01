import { WATERMARK_OPACITY } from "./html.js";

// LaTeX renderer (Phase 4). Same sections/order as the HTML renderer.
// Page frame: tikz border drawn on EVERY page. Watermark: tikz node anchored
// at the exact page center with opacity 0.5 (50% rule enforced
// programmatically). Header: fancyhdr with the banner on every page.
// Faculty table: static template data flushed to the bottom of the last page.
// Compile ONLY inside an isolated container (see lib/compile.js), never host pdflatex.

export function escapeLatex(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\textbackslash{}")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("$", "\\$")
    .replaceAll("&", "\\&")
    .replaceAll("%", "\\%")
    .replaceAll("#", "\\#")
    .replaceAll("_", "\\_")
    .replaceAll("^", "\\textasciicircum{}")
    .replaceAll("~", "\\textasciitilde{}");
}

function safeVerbatim(code) {
  return String(code ?? "").replaceAll("\\end{verbatim}", "END VERBATIM");
}

function facultyTable(t) {
  const ft = t.facultyTable;
  if (!ft?.columns?.length) return "";
  const n = ft.columns.length;
  const col = `p{${(0.9 / n).toFixed(3)}\\textwidth}`;
  const spec = `|${Array(n).fill(col).join("|")}|`;
  const head = `${ft.columns.map((c) => `\\textbf{${escapeLatex(c)}}`).join(" & ")} \\\\ \\hline`;
  const rows = (ft.rows ?? [])
    .map((r) => {
      const cells = ft.columns.map((_, i) => {
        const v = escapeLatex(r[i] ?? "");
        return v || "\\rule{0pt}{14mm}";
      });
      return `${cells.join(" & ")} \\\\ \\hline`;
    })
    .join("\n");
  return `\\vfill
\\begin{center}
{\\bfseries ${escapeLatex(ft.title ?? "For Faculty Use")}}\\\\[2mm]
{\\small\\begin{tabular}{${spec}}
\\hline
${head}
${rows}
\\end{tabular}}
\\end{center}`;
}

export function renderLatex(content, template) {
  const t = template?.template ?? {};
  const hasHeader = Boolean(t.header?.image);
  const hasWatermark = Boolean(t.watermark?.image);
  const footerText = escapeLatex(t.footer?.text ?? "");

  const steps = content.steps
    .map(
      (s) => `\\subsection*{Step ${s.number}: ${escapeLatex(s.title)}}
\\begin{itemize}
${s.description.map((d) => `  \\item ${escapeLatex(d)}`).join("\n")}
\\end{itemize}
${s.code ? `\\begin{verbatim}\n${safeVerbatim(s.code)}\n\\end{verbatim}` : ""}`,
    )
    .join("\n\n");

  return `\\documentclass[a4paper,12pt]{article}
\\usepackage[margin=25mm,top=32mm,bottom=25mm,headheight=28mm]{geometry}
\\usepackage{graphicx}
\\usepackage{fancyhdr}
\\usepackage{eso-pic}
\\usepackage{tikz}
\\usepackage{hyperref}
\\pagestyle{fancy}
\\fancyhf{}
${hasHeader ? `\\fancyhead[C]{\\includegraphics[height=22mm,keepaspectratio]{header.png}}` : "\\fancyhead[C]{\\textbf{Assignment}}"}
\\fancyfoot[C]{${footerText}${t.footer?.showPageNumber === false ? "" : " \\textbar\\ Page \\thepage"}}
\\AddToShipoutPictureBG{%
\\begin{tikzpicture}[remember picture,overlay]
\\draw[line width=1.2pt] ([xshift=10mm,yshift=-10mm]current page.north west) rectangle ([xshift=-10mm,yshift=10mm]current page.south east);
${hasWatermark ? `\\node[opacity=${WATERMARK_OPACITY}] at (current page.center) {\\includegraphics[width=0.55\\paperwidth,keepaspectratio]{watermark.png}};` : ""}
\\end{tikzpicture}%
}
\\begin{document}
\\begin{center}
{\\Large\\bfseries ${escapeLatex(content.title)}}
${content.experimentNumber ? `\\\\\\\\Experiment No. ${escapeLatex(content.experimentNumber)}` : ""}
\\end{center}

\\section*{Aim}
${escapeLatex(content.aim)}

\\section*{Objectives}
\\begin{itemize}
${content.objectives.map((o) => `  \\item ${escapeLatex(o)}`).join("\n")}
\\end{itemize}

\\section*{Theory}
${content.theory.map((p) => escapeLatex(p)).join("\n\n")}

\\section*{Procedure / Steps}
${steps}

\\section*{Conclusion}
${escapeLatex(content.conclusion)}

${facultyTable(t)}
\\end{document}
`;
}
