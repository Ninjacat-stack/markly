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
  return String(code ?? "").replaceAll("\\end{lstlisting}", "END LISTING");
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
{\\bfseries ${escapeLatex(ft.title ?? "For Faculty Use")}}\\\\[2mm]
\\begin{center}
{\\small\\begin{tabular}{${spec}}
\\hline
${head}
${rows}
\\end{tabular}}
\\end{center}`;
}

export function renderLatex(content, template, options = {}) {
  const t = template?.template ?? {};
  const includeVivaTitle = options.includeVivaTitle === true;
  const typedConclusion = options.typedConclusion !== false;
  const conclusionTex = typedConclusion ? escapeLatex(content.conclusion) : "\\vspace{45mm}";
  // Viva Questions is a HEADING ONLY when enabled — questions are handwritten by faculty, never generated.
  const vivaTex = includeVivaTitle ? "\\section*{Viva Questions}\n\\vspace{45mm}" : "";
  const hasHeader = Boolean(t.header?.image);
  const hasWatermark = Boolean(t.watermark?.image);

  const steps = content.steps
    .map(
      (s) => `\\subsection*{Step ${s.number}: ${escapeLatex(s.title)}}
\\begin{itemize}
${s.description.map((d) => `  \\item ${escapeLatex(d)}`).join("\n")}
\\end{itemize}
${s.code ? `\\begin{lstlisting}\n${safeVerbatim(s.code)}\n\\end{lstlisting}` : ""}`,
    )
    .join("\n\n");

  return `\\documentclass[a4paper,12pt]{article}
\\usepackage[margin=25mm,top=32mm,bottom=30mm,headheight=28mm]{geometry}
\\usepackage{graphicx}
\\usepackage{fancyhdr}
\\usepackage{eso-pic}
\\usepackage{tikz}
\\usepackage{listings}
\\lstset{basicstyle=\\ttfamily\\small,breaklines=true,breakatwhitespace=true,columns=fullflexible,keepspaces=true}
\\usepackage{hyperref}
\\pagestyle{fancy}
\\fancyhf{}
${hasHeader ? `\\fancyhead[C]{\\includegraphics[width=\\textwidth,keepaspectratio]{header.png}}` : "\\fancyhead[C]{\\textbf{Assignment}}"}
\\fancyfoot[C]{\\thepage}
\\AddToShipoutPictureBG{%
\\begin{tikzpicture}[remember picture,overlay]
\\draw[line width=1.2pt] ([xshift=10mm,yshift=-10mm]current page.north west) rectangle ([xshift=-10mm,yshift=10mm]current page.south east);
${hasWatermark ? `\\node[opacity=${WATERMARK_OPACITY}] at (current page.center) {\\includegraphics[width=0.55\\paperwidth,keepaspectratio]{watermark.png}};` : ""}
\\end{tikzpicture}%
}
\\begin{document}
\\begin{center}
{\\Large\\bfseries ${escapeLatex(content.title)}}
${content.experimentNumber ? `\n{\\large Experiment No. ${escapeLatex(content.experimentNumber)}}` : ""}
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
${conclusionTex}

${vivaTex}

${facultyTable(t)}
\\end{document}
`;
}
