const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, TableOfContents,
  PageBreak, AlignmentType, BorderStyle, LevelFormat, Table, TableRow,
  TableCell, WidthType, ShadingType, ImageRun, ExternalHyperlink,
  Header, Footer, PageNumber, TabStopType, TabStopPosition, PageOrientation,
} = require("docx");

// ---------- palette ----------
const NAVY = "1F3A5F";
const TEAL = "0E7C7B";
const ACCENT = "C0392B";
const AMBER = "B7791F";
const LIGHT = "EDF2F7";
const CODEBG = "F4F5F7";
const GREY = "555555";

// ---------- helpers ----------
const spacer = (h = 120) => new Paragraph({ spacing: { after: h }, children: [] });

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 140 },
    children: [new TextRun({ text, bold: true, color: NAVY, size: 34 })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 100 },
    children: [new TextRun({ text, bold: true, color: TEAL, size: 26 })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
    children: [new TextRun({ text, bold: true, color: NAVY, size: 22 })],
  });
}
function p(text, opts = {}) {
  const runs = Array.isArray(text) ? text : [new TextRun({ text, size: 22, color: "222222" })];
  return new Paragraph({ spacing: { after: 120, line: 276 }, children: runs, ...opts });
}
function bullet(text, level = 0) {
  const runs = Array.isArray(text) ? text : [new TextRun({ text, size: 22, color: "222222" })];
  return new Paragraph({ numbering: { reference: "bullets", level }, spacing: { after: 60 }, children: runs });
}
function numbered(text) {
  const runs = Array.isArray(text) ? text : [new TextRun({ text, size: 22, color: "222222" })];
  return { __step: true, runs };
}
function b(x) { return new TextRun({ text: x, bold: true, size: 22, color: "222222" }); }
function t(x) { return new TextRun({ text: x, size: 22, color: "222222" }); }
function mono(x) { return new TextRun({ text: x, font: "Consolas", size: 21, color: "1A1A1A" }); }

function code(lines) {
  const W = 9360;
  const rows = [new TableRow({
    children: [new TableCell({
      width: { size: W, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: CODEBG },
      margins: { top: 80, bottom: 80, left: 140, right: 120 },
      borders: {
        left: { style: BorderStyle.SINGLE, size: 18, color: TEAL },
        top: { style: BorderStyle.SINGLE, size: 4, color: "D9DEE3" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9DEE3" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "D9DEE3" },
      },
      children: lines.map((ln) =>
        new Paragraph({
          spacing: { after: 0, line: 240 },
          children: [new TextRun({ text: ln === "" ? " " : ln, font: "Consolas", size: 18, color: "1A1A1A" })],
        })
      ),
    })],
  })];
  return [
    new Table({ columnWidths: [W], width: { size: W, type: WidthType.DXA }, rows }),
    new Paragraph({ spacing: { after: 140 }, children: [] }),
  ];
}

function callout(title, body, fill = LIGHT, barColor = TEAL, linkUrl = null, linkText = null) {
  const kids = [
    new TextRun({ text: title + "  ", bold: true, color: barColor, size: 22 }),
    new TextRun({ text: body, size: 22, color: "222222" }),
  ];
  if (linkUrl) {
    kids.push(new TextRun({ text: "  ", size: 22 }));
    kids.push(new ExternalHyperlink({
      link: linkUrl,
      children: [new TextRun({ text: linkText || linkUrl, size: 22, color: "0E7C7B", underline: {} })],
    }));
  }
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill },
    spacing: { before: 120, after: 160 },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: barColor, space: 8 } },
    indent: { left: 120 },
    children: kids,
  });
}
function checkbox(text) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: "\u2610  ", size: 24, color: TEAL }),
      new TextRun({ text, size: 22, color: "222222" }),
    ],
  });
}
// section header banner
function sectionBanner(kicker, title) {
  return [
    new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text: kicker, bold: true, color: TEAL, size: 20, allCaps: true })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 60 },
      children: [new TextRun({ text: title, bold: true, color: NAVY, size: 36 })],
    }),
    new Paragraph({
      spacing: { after: 160 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 2 } },
      children: [],
    }),
  ];
}
// "at a glance" box for each section: time, needs, unlocks
function atAGlance(rows) {
  const W1 = 2200, W2 = 7160, TOTAL = W1 + W2;
  const trs = rows.map((r, i) =>
    new TableRow({ children: [
      new TableCell({ width: { size: W1, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: NAVY },
        margins: { top: 60, bottom: 60, left: 120, right: 100 },
        children: [new Paragraph({ children: [new TextRun({ text: r[0], bold: true, color: "FFFFFF", size: 19 })] })] }),
      new TableCell({ width: { size: W2, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: i % 2 ? "FFFFFF" : LIGHT },
        margins: { top: 60, bottom: 60, left: 120, right: 100 },
        children: [new Paragraph({ children: [new TextRun({ text: r[1], size: 19, color: "222222" })] })] }),
    ] })
  );
  return new Table({ columnWidths: [W1, W2], width: { size: TOTAL, type: WidthType.DXA }, rows: trs });
}
function twoColTable(rows, headers, w1 = 3000, w2 = 6360) {
  const total = w1 + w2;
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({ width: { size: w1, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: NAVY }, margins: { top: 50, bottom: 50, left: 110, right: 90 },
        children: [new Paragraph({ children: [new TextRun({ text: headers[0], bold: true, color: "FFFFFF", size: 20 })] })] }),
      new TableCell({ width: { size: w2, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: NAVY }, margins: { top: 50, bottom: 50, left: 110, right: 90 },
        children: [new Paragraph({ children: [new TextRun({ text: headers[1], bold: true, color: "FFFFFF", size: 20 })] })] }),
    ],
  });
  const bodyRows = rows.map((r, i) =>
    new TableRow({
      children: [
        new TableCell({ width: { size: w1, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: i % 2 ? "FFFFFF" : LIGHT }, margins: { top: 50, bottom: 50, left: 110, right: 90 },
          children: [new Paragraph({ children: [new TextRun({ text: r[0], bold: true, size: 20, color: NAVY })] })] }),
        new TableCell({ width: { size: w2, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: i % 2 ? "FFFFFF" : LIGHT }, margins: { top: 50, bottom: 50, left: 110, right: 90 },
          children: [new Paragraph({ children: [new TextRun({ text: r[1], size: 20, color: "222222" })] })] }),
      ],
    })
  );
  return new Table({ columnWidths: [w1, w2], width: { size: total, type: WidthType.DXA }, rows: [headerRow, ...bodyRows] });
}
function threeColTable(rows, headers, w1 = 2600, w2 = 3380, w3 = 3380) {
  const total = w1 + w2 + w3;
  const mk = (txt, fill, bold, color, size = 19) => new TableCell({ width: { size: fill.w, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: fill.c }, margins: { top: 50, bottom: 50, left: 110, right: 90 },
    children: [new Paragraph({ children: [new TextRun({ text: txt, bold, color, size })] })] });
  const header = new TableRow({ tableHeader: true, children: [
    mk(headers[0], { w: w1, c: NAVY }, true, "FFFFFF", 20),
    mk(headers[1], { w: w2, c: NAVY }, true, "FFFFFF", 20),
    mk(headers[2], { w: w3, c: NAVY }, true, "FFFFFF", 20),
  ] });
  const body = rows.map((r, i) => {
    const f = i % 2 ? "FFFFFF" : LIGHT;
    return new TableRow({ children: [
      mk(r[0], { w: w1, c: f }, true, NAVY),
      mk(r[1], { w: w2, c: f }, false, "222222"),
      mk(r[2], { w: w3, c: f }, false, "222222"),
    ] });
  });
  return new Table({ columnWidths: [w1, w2, w3], width: { size: total, type: WidthType.DXA }, rows: [header, ...body] });
}
// the populated buoyancy table (PVC part specs) with blank fill-in columns; sized for a landscape page
function buoyancyTable() {
  // [part, weight gf, volume/displaced-water gf, net buoyancy gf]
  const parts = [
    ["1/2\" PVC 45 Degree Elbow", "18.4", "14.1", "-4.3"],
    ["1/2\" PVC 90 Degree Elbow", "21.2", "19.5", "-1.7"],
    ["1/2\" PVC Corner", "27.1", "23.1", "-4.0"],
    ["1/2\" PVC Coupler", "15.2", "8.9", "-6.3"],
    ["1/2\" PVC Cross", "33.5", "28.6", "-4.9"],
    ["1/2\" PVC End Cap", "10.8", "7.1", "-3.6"],
    ["1/2\" PVC Tee", "31.9", "21.2", "-10.7"],
    ["1/2\" PVC Pipe (1 cm)", "2.4", "1.6", "-0.3"],
    ["1/2\" PVC Pipe (5 cm)", "11.9", "8.1", "-1.5"],
    ["1/2\" PVC Pipe (10 cm)", "23.8", "16.2", "-3.0"],
    ["1/2\" PVC Pipe (20 cm)", "47.6", "32.3", "-6.0"],
    ["Foam (1 cm)", "0.2", "17.4", "17.2"],
    ["Foam (10 cm)", "2.3", "174.2", "171.9"],
    ["1/2\" Rebar (10 cm)", "98.0", "10.9", "-87.1"],
    ["One Bilge Pump Motor", "267.5", "205.2", "-62.3"],
  ];
  // landscape content width ~13680 dxa (11" - 2" margins). 7 columns.
  const widths = [3100, 1550, 1900, 1700, 1850, 1850, 1730];
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (lines, w, opts = {}) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: opts.fill || "FFFFFF" },
    margins: { top: 40, bottom: 40, left: 80, right: 60 },
    children: (Array.isArray(lines) ? lines : [lines]).map((line) =>
      new Paragraph({ alignment: opts.align || AlignmentType.LEFT, spacing: { after: 0 },
        children: [new TextRun({ text: line, bold: !!opts.bold, color: opts.color || "222222", size: opts.size || 16 })] })),
  });
  const headers = [
    ["Part"],
    ["Weight", "of part (gf)"],
    ["Volume of displaced", "water (cm\u00B3 = gf)"],
    ["Quantity"],
    ["Extended weight (gf)", "(Qty \u00D7 weight)"],
    ["Extended volume (gf)", "(Qty \u00D7 volume)"],
    ["Net buoyancy (gf)", "(volume \u2212 weight)"],
  ];
  const headerRow = new TableRow({ tableHeader: true, children: headers.map((h, i) =>
    cell(h, widths[i], { fill: NAVY, bold: true, color: "FFFFFF", size: 15, align: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER })) });
  const bodyRows = parts.map((r, idx) => {
    const fill = idx % 2 ? "FFFFFF" : LIGHT;
    return new TableRow({ children: [
      cell(r[0], widths[0], { fill, bold: true, color: NAVY }),
      cell(r[1], widths[1], { fill, align: AlignmentType.CENTER }),
      cell(r[2], widths[2], { fill, align: AlignmentType.CENTER }),
      cell("", widths[3], { fill, align: AlignmentType.CENTER }),        // Quantity: blank to fill in
      cell("", widths[4], { fill, align: AlignmentType.CENTER }),        // Extended weight: blank
      cell("", widths[5], { fill, align: AlignmentType.CENTER }),        // Extended volume: blank
      cell("", widths[6], { fill, align: AlignmentType.CENTER }),        // Net buoyancy: blank (students compute)
    ] });
  });
  const totalRow = new TableRow({ children: [
    cell("TOTAL", widths[0], { fill: "E6EDE6", bold: true, color: NAVY }),
    cell("", widths[1], { fill: "E6EDE6" }),
    cell("", widths[2], { fill: "E6EDE6" }),
    cell("", widths[3], { fill: "E6EDE6" }),
    cell(["Total Weight", "\u2193"], widths[4], { fill: "E6EDE6", bold: true, color: NAVY, size: 14, align: AlignmentType.CENTER }),
    cell(["Total Volume", "\u2193"], widths[5], { fill: "E6EDE6", bold: true, color: NAVY, size: 14, align: AlignmentType.CENTER }),
    cell(["Net Buoyancy", "\u2193"], widths[6], { fill: "E6EDE6", bold: true, color: NAVY, size: 14, align: AlignmentType.CENTER }),
  ] });
  return new Table({ columnWidths: widths, width: { size: total, type: WidthType.DXA }, rows: [headerRow, ...bodyRows, totalRow] });
}
function landscapeBlock(children) { return { __landscape: children }; }
function pageBreak() { return new Paragraph({ children: [new PageBreak()] }); }
function writeLines(label, n = 3) {
  const out = [new Paragraph({ spacing: { before: 100, after: 120 }, children: [new TextRun({ text: label, italics: true, color: GREY, size: 20 })] })];
  for (let i = 0; i < n; i++) {
    out.push(new Paragraph({ spacing: { after: 260 }, border: { bottom: { style: BorderStyle.DASHED, size: 6, color: "AAAAAA" } }, children: [] }));
  }
  return out;
}

// read intrinsic pixel size of a PNG or JPEG buffer
function imgSize(buf) {
  // PNG: 8-byte sig, IHDR width/height at offsets 16/20
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: "png" };
  }
  // JPEG: scan for SOF marker
  let o = 2;
  while (o < buf.length) {
    if (buf[o] !== 0xFF) { o++; continue; }
    const marker = buf[o + 1];
    if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) ||
        (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
      const h = buf.readUInt16BE(o + 5), w = buf.readUInt16BE(o + 7);
      return { w, h, type: "jpg" };
    }
    const len = buf.readUInt16BE(o + 2);
    o += 2 + len;
  }
  return { w: 1000, h: 1000, type: "jpg" };
}
// embed a PNG/JPEG figure scaled to a target width, centered, with a caption; kept together
function figure(path, label, targetW = 456) {
  const buf = fs.readFileSync(path);
  const { w, h, type } = imgSize(buf);
  const dispW = targetW, dispH = Math.round(targetW * h / w);
  const out = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 180, after: 40 },
      keepNext: true,
      keepLines: true,
      children: [new ImageRun({ type, data: buf, transformation: { width: dispW, height: dispH } })],
    }),
  ];
  if (label) {
    out.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      keepLines: true,
      children: [
        new TextRun({ text: "Figure. ", bold: true, italics: true, size: 18, color: TEAL }),
        new TextRun({ text: label, italics: true, size: 18, color: GREY }),
      ],
    }));
  }
  return out;
}


// ---------- branding header: X Academy + Santa Cruz COE logos side by side ----------
function brandHeader() {
  const xa = fs.readFileSync("/home/claude/logo_xacademy.png");
  const coe = fs.readFileSync("/home/claude/logo_coe.png");
  const W1 = 9360;
  const row = new Table({
    columnWidths: [6000, 3360],
    width: { size: W1, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 6000, type: WidthType.DXA }, borders: noCellBorders(), verticalAlign: "center",
        children: [new Paragraph({ children: [new ImageRun({ type: "png", data: xa, transformation: { width: 208, height: 75 } })] })] }),
      new TableCell({ width: { size: 3360, type: WidthType.DXA }, borders: noCellBorders(), verticalAlign: "center",
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ type: "png", data: coe, transformation: { width: 60, height: 60 } })] })] }),
    ] })],
  });
  return [
    row,
    new Paragraph({ spacing: { before: 80, after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 2 } }, children: [] }),
  ];
}
function noCellBorders() {
  return { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } };
}


// ---------- assembly: flatten step/checkbox descriptors into paragraphs ----------
function assemble(children) {
  const flat = children.flat();
  let group = -1, prevStep = false;
  const out = [];
  for (let i = 0; i < flat.length; i++) {
    const item = flat[i];
    if (item && item.__step) {
      if (!prevStep) group++;
      prevStep = true;
      out.push(new Paragraph({ numbering: { reference: "steps" + (group % 60), level: 0 }, spacing: { after: 60 }, keepLines: true, children: item.runs }));
    } else if (item && item.__check) {
      prevStep = false;
      const next = flat[i + 1];
      const keepNext = !!(next && next.__check);
      out.push(new Paragraph({
        spacing: { after: 60 }, keepNext, keepLines: true,
        children: [ new TextRun({ text: "\u2610  ", size: 24, color: TEAL }), new TextRun({ text: item.text, size: 22, color: "222222" }) ],
      }));
    } else if (item && item.__landscape) {
      prevStep = false;
      out.push({ __landscape: assemble(item.__landscape) });  // assemble inner, keep marker
    } else {
      prevStep = false;
      out.push(item);
    }
  }
  return out;
}

// split an assembled child stream into section segments on __landscape markers
function splitSections(items) {
  const segs = [];
  let cur = { orient: "portrait", children: [] };
  for (const it of items) {
    if (it && it.__landscape) {
      if (cur.children.length) segs.push(cur);
      segs.push({ orient: "landscape", children: it.__landscape });
      cur = { orient: "portrait", children: [] };
    } else {
      cur.children.push(it);
    }
  }
  if (cur.children.length) segs.push(cur);
  return segs;
}

// ---------- numbering config shared by every doc ----------
function numberingConfig() {
  return {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { run: { color: TEAL }, paragraph: { indent: { left: 460, hanging: 260 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "\u2013", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 900, hanging: 260 } } } },
      ] },
      ...Array.from({ length: 60 }, (_, k) => ({
        reference: "steps" + k,
        levels: [ { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { run: { bold: true, color: NAVY }, paragraph: { indent: { left: 460, hanging: 300 } } } } ],
      })),
    ],
  };
}

// ---------- document factory ----------
// opts: { title, description, sectionTag }  (sectionTag -> "1", "2", "FM", etc.)
function makeDoc(children, opts = {}) {
  const tag = opts.sectionTag || "";
  const footer = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 60 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 6 } },
      children: [
        new TextRun({ text: "X Academy Underwater Robotics", color: "999999", size: 16 }),
        new TextRun({ text: "          ", size: 16 }),
        new TextRun({ text: (tag ? tag + "-" : ""), color: NAVY, size: 18, bold: true }),
        new TextRun({ children: [PageNumber.CURRENT], color: NAVY, size: 18, bold: true }),
      ],
    })],
  });
  const assembled = assemble(children);
  const segs = splitSections(assembled);
  const portraitPage = { size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT }, margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } };
  // docx-js swaps width/height when orientation is LANDSCAPE, so pass portrait-order dims here
  const landscapePage = { size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } };
  const sections = segs.map((s) => ({
    properties: { page: s.orient === "landscape" ? landscapePage : portraitPage },
    footers: { default: footer },
    children: s.children,
  }));
  const docOpts = {
    creator: "X Academy Underwater Robotics",
    title: opts.title || "X Academy Underwater Robotics",
    description: opts.description || "Section-based workbook for new ROV student teams",
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    numbering: numberingConfig(),
    sections: sections.length ? sections : [{ properties: { page: portraitPage }, footers: { default: footer }, children: assembled }],
  };
  if (opts.updateFields) docOpts.features = { updateFields: true };
  return new Document(docOpts);
}

// build a footer carrying a given section tag ("1", "FM", "R", or "")
function footerForTag(tag) {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 60 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 6 } },
      children: [
        new TextRun({ text: "X Academy Underwater Robotics", color: "999999", size: 16 }),
        new TextRun({ text: "          ", size: 16 }),
        new TextRun({ text: (tag ? tag + "-" : ""), color: NAVY, size: 18, bold: true }),
        new TextRun({ children: [PageNumber.CURRENT], color: NAVY, size: 18, bold: true }),
      ],
    })],
  });
}

// ---------- multi-part document: page numbers restart (and carry a tag) per part ----------
// parts: [{ tag, children }]. Each part becomes one or more Word sections (split on
// landscape markers); the FIRST Word section of each part restarts page numbering at 1.
function makeMultiSectionDoc(parts, opts = {}) {
  const portraitPage = { size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT }, margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } };
  const landscapePage = { size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } };
  const emptyFooter = new Footer({ children: [new Paragraph({ children: [] })] });
  const sections = [];
  for (const part of parts) {
    // A part can opt out of the footer entirely (e.g. the title cover).
    const footer = part.noFooter ? emptyFooter : footerForTag(part.tag || "");
    const segs = splitSections(assemble(part.children));
    segs.forEach((s, i) => {
      const basePage = s.orient === "landscape" ? landscapePage : portraitPage;
      // Restart numbering on the first Word section of each part.
      const page = i === 0 ? { ...basePage, pageNumbers: { start: 1 } } : basePage;
      sections.push({ properties: { page }, footers: { default: footer }, children: s.children });
    });
    // If this part has an odd page count, add ONE blank filler page so the part
    // ends on an even page (room for a printed divider). The filler is its own
    // Word section with NO footer, so the blank page carries no page number.
    if (part.pad) {
      sections.push({
        properties: { page: portraitPage },
        footers: { default: emptyFooter },
        children: [new Paragraph({ children: [new TextRun({ text: " ", color: "FFFFFF", size: 2 })] })],
      });
    }
  }
  const docOpts = {
    creator: "X Academy Underwater Robotics",
    title: opts.title || "X Academy Underwater Robotics",
    description: opts.description || "Section-based workbook for new ROV student teams",
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    numbering: numberingConfig(),
    sections,
  };
  return new Document(docOpts);
}

// a compact per-document title block (used at the top of each split doc)
function docCover(kicker, title, subtitle, reviewTag) {
  const out = [
    ...brandHeader(),
    new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: "X ACADEMY UNDERWATER ROBOTICS", bold: true, color: TEAL, size: 20, allCaps: true })] }),
    new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: kicker, bold: true, color: TEAL, size: 18, allCaps: true })] }),
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: title, bold: true, color: NAVY, size: 40 })] }),
  ];
  if (subtitle) out.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: subtitle, italics: true, color: GREY, size: 22 })] }));
  if (reviewTag) {
    out.push(new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: "FFF3CD" },
      spacing: { before: 80, after: 80 }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: AMBER, space: 8 } }, indent: { left: 120 },
      children: [ new TextRun({ text: "FOR MENTOR REVIEW  ", bold: true, color: AMBER, size: 20 }), new TextRun({ text: reviewTag, size: 20, color: "222222" }) ],
    }));
  }
  out.push(new Paragraph({ spacing: { after: 140 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 2 } }, children: [] }));
  return out;
}

module.exports = {
  fs, NAVY, TEAL, ACCENT, AMBER, LIGHT, CODEBG, GREY,
  spacer, h1, h2, h3, p, bullet, numbered, b, t, mono, code, callout, checkbox,
  sectionBanner, atAGlance, twoColTable, threeColTable, buoyancyTable, landscapeBlock, pageBreak, writeLines, imgSize, figure,
  assemble, numberingConfig, makeDoc, makeMultiSectionDoc, docCover, brandHeader,
  Paragraph, TextRun, ShadingType, BorderStyle,
};
