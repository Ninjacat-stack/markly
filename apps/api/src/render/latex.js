import { WATERMARK_OPACITY } from "./html.js";

// LaTeX renderer (Phase 4). Same sections/order as the HTML renderer.
// Watermark: eso-pic background on EVERY page + \transparent{0.5} (50% rule
// enforced programmatically). Header: fancyhdr with the banner on every page.
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
\\usepackage{transparent}
\\usepackage{hyperref}
\\pagestyle{fancy}
\\fancyhf{}
${hasHeader ? `\\fancyhead[C]{\\includegraphics[height=22mm,keepaspectratio]{header.png}}` : "\\fancyhead[C]{\\textbf{Assignment}}"}
\\fancyfoot[C]{${footerText}${t.footer?.showPageNumber === false ? "" : " \\textbar\\ Page \\thepage"}}
${hasWatermark ? `\\AddToShipoutPictureBG{\\AtPageCenter{\\transparent{${WATERMARK_OPACITY}}\\includegraphics[width=0.6\\paperwidth,keepaspectratio]{watermark.png}}}` : ""}
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
\\end{document}
`;
}
