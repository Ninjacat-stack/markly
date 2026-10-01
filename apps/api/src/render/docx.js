import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  HorizontalPositionAlign,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
  VerticalPositionAlign,
  VerticalPositionRelativeFrom,
} from "docx";
import { readFileSync } from "node:fs";
import { resolveAsset } from "../lib/storage.js";

// DOCX renderer (Phase 4). Same sections/order as the HTML renderer.
// Header + footer are native Word constructs (repeat on every page automatically).
// Watermark is a floating behind-text image inside the header, so it repeats too.
//
// Opacity caveat: OOXML has no per-image opacity; Word renders the PNG as-is.
// The 50% rule is enforced by using artwork saved at 50% transparency
// (see apps/api/assets/README.md). HTML/LaTeX enforce 0.5 programmatically.

function assetBuffer(ref) {
  const full = resolveAsset(ref);
  return full ? readFileSync(full) : null;
}

const bullet = (text) => new Paragraph({ text, bullet: { level: 0 } });
const body = (text) => new Paragraph({ children: [new TextRun(text)] });
const h2 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2 });

export async function renderDocx(content, template) {
  const t = template?.template ?? {};
  const headerImg = assetBuffer(t.header?.image);
  const wmImg = assetBuffer(t.watermark?.image);
  const footerText = t.footer?.text ?? "";

  const headerChildren = [];
  if (headerImg) {
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: headerImg, transformation: { width: 520, height: 62 } })],
      }),
    );
  }
  if (wmImg) {
    headerChildren.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: wmImg,
            transformation: { width: 320, height: 320 },
            floating: {
              horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
              verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.CENTER },
              behindDocument: true,
              allowOverlap: true,
            },
          }),
        ],
      }),
    );
  }

  const children = [
    new Paragraph({
      text: content.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
  ];
  if (content.experimentNumber) {
    children.push(new Paragraph({ text: `Experiment No. ${content.experimentNumber}`, alignment: AlignmentType.CENTER }));
  }
  children.push(h2("Aim"), body(content.aim));
  children.push(h2("Objectives"));
  for (const o of content.objectives) children.push(bullet(o));
  children.push(h2("Theory"));
  for (const p of content.theory) children.push(body(p));
  children.push(h2("Procedure / Steps"));
  for (const s of content.steps) {
    children.push(new Paragraph({ text: `Step ${s.number}: ${s.title}`, heading: HeadingLevel.HEADING_3 }));
    for (const d of s.description) children.push(bullet(d));
    if (s.code) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: s.code, font: "Consolas", size: 20 })],
        }),
      );
    }
  }
  children.push(h2("Conclusion"), body(content.conclusion));

  const doc = new Document({
    sections: [
      {
        headers: { default: new Header({ children: headerChildren }) },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: footerText ? `${footerText}  |  Page ` : "Page ", size: 18 }), PageNumber.CURRENT],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
