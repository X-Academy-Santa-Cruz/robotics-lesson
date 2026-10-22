const H = require("./wb_common.js");
const content = require("./wb_content.js")(H);
const {
  Packer, Paragraph, TextRun, TableOfContents, HeadingLevel,
  ImageRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle,
} = require("docx");
const { makeDoc, makeMultiSectionDoc, docCover, pageBreak, fs, NAVY, TEAL, GREY, ACCENT, imgSize } = H;

// ---- Full-page title cover ----
function coverPage() {
  const xa = fs.readFileSync("/home/claude/logo_xacademy.png");
  const coe = fs.readFileSync("/home/claude/logo_coe.png");
  const hero = fs.readFileSync("/home/claude/photo_IMG_6059.jpg");
  const h = imgSize(hero);
  const heroW = 300, heroH = Math.round(heroW * h.h / h.w);
  const noB = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } };

  // logos row
  const logos = new Table({
    columnWidths: [6360, 3000],
    width: { size: 9360, type: WidthType.DXA },
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 6360, type: WidthType.DXA }, borders: noB, verticalAlign: "center",
        children: [new Paragraph({ children: [new ImageRun({ type: "png", data: xa, transformation: { width: 250, height: 89 } })] })] }),
      new TableCell({ width: { size: 3000, type: WidthType.DXA }, borders: noB, verticalAlign: "center",
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ type: "png", data: coe, transformation: { width: 78, height: 78 } })] })] }),
    ] })],
  });

  return [
    logos,
    new Paragraph({ spacing: { before: 120, after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: TEAL, space: 4 } }, children: [] }),

    new Paragraph({ spacing: { before: 900, after: 0 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "UNDERWATER ROBOTICS", bold: true, color: TEAL, size: 32, allCaps: true, characterSpacing: 60 })] }),
    new Paragraph({ spacing: { before: 60, after: 40 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Builder's Workbook", bold: true, color: NAVY, size: 84 })] }),
    new Paragraph({ spacing: { before: 0, after: 40 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Design • Build • Program • Pilot", color: ACCENT, size: 28, bold: true })] }),
    new Paragraph({ spacing: { before: 40, after: 240 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "A self-guided course for new ROV student teams", italics: true, color: GREY, size: 26 })] }),

    new Paragraph({ spacing: { before: 120, after: 160 }, alignment: AlignmentType.CENTER, keepLines: true,
      children: [new ImageRun({ type: "jpg", data: hero, transformation: { width: heroW, height: heroH } })] }),

    new Paragraph({ spacing: { before: 120, after: 0 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Raspberry Pi 5  ·  three thrusters  ·  camera  ·  gripper  ·  Python", color: NAVY, size: 22, bold: true })] }),
    new Paragraph({ spacing: { before: 40, after: 0 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "X Academy  ·  Santa Cruz County Office of Education", color: GREY, size: 20 })] }),
  ];
}

const OUT = "/mnt/user-data/outputs";

// Reuse the same intro / MATE front-matter blocks as the split builder.
const split = fs.readFileSync("./build_split.js", "utf8");

const { h1, h2, h3, p, b, t, bullet, numbered, callout, twoColTable, spacer, LIGHT, AMBER } = H;

function introBlock() {
  return [
    h1("Welcome — Read This First"),
    p("Welcome to X Academy Underwater Robotics! This is a self-study guide for new members of the program. You will work through it largely on your own and with your team, with mentors available to help and to check your work at key points."),
    p("Over the next few weeks you will work in a small team of three or four students to build another ROV — a better one than the ROV from the first week — designed using first principles of physics and engineering. Your vehicle will have:"),
    bullet([b("Three thrusters "), t("(left, right, and vertical) for driving, turning, and changing depth.")]),
    bullet([b("A better design "), t("worked out from the physics and engineering ideas in this guide, not just trial and error.")]),
    bullet([b("Raspberry Pi control: "), t("a Raspberry Pi running Python software, driven by a joystick.")]),
    h3("On the controller board"),
    p("Your controller board (the plate that carries the electronics) will hold:"),
    bullet([b("Raspberry Pi 5 "), t("— the brain of the ROV.")]),
    bullet([b("USB web camera "), t("— streams live video to the surface.")]),
    bullet([b("Small gripper "), t("— to pick things up during missions.")]),
    bullet([b("I2C temperature sensor "), t("— measures water temperature.")]),
    h3("What your Python software will do"),
    numbered("Read the joystick and send PWM commands to the motor controllers to drive the three thrusters and the small gripper."),
    numbered("Stream live video from the camera to a web browser on the surface."),
    numbered("Read the temperature sensor and plot a graph of the temperature."),
    callout("The goal:", "By the end of this guide, your team will have designed, built, and programmed an ROV plus a camera, gripper and sensor — and be ready to pilot it, just like a real MATE competition vehicle.", LIGHT, TEAL),
  ];
}

function mateBlock() {
  return [
    h1("About the MATE ROV Competition"),
    p("The ROV you build in this program is modeled on the vehicles students build for the MATE ROV Competition. MATE stands for Marine Advanced Technology Education."),
    p("The MATE ROV Competition is an annual, international underwater robotics contest. Student teams design, build, and pilot remotely operated vehicles (ROVs) to complete real-world ocean missions — and then present their work to judges. It is run by the MATE program (part of the Marine Technology Society), and it has grown to hundreds of teams and thousands of students around the world since it began in 2001."),
    h3("How it works"),
    bullet([b("Teams act like companies. "), t("Each team works like a small start-up: you design and build a vehicle to meet a request for proposal (aka the competition manual), then show it off.")]),
    bullet([b("Missions in the water. "), t("Your ROV completes timed tasks in a pool or tank — for example driving a course, finding and identifying objects with the camera, or retrieving items with a gripper.")]),
    bullet([b("More than just the robot. "), t("Teams also give a technical presentation, write engineering documentation, and create a marketing display. Communication counts, not only the vehicle.")]),
    h3("Competition classes"),
    p("MATE has several classes, from beginner to advanced, so teams compete at a level that matches their experience:"),
    twoColTable([
      ["SCOUT", "Entry level — new teams, often elementary and middle school."],
      ["NAVIGATOR", "For teams with some robotics experience; a common starting class for high schools."],
      ["RANGER", "Intermediate — teams with a good grasp of robotic systems and electricity."],
      ["PIONEER / EXPLORER", "Advanced — experienced high school, community college, and university teams."],
    ], ["Class", "Who it's for"]),
    spacer(),
    callout("Why this matters for you:", "The skills in this guide — thruster design, buoyancy, power and electronics, Python control, and teamwork — are exactly what MATE teams use. Learn them here and you are ready to join a competition team.", LIGHT, TEAL),
    p("You can learn more at the MATE ROV Competition website: https://materovcompetition.org"),
  ];
}

// Order of the body sections (same keys as wb_content.js / build_split.js)
const sectionKeys = ["sec1","sec2","sec3","sec4","sec5","sec6","sec7","sec8","sec9","dashboard"];

const children = [];

// ---- Welcome / MATE front matter (the cover is a separate part, below) ----
children.push(
  ...introBlock(),
  pageBreak(),
  ...mateBlock(),
  pageBreak(),
);

// ---- Table of contents (static, always-visible list) ----
function tocRow(num, title) {
  return new Paragraph({
    spacing: { after: 80 },
    tabStops: [{ type: "left", position: 900 }],
    children: [
      new TextRun({ text: num ? num : "", bold: true, color: TEAL, size: 22 }),
      new TextRun({ text: "\t", size: 22 }),
      new TextRun({ text: title, color: "222222", size: 22 }),
    ],
  });
}
children.push(
  new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "Contents", bold: true, color: NAVY, size: 36 })] }),
  new Paragraph({ spacing: { after: 180 }, border: { bottom: { style: H.BorderStyle.SINGLE, size: 12, color: TEAL, space: 2 } }, children: [] }),
  tocRow("", "Welcome — Read This First"),
  tocRow("", "About the MATE ROV Competition"),
  tocRow("", "How to Use This Workbook"),
  new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: "SECTIONS", bold: true, color: GREY, size: 18, allCaps: true })] }),
  tocRow("1", "Build Your First ROV"),
  tocRow("2", "Mechanical Design"),
  tocRow("3", "Power & Electronics"),
  tocRow("4", "Raspberry Pi and Linux"),
  tocRow("5", "Networking"),
  tocRow("6", "Camera"),
  tocRow("7", "Thrusters"),
  tocRow("8", "Servo Gripper"),
  tocRow("9", "I2C Sensors"),
  tocRow("10", "ROV Dashboard"),
  new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: "APPENDIX", bold: true, color: GREY, size: 18, allCaps: true })] }),
  tocRow("", "Appendix — Quick Reference"),
  tocRow("", "Reference — Raspberry Pi Setup Tasks"),
  tocRow("", "Prompts — Building This Repo with Claude"),
  pageBreak(),
);

// ---- How to use (closes out the front matter) ----
children.push(...content.howto());

// The title cover is its own part with no footer / page number.
// Front matter is the next part; number it 0-1, 0-2, ... so every later part
// uses section-page numbering.
const parts = [
  { noFooter: true, children: coverPage() },
  { tag: "0", children },
];

// Each body section is its own part so its page numbers restart at 1 and
// carry the section tag in the footer (e.g. 7-1, 7-2 ...), like the split docs.
const sectionTags = { sec1:"1", sec2:"2", sec3:"3", sec4:"4", sec5:"5", sec6:"6", sec7:"7", sec8:"8", sec9:"9", dashboard:"10" };
for (const key of sectionKeys) {
  parts.push({ tag: sectionTags[key], children: content[key]() });
}

// Appendix, Reference and Prompts each restart too.
parts.push({ tag: "A", children: content.appendix() });
parts.push({ tag: "R", children: content.reference() });
parts.push({ tag: "P", children: content.prompts() });

const { execSync } = require("child_process");
const OUTFILE = `${OUT}/X_Academy_ROV_Workbook_Complete.docx`;
const TITLE = "X Academy Underwater Robotics — Complete Workbook";

async function build() {
  const doc = makeMultiSectionDoc(parts, { title: TITLE });
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTFILE, buf);
}

// Measure how many PHYSICAL pages each part occupies, in order, by walking the
// rendered PDF page by page and watching the footer tag change. The cover has
// no footer, so it's the run of leading pages before the first footer appears.
// Returns an array of physical page counts, one per part, in `parts` order.
function measurePartPages() {
  execSync(`cp ${OUTFILE} /tmp/_measure.docx && python3 /mnt/skills/public/docx/scripts/office/soffice.py --convert-to pdf --outdir /tmp /tmp/_measure.docx`, { stdio: "ignore" });
  const txt = execSync(`pdftotext -layout /tmp/_measure.pdf - 2>/dev/null`).toString();
  const pages = txt.split("\f");
  // prefix for each physical page: "" (cover, no footer) or the footer's section tag
  const prefixPerPage = pages.map((pg) => {
    const m = pg.trim().match(/Robotics\s+([0-9A-Za-z]+)-\d+\s*$/);
    return m ? m[1] : "__cover__";   // cover / any no-footer page
  });
  // The expected prefix order: parts[0] is the no-footer cover (__cover__),
  // the rest carry their section tag.
  const order = parts.map((p, i) => (i === 0 ? "__cover__" : (p.tag || "0")));
  // Count consecutive physical pages matching each prefix, in order.
  const counts = [];
  let pi = 0;
  for (const want of order) {
    let n = 0;
    while (pi < prefixPerPage.length && prefixPerPage[pi] === want) { n++; pi++; }
    counts.push(n);
  }
  return counts; // one physical-page count per part, in `parts` order
}

(async () => {
  await build();                       // pass 1: no padding
  let counts = measurePartPages();
  // Pad every part that occupies an ODD number of physical pages (the cover
  // included). Once each part has an even length, the running page total is
  // even after every part, so EVERY section begins on an odd physical page --
  // the front of a fresh sheet, ready for a divider when printed double-sided.
  let changed = false;
  parts.forEach((p, i) => {
    if (counts[i] % 2 !== 0) { p.pad = true; changed = true; }
  });
  if (changed) await build();          // pass 2: with padding
  // Compute each section's first physical page arithmetically from the pass-1
  // content counts plus the one filler page added to any padded part. (We don't
  // re-measure, because the filler pages have no footer and can't be attributed
  // back to a section by the tag-based measure.)
  let running = 0;
  const starts = parts.map((p, i) => {
    const start = running + 1;
    const padded = p.pad ? 1 : 0;
    running += counts[i] + padded;       // counts[i] = content pages (pass 1)
    const label = i === 0 ? "cover" : (p.tag || "0");
    return `${label}@${start}${start % 2 === 1 ? "" : "!EVEN"}`;
  });
  console.log("wrote X_Academy_ROV_Workbook_Complete.docx");
  console.log("section starts (phys page):", starts.join(" "));
})();
