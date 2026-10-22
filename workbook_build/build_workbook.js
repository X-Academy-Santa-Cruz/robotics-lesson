const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, TableOfContents,
  PageBreak, AlignmentType, BorderStyle, LevelFormat, Table, TableRow,
  TableCell, WidthType, ShadingType,
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

const children = [];

// ============================================================ COVER
children.push(
  new Paragraph({ spacing: { before: 1300 }, children: [] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
    children: [new TextRun({ text: "MATE UNDERWATER ROBOTICS", bold: true, color: TEAL, size: 28, allCaps: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
    children: [new TextRun({ text: "ROV Builder's Workbook", bold: true, color: NAVY, size: 60 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: "A hands-on, self-guided course for new student teams", italics: true, color: GREY, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360, after: 40 },
    children: [new TextRun({ text: "Design \u2022 Power \u2022 Program \u2022 Pilot", color: ACCENT, size: 24, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1100, after: 40 },
    children: [new TextRun({ text: "Student Workbook \u2014 Draft Edition", color: GREY, size: 20 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Team: ______________________    Members: ______________________________________", color: GREY, size: 18 })] }),
  pageBreak(),
);

// ============================================================ TOC
children.push(
  h1("Contents"),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  pageBreak(),
);

// ============================================================ HOW TO USE
children.push(
  h1("How to Use This Workbook"),
  p("This workbook is built from independent sections, not a fixed week-by-week schedule. Each section stands on its own: it opens with an at-a-glance box (how long it usually takes, what you need first, and what it unlocks), teaches the ideas from the ground up, walks you through hands-on tasks with full instructions, and ends with a checklist you can use to prove you are done."),
  p("Because the sections are self-contained, your team can move through them at your own pace and, in many cases, in your own order. Some sections take a single session; others are worth two. A whole team rarely needs to do every section together at the same moment \u2014 while two teammates work through the electronics section, a third can be reading ahead in software."),

  h2("The sections"),
  twoColTable([
    ["1. Build Your First ROV", "A fast, guided first build so you have a working vehicle and real questions before the theory. The best on-ramp."],
    ["2. Mechanical Design", "Systems of an ROV, thruster placement, and making the vehicle balanced and positively buoyant (COG, COB, ballast, float)."],
    ["3. Power & Electronics", "Batteries, the tether, Ohm's law and power budgeting, and how PWM, ESCs, and motor controllers drive your thrusters."],
    ["4. Raspberry Pi and Linux", "Set up the Pi (Ubuntu, login, terminal, the setup script), then Linux, Git, Python, an IDE, and using AI assistants to write and fix code."],
    ["5. Networking", "IP addresses, SSH, and troubleshooting with ping and Wireshark \u2014 how you reach the Pi and how video gets to the surface."],
    ["6. Camera", "Stream the USB camera to a web browser on the surface \u2014 the first program you write, so you can see what the ROV sees."],
    ["7. Thrusters", "Joystick control of the three thrusters via the Servo pHAT. Run it with the camera and you have a vehicle you can pilot."],
    ["8. Servo Gripper", "Drive a servo from a joystick button to open and close a gripper claw."],
    ["9. I2C Sensors", "Read a sensor over the I2C bus \u2014 depth, temperature, or orientation."],
    ["10. ROV Dashboard", "Tie it together: one web page with live video, thruster telemetry, a heading dial, and status."],
    ["Reference", "Occasional Raspberry Pi setup tasks: hostname, time, static IP, and Wi-Fi hotspot."],
    ["Prompts", "Clean Claude prompts to recreate each program in this repository from scratch."],
  ], ["Section", "What it covers"]),
  spacer(),

  h2("Suggested paths"),
  p("There is no single right order, but these paths work well:"),
  bullet([b("Straight through (recommended for first-timers): "), t("Sections 1 \u2192 2 \u2192 3 \u2192 4 \u2192 5 \u2192 6 \u2192 7, then the gripper, sensor, and dashboard sections.")]),
  bullet([b("Build-focused start: "), t("Do Section 1, then split \u2014 some teammates take Mechanical Design (2) and Power (3) while others start Raspberry Pi and Linux (4) and Networking (5). Reconnect for the Camera (6) and Thrusters (7).")]),
  bullet([b("Software-focused start: "), t("If a teammate is eager to code, Sections 4 and 5 can be done early on any Raspberry Pi, before the ROV is finished.")]),

  h2("What the boxes mean"),
  callout("Blue box:", "Key idea, tip, or helpful context.", LIGHT, TEAL),
  callout("Red box:", "Safety or a mistake that will cost you time \u2014 read these carefully.", LIGHT, ACCENT),
  callout("Amber box:", "An add-on that extends the core three-thruster ROV, such as the gripper or a sensor.", LIGHT, AMBER),

  h2("What you will build with"),
  twoColTable([
    ["Frame", "PVC pipe cut and fitted into a frame you design"],
    ["Thrusters", "Three bilge-pump motors with propellers (left, right, vertical)"],
    ["Electronics", "goBILDA motor controllers and batteries"],
    ["Flight Computer", "Raspberry Pi running Linux and Python"],
    ["Control", "Logitech joystick plugged into the Pi"],
    ["Vision", "Logitech C270 720p webcam on the controller board, streamed over Ethernet"],
    ["Tether", "Six-conductor cable carrying power to the three motors, plus Ethernet for video"],
  ], ["System", "What it is"]),
  spacer(),

  h2("Safety first \u2014 read before every session"),
  bullet("Water and electricity are a dangerous mix. Never power the ROV outside the tank unless an instructor says so, and never touch mains power near water."),
  bullet("Resin 3D printing uses chemicals that irritate skin and eyes. Wear gloves and eye protection, and only handle uncured resin under instructor supervision."),
  bullet("PVC cutting tools are sharp. Cut away from your hands and keep fingers clear of blades."),
  bullet("Batteries can deliver a lot of current. Never short the terminals, watch for hot wires, and disconnect power before changing wiring."),
  bullet("Tell an instructor immediately if anything smells hot, smokes, or leaks."),
  pageBreak(),
);

// ============================================================ SECTION 1 — BUILD
children.push(
  ...sectionBanner("Section 1", "Build Your First ROV"),
  atAGlance([
    ["Time", "About one session (one week)"],
    ["You need", "PVC, three bilge-pump thrusters, a battery, a motor controller, basic tools. No coding required."],
    ["Unlocks", "A working vehicle and hands-on questions that make every other section click."],
  ]),
  spacer(),
  callout("Goal:", "As a team, build a simple working ROV using the summer-camp \u201CBuild an ROV\u201D task. Get something in the water, see it move, and start asking questions.", LIGHT, TEAL),

  h2("Why start here"),
  p("The fastest way to understand an ROV is to build one. This section follows the same hands-on challenge used in the robotics summer camp. Do not worry about making it perfect \u2014 the goal is a vehicle that moves, so you feel the problems (it tips, it drifts, it sinks) before the later sections explain how to fix them."),

  h2("Step-by-step"),
  numbered("Cut and assemble a basic PVC frame as a team. Keep it simple and symmetric \u2014 a rectangular box or an H-shape is plenty."),
  numbered("Mount the three bilge-pump thrusters: one on each side pointing backward, and one pointing up/down."),
  numbered("Wire each motor through the tether to the motor controller and battery, following the camp instructions. Keep track of which wire pair goes to which motor."),
  numbered("Test each thruster one at a time out of the water. Confirm the direction each propeller pushes water."),
  numbered("Do a first water test. Watch how the ROV sits and moves."),
  ...figure("/home/claude/photo_IMG_6063.jpg", "The goBILDA Element 6 radio transmitter used to drive the ROV in this first build. (Later sections replace it with a joystick plugged into the Raspberry Pi.)", 340),

  h2("Observe and record"),
  p("During your water test, answer these \u2014 you will use them in Section 2:"),
  ...writeLines("Does the ROV float, sink, or hover? Does it tip or nose-dive? When you drive forward, does it also turn or roll? Which thruster does what?", 4),

  h3("Section 1 checklist"),
  checkbox("PVC frame assembled and symmetric"),
  checkbox("Three thrusters mounted"),
  checkbox("Motors wired through the tether and controller"),
  checkbox("Each thruster tested individually and its direction recorded"),
  checkbox("First water test completed and observations written down"),
  checkbox("Team roles rotated so everyone built and wired"),
  pageBreak(),
);

// ============================================================ SECTION 2 — MECHANICAL DESIGN (merged old W2+W3)
children.push(
  ...sectionBanner("Section 2", "Mechanical Design"),
  atAGlance([
    ["Time", "One to two sessions (one to two weeks)"],
    ["You need", "Nothing. Building a new ROV from scratch. No coding required."],
    ["Results", "A stable, well-balanced ROV that drives predictably \u2014 the foundation everything else sits on."],
  ]),
  spacer(),
  callout("Goal:", "Understand the systems every ROV needs, place your three thrusters so the vehicle drives predictably and under control, and make the ROV balanced and slightly positively buoyant.", LIGHT, TEAL),

  h2("This week's work"),
  p("This week you will design and build a neutrally buoyant ROV using a buoyancy table. A buoyancy table helps you determine the buoyancy of your ROV, and how much floatation (foam) and ballast (rebar) to add to make it neutrally buoyant."),
  h3("Tasks"),
  numbered("Design and build a new ROV that can pick up dive rings using the PVC parts. Do not put on floatation just yet."),
  numbered("Fill out the buoyancy table using the instructions below."),
  numbered("Weigh your ROV on the scale and compare it to the weight you calculated in the buoyancy table."),
  numbered("Add floatation (foam) to the top of the ROV and ballast (rebar) to the bottom to make the ROV neutrally buoyant."),
  numbered("Have a mentor do a safety inspection of your ROV and show them your buoyancy table. The mentor will hand you a blue safety card when your ROV passes the safety inspection."),
  callout("PVC part specs:", "The weight and volume of every PVC part are listed in the team's parts spreadsheet. Use those numbers when you fill out the buoyancy table.", LIGHT, TEAL),

  h2("The basic systems of an ROV"),
  p("Every ROV, from a school project to a deep-sea research vehicle, is built from the same handful of systems. Knowing them gives you a mental map of your own robot."),
  twoColTable([
    ["Frame", "The structure everything mounts to. Yours is PVC. It sets the shape, holds the thrusters, and gives you places to attach floats and ballast."],
    ["Propulsion", "The thrusters that move the vehicle. You have three: two horizontal, one vertical."],
    ["Power", "Batteries and the wiring that carries current to the motors (covered in Section 3)."],
    ["Control", "The Raspberry Pi reads your joystick and tells the motor controllers what to do (Sections 4\u20136). For this section, you will continue to use the RC plane transmitter and receiver to control the ROV."],
    ["Tether", "The cable linking the ROV to the surface (Section 3). For the competition ROV, there will be a network cable to transmit data between the topside control station (TCS) and the computer(s) on the ROV. For this project, the tether will only have power for the thrusters."],
    ["Payload", "The useful gear you carry \u2014 the camera, and optionally a gripper or sensors."],
  ], ["System", "What it does on your ROV"]),
  spacer(),

  h2("Placing the thrusters"),
  p("A thruster pushes water in a line, and the vehicle moves the opposite way. Where you put each thruster \u2014 and which way it points \u2014 decides how your ROV moves."),
  h3("A three-thruster layout"),
  bullet([b("Left and right horizontal thrusters: "), t("on each side, pointing backward. Run both together to go forward or backward. Run them at different speeds, or in opposite directions, to turn.")]),
  bullet([b("Vertical thruster: "), t("mounted to push water up or down so the ROV dives or rises.")]),
  callout("Design rule:", "Keep the layout symmetric. If the left and right thrusters are not mirror images \u2014 same height, same distance from the centerline, same angle \u2014 the ROV will pull to one side no matter how carefully you drive.", LIGHT, ACCENT),
  h3("Placement tips"),
  bullet("Mount horizontal thrusters level and parallel so \u201Cforward\u201D is actually straight."),
  bullet("Keep the vertical thruster near the center so it lifts evenly instead of tipping the ROV."),
  bullet("Keep propellers clear of the frame, the tether, and each other so water flows freely."),
  bullet("Aim thrust lines through or near the vehicle's center so thrust does not spin the ROV unexpectedly."),

  h2("Buoyancy \u2014 and why it is important to be positively buoyant"),
  p("Buoyancy is the upward push water gives to anything placed in it. It is what makes a boat float and what will make your ROV float, sink, or hover."),
  h3("Why things float: Archimedes' principle"),
  p("More than two thousand years ago, the Greek mathematician Archimedes worked out the rule that still explains floating (buoyancy) today. Archimedes' principle says: any object placed in a fluid is pushed up by a force equal to the weight of the fluid it pushes out of the way (the fluid it \u201Cdisplaces\u201D)."),
  p("Think about lowering your ROV into the water. As it goes in, it shoves water aside to make room for itself. The water pushes back, and that push \u2014 the buoyant force \u2014 is exactly equal to the weight of the water that was shoved aside. Two forces are now at work on your ROV:"),
  bullet([b("Weight "), t("pulls it down \u2014 the force of gravity on everything the ROV is made of.")]),
  bullet([b("Buoyant force "), t("pushes it up \u2014 equal to the weight of the water the ROV displaces.")]),
  p("Which force wins decides what happens. This is why a heavy steel ship can still float: its hull displaces a huge volume of water, so the buoyant force is larger than the ship's weight. Shape a material so it pushes aside more than its own weight in water, and it floats; pack it tight so it displaces little, and it sinks."),
  twoColTable([
    ["Buoyant force > weight", "The object floats up \u2014 positively buoyant."],
    ["Buoyant force = weight", "The object hovers in place \u2014 neutrally buoyant."],
    ["Buoyant force < weight", "The object sinks \u2014 negatively buoyant."],
  ], ["When...", "What happens"]),
  spacer(),
  p("This is exactly what the buoyancy table later in this section calculates: the volume of your ROV sets how much water it displaces (the buoyant force), and the total weight sets the downward pull. Compare the two and you can determine, on paper, whether your ROV will float before it ever gets wet."),
  twoColTable([
    ["Positively buoyant", "Floats up when thrusters are off. Slightly positive is the target."],
    ["Neutrally buoyant", "Hovers in place. Hard to hold exactly, and risky for a first ROV."],
    ["Negatively buoyant", "Sinks when thrusters are off. Avoid \u2014 a stalled ROV drops to the bottom."],
  ], ["Condition", "What it means for your ROV"]),
  spacer(),
  callout("Design your ROV to be slightly positively buoyant.", "If power fails, a wire comes loose, or you let go of the controls, a positively buoyant ROV floats gently back to the surface where you can reach it \u2014 instead of sinking to the bottom. This is a safety and recovery rule, not just a preference.", LIGHT, ACCENT),

  h2("Center of gravity and center of buoyancy"),
  p([b("Center of gravity (COG) "), t("is the single point where all the vehicle's weight can be treated as acting. Heavy parts \u2014 batteries, motors, the Pi \u2014 pull COG toward them.")]),
  p([b("Center of buoyancy (COB) "), t("is the point where all the upward buoyant force can be treated as acting. It sits at the center of the volume that displaces water \u2014 floats and sealed air spaces pull COB toward them.")]),
  callout("Keep the COB above the COG.", "When buoyancy pushes up from a point above where gravity pulls down, the ROV self-rights: tip the ROV and it swings back level, like a weighted buoy. If the COG sits above the COB, the ROV wants to roll over. Put heavy things (ballast) low and floats high.", LIGHT, TEAL),
  ...figure("/home/claude/img_buoyancy.png", "When the center of buoyancy sits above the center of gravity, a tipped ROV swings back upright. When they are reversed, it rolls over.", 470),

  h2("Ballast and floatation placement"),
  p([b("Floatation "), t("adds buoyancy \u2014 sealed foam or trapped air. Place it high on the frame to raise the COB.")]),
  p([b("Ballast "), t("adds weight to trim the ROV \u2014 to fine-tune how much it floats and to level it out. Place it low to lower the COG, and off-center to correct a lean.")]),
  callout("Use incompressible floatation.", "The deeper an ROV goes, the more the water squeezes it. If your floatation can be compressed, it shrinks as the ROV descends \u2014 which means it displaces less water, loses buoyancy, and the ROV can eventually become negatively buoyant and sink. The best floatation is incompressible, so its buoyancy stays constant at any depth. For this exercise we use compressible PVC insulation foam, but because we only go down a few meters the effect is small.", LIGHT, ACCENT),
  h3("How to trim your ROV"),
  p([b("Trim "), t("means making small adjustments to the weight and floatation so the ROV sits the way you want in the water \u2014 level, and floating at the right depth. You trim a vehicle the same way you would balance a scale: add a little here, take a little there, until it settles where you want it.")]),
  numbered("Put the ROV in the water with everything mounted and watch how it sits."),
  numbered("If it sinks, add floatation up high until it floats slightly."),
  numbered("If it floats too eagerly or bobs, add a little ballast down low."),
  numbered("If it leans or tips, move ballast toward the low side or floatation toward the high side until it sits level."),
  numbered("Aim for level and slightly positive. Test, adjust, and test again \u2014 trimming is always iterative."),

  h2("Predict buoyancy with a buoyancy table"),
  p("Rather than guessing, you can calculate whether your ROV will float before it ever touches the water, using a buoyancy table. This is the method used in the X Academy buoyancy lesson. The idea: every part adds both weight (which pulls it down) and volume (which, when flooded or displacing water, pushes it up). Compare the two and you know how the ROV will behave."),
  h3("Filling out the table"),
  p("Use the part weights and volumes from the team's PVC parts spreadsheet (linked at the top of this section) as you work through these steps:"),
  numbered("Count how many of each type of part your ROV uses and enter the count in the Quantity column."),
  numbered("For each part type, multiply the quantity by that part's weight, and enter it in the Extended Weight column."),
  numbered("Add up the Extended Weight column to get the Total Weight of the ROV."),
  numbered("For each part type, multiply the quantity by that part's volume, and enter it in the Extended Volume column."),
  numbered("Add up the Extended Volume column to get the Total Volume of the ROV."),
  h3("A note on units")
  ,
  p("Work in metric units, because they make buoyancy easy. Weight is measured in grams of force (gf) and volume in cubic centimeters (cm\u00B3). Here is the beautiful part: one cubic centimeter of water weighs exactly one gram of force. So, the volume of water your ROV displaces, in cm\u00B3, is the same number as the buoyant force it feels, in gf. That is why the buoyancy table can compare weight and volume directly \u2014 in metric, they are measured on the same scale."),
  h3("Reading the result"),
  p("Two quick calculations tell you what will happen in the water:"),
  ...code([
    "Net Buoyancy (gf) = Total Volume (cm3) - Total Weight (gf)",
    "   (1 cm3 of displaced water = 1 gf of lift)",
    "   positive -> the ROV floats",
    "   negative -> the ROV sinks",
    "   0        -> neutrally buoyant (hover)",
    "",
    "Percent Buoyant = Net Buoyancy / Total Volume",
    "   aim for 2% to 4% for a stable, slightly positive ROV",
  ]),
  callout("Target 2\u20134% buoyant.", "A neutrally-buoyant ROV is hard to hold and risky; aim for a Percent Buoyant of 2\u20134%. Adjust by adding floatation to the top and ballast to the bottom, then recompute or re-test.", LIGHT, TEAL),
  callout("Flood the frame:", "The buoyancy table assumes the PVC pipes in your frame fill with water. Make sure your frame has openings so water can flood it \u2014 an easy way is to add an extra Tee connector and leave one of its openings open. A sealed, air-filled frame will float far more than the table predicts.", LIGHT, ACCENT),
  p("After you calculate Net Buoyancy, weigh the ROV on a scale and compare the real weight to the Total Weight you computed \u2014 they should be close. Then show your buoyancy table to a mentor as part of the safety check below."),

  h3("Buoyancy table"),
  p("The weight and the volume (displaced water) of every PVC part are listed below. Fill in the Quantity for each part your ROV uses, then multiply to get the Extended weight and Extended volume and total the columns. Your mentor also has a hardcopy of this table to fill in by hand at the bench while you build. (This table is on its own landscape page so every column fits.)"),
  landscapeBlock([
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "Buoyancy table \u2014 PVC part weights and volumes", bold: true, color: NAVY, size: 24 })] }),
    buoyancyTable(),
    new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: "Net Buoyancy = Total Volume \u2212 Total Weight (both in gf, since 1 cm\u00B3 of displaced water = 1 gf). Percent Buoyant = Net Buoyancy / Total Volume; aim for 2\u20134%.", italics: true, color: GREY, size: 18 })] }),
  ]),

  h2("Hints"),
  bullet([b("Floatation high, ballast low: "), t("for a stable ROV, put the floatation (foam) on top and the ballast (rebar) on the bottom.")]),
  bullet([b("Balance check: "), t("support the ROV on two fingertips beneath the vertical thruster. If it tips forward or backward, shift the ballast until the frame rests level.")]),
  bullet([b("Let the frame flood: "), t("the buoyancy table assumes the PVC pipes fill with water, so give the frame openings. An easy trick is to add an extra Tee connector and leave one opening unconnected.")]),
  bullet([b("Stay off the bottom: "), t("storing a multi-million dollar ROV on the bottom of the ocean is called \u201Cwet storage\u201D and it is a bad thing \u2014 which is why you design the ROV to float up when powered off.")]),
  bullet([b("Reuse old PVC pipe first "), t("before cutting new pipe.")]),
  bullet([b("Don't hog parts. "), t("\uD83D\uDE42 Leave enough for the other teams.")]),

  h2("Advanced topic: Torque"),
  callout("Advanced:", "This goes deeper into the physics. It explains why two ROVs with the same thrusters can turn at very different speeds \u2014 and it will help you design a better vehicle.", LIGHT, AMBER),
  p("So far, we have thought about forces that push the ROV in a straight line. But placement also decides how the ROV turns and tips, and that is governed by torque. Torque is the twisting or turning effect a force has around a pivot point. A force applied far from the center produces more turning effect than the same force applied close to the center \u2014 which is why a long wrench loosens a bolt more easily than a short one."),
  h3("How torque is calculated"),
  p("Torque is simply the force multiplied by the distance from the pivot to where the force acts:"),
  ...code([
    "Torque = Force x Distance",
    "   Force    = how hard you push (e.g. thruster force)",
    "   Distance = how far that push is from the pivot (the",
    "              lever arm), measured straight out from",
    "              the pivot to the line of the force",
  ]),
  p("The farther out a force acts, the bigger its torque. Doubling the distance doubles the turning effect, even with the same force."),
  h3("Torque and thruster placement"),
  p("Your two horizontal thrusters turn the ROV by producing torque around its center. Mount them farther apart \u2014 farther from the centerline \u2014 and each one has a longer lever arm, so the ROV turns faster and more sharply for the same thruster force. Mount them close together and the ROV turns sluggishly. This is the main lever you have over how quickly your ROV spins: thruster force and how far the thrusters sit from the center."),
  h3("Torque and the size of your ROV"),
  p("Size cuts both ways. A bigger ROV lets you spread the thrusters farther apart for more turning torque \u2014 but a bigger ROV also has more water to push and more rotational inertia to get moving, which slows turning the ROV. A small, compact ROV has less drag and less inertia, so even modest thruster torque can spin it quickly. Good design balances a wide-enough stance for control against a small-enough body to stay nimble."),
  h3("Torque, floatation, and ballast"),
  p("Torque also explains balance. Weight placed off-center creates a torque that tips the ROV; floatation placed off-center creates a torque the other way. When you trimmed the ROV level earlier, you were balancing these torques \u2014 moving ballast farther from the center has a greater leveling effect than moving it a little, because torque grows with distance. The COB-above-COG rule is the same idea: gravity and buoyancy act through those points, and when they line up vertically their torques cancel and the ROV sits still instead of rolling."),
  callout("Design takeaway:", "To turn faster: more thruster force, or thrusters farther from the center. To stay stable: keep heavy things low and centered, floatation high and centered, so stray torques stay small. Every placement choice is really a torque choice.", LIGHT, TEAL),

  h2("Safety check before the water"),
  p("Before every water test, have a mentor check your ROV. Two things to confirm every time:"),
  bullet([b("Tether strain relief: "), t("zip-tie the black part of the tether to the ROV frame so a tug pulls on the frame, not on your wiring or connectors.")]),
  bullet([b("No sharp edges: "), t("clip your zip ties and check the frame for anything that could cut a hand or the tether.")]),

  h2("Your tasks"),
  numbered("Sketch your thruster layout before you build or rebuild it."),
  numbered("Mount the two horizontal thrusters symmetrically and the vertical thruster near the center."),
  numbered("Water-test each motion: forward, backward, turn left, turn right, up, down. Fix unwanted motion."),
  numbered("Mount heavy parts low and floatation high; then trim with ballast until the ROV sits level and slightly positive."),
  numbered("Fill out a weight table and calculate your Net Buoyancy and Percent Buoyant. Adjust until you reach 2\u20134%."),
  numbered("Weigh the ROV and compare it to your calculated Total Weight."),
  numbered("Confirm the ROV self-rights when gently tipped, then get a mentor safety check."),
  ...writeLines("Sketch your layout and record your weight-table totals (Total Weight, Total Volume, Net Buoyancy, Percent Buoyant):", 4),

  h3("Section 2 checklist"),
  checkbox("Can name the basic systems of an ROV and point to each on your vehicle"),
  checkbox("Horizontal thrusters mounted symmetrically; vertical near center"),
  checkbox("All six motions tested; unwanted motion reduced"),
  checkbox("Can explain positive, neutral, and negative buoyancy, and why to be positive"),
  checkbox("Weight table completed; Percent Buoyant is between 2% and 4%"),
  checkbox("Frame has openings so it floods (does not trap air)"),
  checkbox("Heavy parts low, floatation high; ROV sits level and floats up slightly"),
  checkbox("ROV self-rights when gently tipped"),
  checkbox("Mentor safety check passed: tether strain relief added, no sharp edges"),
  pageBreak(),
);

// ============================================================ SECTION 3 — POWER & ELECTRONICS (NEW)
children.push(
  ...sectionBanner("Section 3", "Power & Electronics"),
  atAGlance([
    ["Time", "One to two sessions (one to two weeks)"],
    ["You need", "Your thrusters and motor controller on hand. A multimeter helps. No coding required."],
    ["Unlocks", "Safe, correctly-sized power and wiring, and an understanding of how signals become motion."],
  ]),
  spacer(),
  callout("Goal:", "Understand how your ROV is powered and controlled: batteries and the tether, Ohm's law and a simple power budget, and how PWM signals drive ESCs and motor controllers to spin your thrusters.", LIGHT, TEAL),

  h2("The electrical path, end to end"),
  p("Follow the electricity from the surface to a spinning propeller. Battery \u2192 tether conductors \u2192 motor controller / ESC \u2192 motor. A separate small signal wire from the Raspberry Pi tells the controller how fast to spin. Understanding this path is how you diagnose almost every electrical problem."),

  h2("Voltage, current, and Ohm's law"),
  p("Three quantities describe any electrical circuit:"),
  twoColTable([
    ["Voltage (V)", "The electrical \u201Cpush,\u201D measured in volts. Your battery might be 12 V."],
    ["Current (I)", "The rate electricity flows, measured in amps (A). Motors under load can draw several amps each."],
    ["Resistance (R)", "How much the path opposes flow, measured in ohms (\u03A9). Thin, long wires have more resistance."],
  ], ["Quantity", "What it means"]),
  spacer(),
  callout("Ohm's law:", "V = I \u00D7 R. Voltage equals current times resistance. Rearranged: I = V / R and R = V / I. This one equation ties the three quantities together, and you will use it to reason about your wiring and your tether.", LIGHT, TEAL),
  h3("Why it matters for your ROV"),
  p("Your tether is long and its wires are thin-ish, so they have resistance. When current flows through that resistance, two things happen: the wire heats up, and some voltage is \u201Clost\u201D along the way (called voltage drop) so the motors get less than the full battery voltage. Ohm's law lets you estimate both."),
  p([b("Worked example. "), t("Suppose each direction of your tether wire has about 0.2 \u03A9 of resistance, and a motor draws 3 A. The voltage dropped along the wire is ")]),
  ...code([
    "V = I x R",
    "V = 3 A x 0.2 ohm (out) + 3 A x 0.2 ohm (back)",
    "V = 0.6 V + 0.6 V  =  1.2 V lost in the tether",
  ]),
  p("So a 12 V battery delivers only about 10.8 V at the motor \u2014 and more current means more loss. This is why thicker wire (lower resistance) and not overloading a single conductor matter on a long tether."),
  callout("Rule of thumb:", "Thicker wire = lower resistance = less voltage lost and less heat. If your motors seem weak at the end of a long tether, voltage drop is a prime suspect. Measure the voltage right at the motor controller with a multimeter and compare it to the battery.", LIGHT, ACCENT),
  ...figure("/home/claude/img_voltagedrop.png", "Current flowing through the tether's resistance drops some voltage before it reaches the motor \u2014 and heats the wire. V = I \u00D7 R.", 480),

  h2("Batteries and a simple power budget"),
  p("A power budget is just adding up how much current everything draws, to check your battery and wiring can supply it."),
  numbered("List each device that draws power: the three thrusters, the Raspberry Pi, the camera, and any add-ons such as the gripper or a sensor."),
  numbered("Write down the typical current each one draws (from its datasheet, or measured with a multimeter)."),
  numbered("Add them up. This is your approximate total current."),
  numbered("Check two things: your battery can supply that current, and every wire carrying it is rated for at least that much."),
  callout("Worst case, not typical:", "Motors draw far more current at startup and when stalled (blocked) than when spinning freely. Size your wiring and fuses for the worst case, not the average, or you will melt insulation or blow through connectors.", LIGHT, ACCENT),
  twoColTable([
    ["Battery voltage", "Must match what your motor controllers and the Pi's power supply expect."],
    ["Battery capacity", "Measured in amp-hours (Ah). Bigger capacity = longer run time before recharge."],
    ["Fuse", "A deliberate weak link that blows to protect your wiring if current spikes dangerously. Use one on the main battery lead."],
  ], ["Battery term", "What to know"]),
  spacer(),
  ...figure("/home/claude/photo_IMG_6069.jpg", "The powered electronics plate: the 12 V goBILDA NiMH battery (left) feeds a power switch and distribution blocks, then the speed controllers that drive each thruster.", 320),

  h2("The tether"),
  p("The tether is the cable linking your ROV to the surface. On your vehicle it carries motor power on six conductors (a pair for each of the three thrusters) plus an Ethernet line for camera video."),
  bullet([b("Why six conductors for motors: "), t("each thruster needs two wires (a supply and a return), and three thrusters need three pairs = six conductors.")]),
  bullet([b("Keep it neutrally buoyant if you can: "), t("a tether that sinks drags your ROV down; one that floats can tangle. Many teams add small floats along it.")]),
  bullet([b("Strain relief is essential: "), t("anchor the tether to the frame so a tug pulls on the frame, never on your solder joints or connectors.")]),
  bullet([b("Longer tether, more voltage drop: "), t("remember Ohm's law \u2014 plan for it, and keep runs no longer than you need.")]),
  ...figure("/home/claude/img_tether_hw.png", "Inside the tether: three pairs of power conductors (one pair per thruster) around a central Ethernet line, all inside one waterproof jacket.", 400),
  ...figure("/home/claude/photo_IMG_6059.jpg", "The real build: the three thrusters, the sealed PVC electronics canister, and the coiled tether with its colored connector that plugs in at the surface.", 320),

  h2("PWM: how a digital pin controls speed"),
  p("A Raspberry Pi GPIO pin can only be on or off. So how do you set a motor to \u201Chalf speed\u201D? The answer is PWM \u2014 Pulse-Width Modulation. The pin switches on and off very fast, and the pattern of pulses encodes the command."),
  h3("Two flavors of PWM \u2014 don't mix them up"),
  twoColTable([
    ["Duty-cycle PWM", "The fraction of time the pin is on sets the level. 50% on = half. Used for LED brightness and some simple motor drivers."],
    ["Servo-style PWM", "The width of each pulse (about 1000\u20132000 microseconds), sent ~50 times a second, sets the command. Used by servos and by the ESCs / speed controllers that drive your thrusters."],
  ], ["Type", "How it works"]),
  spacer(),
  callout("Your thrusters use servo-style PWM.", "What matters is the pulse width in microseconds (\u00B5s), not the duty cycle. This is the same signal used by radio-control servos and model-aircraft speed controllers.", LIGHT, TEAL),

  h2("ESCs and motor controllers"),
  p("An ESC (Electronic Speed Controller) or motor controller sits between the low-power signal from the Pi and the high-power battery current the motor needs. The Pi could never drive a motor directly \u2014 it cannot supply enough current, and the motor's voltage would destroy it. The controller does the heavy lifting: it reads the small PWM signal and switches the big battery current to the motor accordingly."),
  ...figure("/home/claude/img_gobilda_hw.png", "The goBILDA motor controller: battery power comes in, the thruster connects to the output, and a thin PWM signal wire from the Raspberry Pi sets the speed.", 440),
  ...figure("/home/claude/photo_IMG_6061.jpg", "The team's electronics plate: a row of goBILDA Element speed controllers (one per thruster) with the red/black motor leads running out to the thrusters.", 300),
  h3("How your goBILDA controller reads the signal"),
  p("The goBILDA speed controller responds proportionally to a servo-style PWM signal, roughly:"),
  threeColTable([
    ["~1500 \u00B5s", "Neutral", "Thruster stopped \u2014 always start here"],
    ["1500 \u2192 1950 \u00B5s", "One direction", "Faster as the pulse widens"],
    ["1500 \u2192 1050 \u00B5s", "Other direction", "Faster as the pulse narrows"],
  ], ["Pulse width", "Meaning", "Effect"]),
  spacer(),
  callout("Arming:", "Most speed controllers must see a neutral (1500 \u00B5s) signal for a moment before they respond. This is called arming \u2014 a safety feature so a thruster never leaps to full power the instant it powers on. Your control program must send neutral at startup and pause briefly. You will do exactly this in Section 6.", LIGHT, ACCENT),

  h2("Your tasks"),
  numbered("Draw your ROV's electrical path from battery to one motor, labeling the tether, controller, and signal wire."),
  numbered("Make a power budget: list every device, its current draw, and the total."),
  numbered("Use Ohm's law to estimate the voltage drop in your tether at full motor current."),
  numbered("With a multimeter (and an instructor), measure battery voltage and the voltage at a motor controller under load. Compare them."),
  numbered("Confirm your main battery lead has an appropriately-rated fuse."),
  ...writeLines("Record your power budget and measurements here:", 4),

  h3("Section 3 checklist"),
  checkbox("Can trace the electrical path from battery to motor"),
  checkbox("Can state Ohm's law (V = I \u00D7 R) and use it for a voltage-drop estimate"),
  checkbox("Made a power budget and confirmed battery and wiring can supply it"),
  checkbox("Understand the tether's six power conductors and why strain relief matters"),
  checkbox("Can explain the difference between duty-cycle and servo-style PWM"),
  checkbox("Can explain what an ESC / motor controller does and why the Pi can't drive a motor directly"),
  checkbox("Understand arming and the ~1500 \u00B5s neutral point"),
  pageBreak(),
);

// ============================================================ SECTION 4 — SOFTWARE SETUP
children.push(
  ...sectionBanner("Section 4", "Raspberry Pi and Linux"),
  atAGlance([
    ["Time", "One to two sessions (one to two weeks)"],
    ["You need", "A Raspberry Pi with power, keyboard, and monitor (or another computer). Can be done before the ROV is finished."],
    ["Unlocks", "A fully set-up Pi and the tools and habits to write, save, and fix the code in Sections 6\u20139."],
  ]),
  spacer(),
  callout("Goal:", "Get comfortable with the tools you'll use to program your ROV: Linux on the Raspberry Pi, Git for version control, Python, a Python IDE, and AI assistants for writing and fixing code.", LIGHT, TEAL),

  h2("The big picture"),
  p("Your ROV's brain is a Raspberry Pi running Linux. You write Python programs that read your joystick, drive the motors, and stream video. Good habits \u2014 saving your work, tracking changes, testing in small steps \u2014 save hours of frustration."),

  h2("Meet the Raspberry Pi 5"),
  p("Your ROV's brain is a Raspberry Pi 5 — a small, complete computer on a single board, running Ubuntu. It's fast enough to read a camera, drive the thrusters, and run PyCharm."),
  p("(Insert a labeled photo of a Raspberry Pi 5 here.) Key components: the USB-C power port (use the official 27 W supply); the blue USB 3.0 ports (plug the USB webcam here); the black USB 2.0 ports (keyboard, mouse, controller); Gigabit Ethernet (wired network to your laptop); the micro-HDMI ports (monitor); the 40-pin GPIO header (where the SparkFun Pi Servo HAT plugs on); and the microSD card slot (the Pi's “hard drive,” holding Ubuntu and your code)."),

  h2("Putting Ubuntu on the SD card"),
  p("The Pi boots from a microSD card, which must have an operating system written (“flashed”) onto it first. We use Ubuntu. The easiest way is the official Raspberry Pi Imager:"),
  numbered("On your laptop, download and install Raspberry Pi Imager from https://www.raspberrypi.com/software/"),
  numbered("Put the microSD card in your laptop (use an adapter if needed)."),
  numbered("In Imager, choose Device = Raspberry Pi 5, Operating System = Ubuntu Desktop (64-bit), and Storage = your SD card."),
  numbered("Set the username, password, and Wi-Fi in Imager's settings to the X Academy defaults below, then write the card and put it in the Pi."),
  callout("Full instructions:", "The Raspberry Pi Foundation has complete, illustrated steps at https://www.raspberrypi.com/documentation/computers/getting-started.html", LIGHT, TEAL),

  h2("X Academy default login and Wi-Fi"),
  p("The team's Pis all use the same login and Wi-Fi so anyone can use any Pi:"),
  twoColTable([
    ["Username", "xacademy"],
    ["Password", "Gauss5050"],
    ["Wi-Fi network (SSID)", "X Academy"],
    ["Wi-Fi password", "Gauss5050"],
  ], ["Setting", "Value"]),
  spacer(),

  h2("Logging in and opening a terminal"),
  p("For first-time setup, connect the Pi to a monitor (micro-HDMI), keyboard, and mouse, then plug in power."),
  numbered("At the login screen, pick the xacademy user and type the password Gauss5050."),
  numbered("The desktop appears with a dock (the bar of icons) down the left side of the screen."),
  numbered("Find the Terminal icon in the dock and click it — this is where you type the commands in this course. (You can also press Ctrl + Alt + T.)"),
  p("(Insert a screenshot of the Terminal icon in the left-hand dock here.)"),

  h2("Getting the code and running the setup script"),
  p("With a terminal open, download the course code and run the one-step setup script. It gets the Pi ready for every lesson (camera, joystick, I2C, the Servo HAT library) and installs the tools you'll use (Chrome, PyCharm, SSH):"),
  ...code([
    "git clone https://github.com/X-Academy-Santa-Cruz/robotics-lesson.git",
    "cd robotics-lesson",
    "sudo ./setup.sh        # asks for your password",
  ]),
  p("The script updates all packages; installs pip3 and the Python modules the lessons use as apt packages (OpenCV, Flask, click, pygame, matplotlib) plus the I2C tools; creates one shared virtual environment at the repo root and installs the pip-only libraries into it (the SparkFun Pi Servo HAT library and the I2C sensor drivers); enables the I2C bus; and installs Google Chrome and PyCharm, pinning them to the dock. When it finishes, reboot (below)."),
  callout("Why a virtual environment:", "The pip-only libraries go in a shared virtual environment at ~/robotics-lesson/.venv (built with --system-site-packages, so it still sees the apt modules). That way a \"pip install\" can never overwrite a package the operating system depends on. Activate it before running any lesson — your prompt then shows (.venv):", LIGHT, TEAL),
  ...code([
    "source ~/robotics-lesson/.venv/bin/activate",
  ]),
  p("In PyCharm, point the project interpreter at ~/robotics-lesson/.venv/bin/python instead (covered in the Software Development section)."),

  h2("Rebooting the Pi"),
  p("After the setup script (or any big change), reboot the Pi. The setup script enables this without a password prompt:"),
  ...code([
    "sudo reboot        # restart the Pi",
    "sudo poweroff      # shut down fully before unplugging power",
  ]),

  h2("Linux system management"),
  p("You control the Pi by typing commands in a terminal. The essentials:"),
  ...code([
    "pwd                 # print the folder you are in",
    "ls                  # list files in the current folder",
    "cd robotics         # change into the 'robotics' folder",
    "cd ..               # go up one folder",
    "mkdir rov           # make a new folder called 'rov'",
    "nano thrusters.py   # open a file in a simple text editor",
    "python3 thrusters.py  # run a Python program",
    "sudo apt update     # refresh the list of installable software",
  ]),
  callout("Heads up:", "sudo runs a command with administrator power. Useful but easy to misuse \u2014 only use it when instructions say to, and read the command twice before pressing Enter.", LIGHT, ACCENT),

  h2("Git \u2014 version control"),
  p("Git records snapshots of your code so you can return to a working version when something breaks. Keep your ROV code in Git from day one."),
  ...code([
    "git init                       # start tracking a project",
    "git status                     # see what has changed",
    "git add thrusters.py           # stage a file to be saved",
    "git commit -m \"joystick works\" # save a snapshot with a message",
    "git log                        # view the history of snapshots",
    "git clone <url>                # copy a project from the internet",
    "git pull                       # get teammates' latest changes",
    "git push                       # share your changes with the team",
  ]),
  callout("Team habit:", "Commit often, with a short message saying what changed. \u201CIt worked an hour ago\u201D is only recoverable if you committed an hour ago.", LIGHT, TEAL),
  h3("The X Academy code repository"),
  p("The starter code for the ROV \u2014 including the thruster and joystick scripts \u2014 lives in the X Academy repository on GitHub. GitHub is a hosting service built on Git that lets the whole team back up code, track versions, and collaborate. Clone it onto the Raspberry Pi (and onto your laptop) to get the code:"),
  ...code([
    "git clone https://github.com/X-Academy-Santa-Cruz/robotics-lesson.git",
    "cd robotics-lesson",
  ]),
  p("As you develop, commit your changes and push them back so your teammates get the latest version with git pull."),

  h2("Python"),
  p("Python is the language you'll write your ROV programs in \u2014 readable and beginner-friendly. A taste of the pieces you'll use:"),
  ...code([
    "speed = 50            # a variable holding a number",
    "",
    "def set_thruster(name, value):   # a function",
    "    print(name, \"set to\", value)",
    "",
    "if speed > 0:                    # a decision",
    "    set_thruster(\"left\", speed)",
    "else:",
    "    set_thruster(\"left\", 0)",
    "",
    "for i in range(3):               # a loop that repeats 3 times",
    "    print(\"thruster\", i)",
  ]),

  h2("A Python IDE"),
  p("An IDE (Integrated Development Environment) is an editor built for code. It colors your code, flags mistakes as you type, and runs programs with one click. X Academy uses PyCharm, which the setup script already installed and pinned to the dock."),
  h3("Opening the robotics-lesson repo as a PyCharm project"),
  p("Open the course code as a project so PyCharm's autocomplete, error-checking, and Run button all work on it:"),
  numbered("Click the PyCharm icon in the dock to open it."),
  numbered("Choose Open (on the welcome screen) or File > Open."),
  numbered("Select the robotics-lesson folder (in your home folder, where git cloned it) and click Open."),
  numbered("When PyCharm asks, choose to trust the project. The files appear in the Project panel on the left."),
  numbered("The first time, PyCharm may offer to set the Python interpreter \u2014 pick the system Python 3 (the setup script already installed the libraries system-wide), and you're ready to open and run any lesson's code."),

  h3("Your first program: Hello World"),
  p("Before writing ROV code, make sure your tools work by running the smallest possible program. In the robotics-lesson repo, open the hello folder and run hello.py:"),
  ...code([
    "cd robotics-lesson/hello",
    "python3 hello.py",
  ]),
  p([t("You should see "), mono("Hello, world! - X Academy Underwater Robotics"), t(". To run it in PyCharm instead: File > Open the robotics-lesson folder, open hello/hello.py, then right-click and choose Run 'hello' (or click the green ▶). The output appears in the Run window at the bottom, ending with “Process finished with exit code 0.” Change the message, run again, and watch it update — that edit-run-look loop is how you'll work all course.")]),

  h2("Using Claude and Gemini AI for code"),
  p("AI assistants like Claude and Gemini can help you write, understand, and fix code \u2014 powerful teammates, but teammates, not autopilots. You are responsible for what runs on your ROV."),
  bullet([b("Ask specific questions. "), t("\u201CWrite a Python function that reads axis 1 of a Logitech joystick with pygame and prints its value\u201D beats \u201Cwrite joystick code.\u201D")]),
  bullet([b("Give context. "), t("Say you're on a Raspberry Pi with Python 3 and goBILDA controllers so the answer fits your setup.")]),
  bullet([b("Read before you run. "), t("Understand each line. If you can't explain it, ask the AI to explain it.")]),
  bullet([b("Test in small pieces. "), t("Add a little at a time and check it works before adding more.")]),
  bullet([b("Fix errors with it. "), t("Paste the full error message and ask what it means and how to fix it.")]),
  callout("Golden rule:", "Never put code on your ROV that you don't understand. AI can be confidently wrong, and a wrong motor command can damage hardware or send the ROV out of control. Your team owns every line.", LIGHT, ACCENT),

  h2("Your tasks"),
  numbered("Open a terminal and practice moving between folders and listing files."),
  numbered("Open the robotics-lesson repo as a PyCharm project (see below)."),
  numbered("Run the Hello World program (hello/hello.py) from the terminal."),
  numbered("Open the project in PyCharm and run Hello World from inside the IDE; change the message and run it again."),
  numbered("Ask Claude or Gemini to explain one line of code you didn't understand, and write the explanation in your own words."),

  callout("Reference — learn more:", "Ubuntu/Raspberry Pi imaging: raspberrypi.com/software • Python: docs.python.org/3/tutorial • PyCharm: jetbrains.com/help/pycharm • Git: git-scm.com/doc", LIGHT, TEAL),
  h3("Section 4 checklist"),
  checkbox("Flashed Ubuntu to the SD card and logged in as xacademy"),
  checkbox("Opened a terminal from the dock and ran the setup script (sudo ./setup.sh)"),
  checkbox("Rebooted the Pi with sudo reboot"),
  checkbox("Can navigate folders and run a Python file from the Linux terminal"),
  checkbox("Ran Hello World from the terminal and from PyCharm"),
  checkbox("Opened the robotics-lesson repo as a PyCharm project"),
  checkbox("Used an AI assistant to explain or improve code, and understood the result"),
  pageBreak(),
);

// ============================================================ SECTION 5 — NETWORKING
children.push(
  ...sectionBanner("Section 5", "Networking"),
  atAGlance([
    ["Time", "About one session (one week)"],
    ["You need", "A Raspberry Pi, a surface computer, and an Ethernet cable. Section 4 helps but isn't required."],
    ["Unlocks", "Reaching the Pi remotely and getting camera video to the surface (Section 6)."],
  ]),
  spacer(),
  callout("Goal:", "Connect to your Raspberry Pi over Ethernet, understand IP addresses and SSH, and troubleshoot with ping and Wireshark.", LIGHT, TEAL),

  h2("IP addresses"),
  p("Every device on a network has an IP address \u2014 a numeric label like a mailing address, for example 192.168.1.50. Your surface computer and your Pi each have one, and they must be on the same network to talk. Camera video travels from the Pi's IP address to your computer over the Ethernet line in the tether."),
  bullet("Find your Pi's address by running this on the Pi:"),
  ...code(["hostname -I        # shows the Pi's IP address(es)"]),
  bullet("On your surface computer:"),
  ...code([
    "ip addr            # Linux / macOS",
    "ipconfig           # Windows",
  ]),

  h2("SSH \u2014 controlling the Pi remotely"),
  p("SSH (Secure Shell) opens a terminal on the Pi from your surface computer, over the network. This means you can program and control the Pi with no keyboard or monitor attached \u2014 essential once the Pi is sealed in the ROV."),
  ...code([
    "ssh pi@192.168.1.50    # connect to the Pi at that address",
    "                       # (use your Pi's real address and username)",
  ]),
  callout("Tip:", "The first time, SSH asks you to confirm \u2014 type yes, then enter the Pi's password. If it refuses, check SSH is enabled on the Pi and both devices are on the same network.", LIGHT, TEAL),

  h2("Troubleshooting with ping"),
  p("ping is the first tool to reach for when \u201CI can't connect.\u201D It sends a small message to another device and reports whether it answers. If ping works, the network path is alive; if it fails, the problem is the connection itself."),
  ...code([
    "ping 192.168.1.50      # test if you can reach the Pi",
    "                       # Ctrl-C to stop",
  ]),
  p([b("Reading the result:")]),
  bullet([b("Replies coming back: "), t("the two devices can talk. If SSH or video still fails, the problem is higher up (a program or setting), not the network.")]),
  bullet([b("No replies / timeouts: "), t("check the Ethernet cable, confirm both IP addresses are on the same network, and make sure the Pi is powered on.")]),

  h2("Troubleshooting with Wireshark"),
  p("Wireshark shows you the individual packets of data crossing the network \u2014 a window into the conversation between your computer and the Pi. You won't need it daily, but when something silently fails it shows whether data is flowing and where it stops."),
  p([b("How you'll use it:")]),
  bullet("Start a capture on the network connection linked to your ROV."),
  bullet("Watch for traffic between your computer's IP and the Pi's IP."),
  bullet("If you see your video or ping traffic, data is flowing. If you see nothing, the problem is before that point \u2014 a cable, an address, or the sender not running."),
  callout("Use it as a last resort:", "Try ping first \u2014 it answers most questions in seconds. Reach for Wireshark when you need to see exactly what is (or isn't) crossing the wire.", LIGHT, ACCENT),

  h2("Your tasks"),
  numbered("Connect the Pi to your surface computer over Ethernet and find both IP addresses."),
  numbered("Ping the Pi and confirm you get replies."),
  numbered("Open an SSH session and run a command (for example, ls) remotely."),
  numbered("Unplug the Ethernet cable, ping again, and observe the failure \u2014 then reconnect and confirm it recovers."),
  numbered("Open Wireshark and identify traffic between your computer and the Pi."),

  h3("Section 5 checklist"),
  checkbox("Found the IP address of both the Pi and the surface computer"),
  checkbox("Successfully pinged the Pi and got replies"),
  checkbox("Opened an SSH session and ran a command on the Pi remotely"),
  checkbox("Can describe what a failed ping tells you"),
  checkbox("Identified ROV network traffic in Wireshark"),
  pageBreak(),
);

// ============================================================ SECTION 6 — CAMERA
children.push(
  ...sectionBanner("Section 6", "Camera"),
  atAGlance([
    ["Time", "One to two sessions"],
    ["You need", "Sections 4 (software) and 5 (networking) help a lot. A Raspberry Pi with a USB camera plugged in, and a laptop on the same network."],
    ["Unlocks", "Live video from the ROV on the surface — the first program you write, because once you can see, everything else is easier to test."],
  ]),
  spacer(),
  callout("Goal:", "Stream the USB camera to a web browser on the surface, so anyone on your team can watch the live feed by opening the Pi's address in a browser.", LIGHT, TEAL),
  p("Your ROV is sealed inside its hull underwater — you can't see it, and the Raspberry Pi has no monitor attached. The camera is how you see what the ROV sees. Getting that video to the surface is the first program you write, because once you can see, everything else is easier to test."),
  callout("Already set up:", "The setup script you ran in the Raspberry Pi and Linux section already installed everything this lesson needs — OpenCV, Flask, and click (as apt packages). Just activate the shared virtual environment first: source ~/robotics-lesson/.venv/bin/activate. If a program reports a missing module, re-run sudo ./setup.sh from the repo root.", LIGHT, TEAL),

  h2("Streaming the camera to a web browser"),
  p("This program reads your USB camera on the Pi and serves the live video as a web page, so anyone on the surface can watch by opening the Pi's address in a browser — no special software needed on the surface computer. When you are done, opening http://<pi-ip-address>:8000/ on your laptop shows the live feed, updating continuously, with the Pi doing all the work and your laptop just displaying the result."),
  callout("Why stream over the network at all?", "The Pi is sealed inside the ROV with no monitor. The only way to see its camera is to send the video off the Pi, over the tether/network, to a laptop at the surface. This is exactly how real ROVs work — everything the pilot sees comes over a network or tether connection, not from a screen on the vehicle itself.", LIGHT, TEAL),

  h3("Background: how a camera becomes browser-friendly video"),
  p("Four ideas turn a camera into something a browser can show:"),
  bullet([b("The camera is a device file. "), t("On Linux the camera shows up as /dev/video0 (or /dev/video1 if you have more than one). Index 0 is what you pass to OpenCV to say “use this camera.”")]),
  bullet([b("OpenCV reads frames. "), t("cv2.VideoCapture talks to that device and hands you frames — each frame is just a grid of pixel values, the same as a photo.")]),
  bullet([b("JPEG shrinks each frame. "), t("cv2.imencode squeezes a frame down to a much smaller size. Raw video is too large to send efficiently; JPEG trades a little image quality for a huge reduction in data, which matters a lot on a network link.")]),
  bullet([b("MJPEG over HTTP streams them. "), t("Instead of a video file, the server keeps one HTTP response open forever and keeps writing new JPEG images into it, one after another, each separated by a marker called a boundary. A browser showing that response in an <img> tag just keeps redrawing the image as new ones arrive — which looks exactly like video.")]),

  h3("The program: camera_simple.py"),
  p("Start with this version. It is written to be read top to bottom, with a comment on almost every line explaining what that line does and why. It uses Flask, a small, friendly web-server library, so the web part stays short. It does the same job as the longer version at the end of this section — just with fewer moving parts. (Flask was installed with python3-flask in the step above.)"),
  ...code([
    "# camera_simple.py",
    "# Streams a USB camera to a web browser so the surface crew can watch.",
    "# Read this file top to bottom: every step is commented.",
    "",
    "import cv2                       # OpenCV: talks to the camera, makes JPEGs",
    "from flask import Flask, Response  # Flask: the tiny web server",
    "",
    "# Create the web application. __name__ just tells Flask where it lives.",
    "app = Flask(__name__)",
    "",
    "# Open the camera. 0 means \"the first USB camera\" (/dev/video0).",
    "# If your camera is not found, try camera = cv2.VideoCapture(1) instead.",
    "camera = cv2.VideoCapture(0)",
    "",
    "",
    "def make_frames():",
    "    # This function runs forever, handing out one JPEG image at a time.",
    "    while True:",
    "        # Ask the camera for one picture. 'ok' is True if it worked,",
    "        # 'frame' is the picture itself (a grid of pixels).",
    "        ok, frame = camera.read()",
    "        if not ok:",
    "            break                 # no picture? stop the loop",
    "",
    "        # Squeeze the picture into a JPEG (much smaller to send).",
    "        ok, buffer = cv2.imencode(\".jpg\", frame)",
    "        jpg = buffer.tobytes()    # turn it into raw bytes to send",
    "",
    "        # Hand this one JPEG to the browser, wrapped in the little",
    "        # header the browser expects between frames. 'yield' means",
    "        # \"send this now, then come back for the next one.\"",
    "        yield (b\"--frame\\r\\n\"",
    "               b\"Content-Type: image/jpeg\\r\\n\\r\\n\" + jpg + b\"\\r\\n\")",
    "",
    "",
    "@app.route(\"/\")",
    "def home_page():",
    "    # The page you open in a browser. The <img> tag points at /video,",
    "    # so the browser keeps showing each new frame as it arrives.",
    "    return \"<html><body><h1>ROV Camera</h1>\" \\",
    "           \"<img src='/video'></body></html>\"",
    "",
    "",
    "@app.route(\"/video\")",
    "def video_feed():",
    "    # This is the never-ending stream of JPEGs from make_frames().",
    "    # The long 'mimetype' is how we tell the browser: \"keep replacing",
    "    # the image with each new one I send.\"",
    "    return Response(make_frames(),",
    "        mimetype=\"multipart/x-mixed-replace; boundary=frame\")",
    "",
    "",
    "# This block runs when you type: python3 camera_simple.py",
    "if __name__ == \"__main__\":",
    "    # host=\"0.0.0.0\" makes the stream reachable from the surface laptop,",
    "    # not just from the Pi itself. port=8000 is the address you open.",
    "    app.run(host=\"0.0.0.0\", port=8000)",
  ]),

  h3("Running it"),
  p("On the Pi, change into the camera folder first, then run the program:"),
  ...code([
    "cd robotics-lesson/camera",
    "python3 camera_simple.py",
  ]),
  p([b("To watch: "), t("on the surface computer (not the Pi), open a browser and go to the Pi's address and port — for example ")]),
  ...code(["http://192.168.1.50:8000"]),
  p([t("Press Ctrl+C in the terminal to stop the server. Find the Pi's address with "), mono("hostname -I"), t(" on the Pi (see Section 5).")]),
  callout("Networking payoff:", "This is where Section 5 pays off. If the page won't load, ping the Pi first. If ping works but video doesn't, the network is fine — look at the program and the camera.", LIGHT, ACCENT),

  h3("If it doesn't work"),
  twoColTable([
    ["“Could not open camera 0”", "Camera isn't plugged in, or it's /dev/video1 instead — try cv2.VideoCapture(1)."],
    ["“Permission denied” opening the camera", "Your user isn't in the video group. Add it with: sudo usermod -aG video $USER, then log out and back in."],
    ["Page loads but never shows an image", "Check the Pi's firewall isn't blocking port 8000, and confirm you used the Pi's IP from your laptop, not localhost."],
    ["Laptop can't reach the Pi's IP at all", "Confirm both devices are on the same network, and re-check hostname -I on the Pi."],
  ], ["Problem", "Likely cause and fix"]),
  spacer(),

  h3("Measuring real-world latency with a phone"),
  p([b("Latency "), t("is the delay between something happening in front of the camera and you actually seeing it on your laptop — capture, JPEG encoding, network transfer, and browser decoding all take a small amount of time. For piloting an ROV, high latency is the difference between “I see a wall and stop in time” and “I see a wall after I've already hit it,” so it is worth measuring, not just assuming it is small.")]),
  p("You can't measure this with a regular stopwatch, because your own reaction time gets in the way. The trick is to capture both the real time and the delayed time in a single photo, using a second phone:"),
  numbered("Start a millisecond stopwatch on a phone (search “online millisecond stopwatch” if you don't have an app) and let it run."),
  numbered("Point the ROV's USB camera directly at that phone's screen, close enough that the numbers are sharp in the stream."),
  numbered("On your laptop, open the stream so the (slightly delayed) stopwatch is clearly visible."),
  numbered("With a second phone, take one photo that frames both screens at once — the real stopwatch and the laptop showing the stream."),
  numbered("Zoom into the photo and read both times. The real stopwatch reads a later (bigger) time than the stream; that difference is your end-to-end latency, in milliseconds."),
  callout("Why this works:", "Both numbers exist at the exact instant the photo's shutter opens. One traveled straight to the camera at the speed of light; the other traveled through the whole camera → Pi → network → browser pipeline you built, which takes measurably longer. The photo freezes both side by side so you can read the gap directly. Take several photos and average them, and try it at full resolution versus 320×240, and on Wi-Fi versus a wired link.", LIGHT, TEAL),

  h3("Exercises"),
  numbered("Open camera_simple.py in PyCharm and run it from the IDE (right-click > Run, or the green ▶). Watch the Run window, then open the stream in your laptop's browser."),
  numbered("In the HTML on the camera_simple.py home page, change the heading from “ROV Camera” to something of your own, then re-run the program in PyCharm and refresh the browser to see your new heading."),
  numbered("In camera_simple.py, set the camera size by adding camera.set(cv2.CAP_PROP_FRAME_WIDTH, 320) and camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 240) after opening the camera, and notice how much smoother the stream looks on a slow network — the same bandwidth-vs-quality tradeoff real ROV pilots deal with."),
  numbered("Open the stream in two browser tabs at once and see what happens. (The advanced version below handles several viewers at once; the simple version may not.)"),
  numbered("Measure the stream's end-to-end latency with the phone-photo method, at two different resolutions, and record both numbers."),

  h2("Advanced version"),
  p("Once the simple version makes sense, this is a sturdier version you would actually put on a competition ROV. It does the same job but adds two improvements, explained below. You do not need it to pilot the vehicle — treat it as the next step when you are comfortable."),
  h3("What the advanced version adds"),
  bullet([b("A background capture thread. "), t("Reading from a camera can momentarily block while waiting for the next frame. If the program only read a frame when a browser asked for one, every viewer would be stuck waiting on the camera hardware. Instead, a background thread continuously reads frames and keeps only the most recent one. When a browser asks, it instantly gets whatever is already there. A threading.Lock guards that shared frame so two threads never touch it at the same instant.")]),
  bullet([b("A server that handles many viewers at once. "), t("A plain server handles one connection at a time, but the video stream holds its connection open indefinitely — so a second viewer, or even a page reload, would hang. ThreadingHTTPServer spins up a new thread per connection so several people can watch at once. It uses Python's built-in http.server, so no Flask is needed.")]),
  bullet([b("Command-line options with click. "), t("Instead of editing the file to change the camera, port, or picture size, you pass them on the command line. The click library turns the @click.option lines into real options, and gives you a --help message for free. (click was installed with python3-click in the setup step at the start of this section.)")]),
  h3("Full example: stream_server.py"),
  ...code([
    "# stream_server.py — advanced camera streamer.",
    "# Same idea as camera_simple.py, but reads the camera on a background",
    "# thread and serves many viewers at once. Uses OpenCV, click (for the",
    "# command-line options), and Python's built-in http.server (no Flask).",
    "",
    "import cv2, threading, time",
    "import click                     # parses the command-line options for us",
    "from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer",
    "",
    "BOUNDARY = \"frame\"             # the marker that separates JPEG frames",
    "",
    "# ---- Camera: grab frames in the background, keep only the newest ----",
    "class Camera:",
    "    def __init__(self, index=0, width=640, height=480):",
    "        self.cap = cv2.VideoCapture(index)   # open the camera device",
    "        if not self.cap.isOpened():",
    "            raise RuntimeError(f\"Could not open camera {index}\")",
    "        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)    # set picture size",
    "        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)",
    "        self._latest_jpeg = None             # the most recent frame, as JPEG",
    "        self._lock = threading.Lock()        # guards _latest_jpeg",
    "        self._running = True",
    "        # start a helper thread that keeps grabbing frames on its own",
    "        self._thread = threading.Thread(target=self._capture_loop, daemon=True)",
    "        self._thread.start()",
    "",
    "    def _capture_loop(self):",
    "        # runs in the background forever, refreshing the latest frame",
    "        while self._running:",
    "            ok, frame = self.cap.read()      # grab one picture",
    "            if not ok:",
    "                time.sleep(0.05); continue    # no picture? wait and retry",
    "            ok, buf = cv2.imencode(\".jpg\", frame)   # compress to JPEG",
    "            if ok:",
    "                with self._lock:             # lock while we swap it in",
    "                    self._latest_jpeg = buf.tobytes()",
    "            time.sleep(1 / 30)               # about 30 frames per second",
    "",
    "    def get_jpeg(self):",
    "        # hand back the newest frame (used by the web server)",
    "        with self._lock:",
    "            return self._latest_jpeg",
    "",
    "    def close(self):",
    "        self._running = False                # stop the loop",
    "        self.cap.release()                   # free the camera device",
    "",
    "camera_obj = None   # the one Camera object, created in main()",
    "",
    "# ---- Web server: one page, plus the never-ending MJPEG stream ----",
    "class StreamingHandler(BaseHTTPRequestHandler):",
    "    def do_GET(self):",
    "        # decide what to send based on the address the browser asked for",
    "        if self.path == \"/\":",
    "            self._serve_page()               # the HTML page",
    "        elif self.path == \"/stream.mjpg\":",
    "            self._serve_stream()             # the live video",
    "        else:",
    "            self.send_error(404)             # anything else: not found",
    "",
    "    def _serve_page(self):",
    "        # a tiny page whose <img> points at the video stream",
    "        html = b\"<html><body><h1>ROV Camera</h1>\" \\",
    "               b\"<img src='/stream.mjpg'></body></html>\"",
    "        self.send_response(200)",
    "        self.send_header(\"Content-Type\", \"text/html\")",
    "        self.end_headers()",
    "        self.wfile.write(html)",
    "",
    "    def _serve_stream(self):",
    "        self.send_response(200)",
    "        # this header tells the browser: expect a never-ending run of images",
    "        self.send_header(\"Content-Type\",",
    "            f\"multipart/x-mixed-replace; boundary={BOUNDARY}\")",
    "        self.end_headers()",
    "        try:",
    "            while True:                      # keep sending frames forever",
    "                jpg = camera_obj.get_jpeg()",
    "                if jpg is None:",
    "                    time.sleep(0.05); continue   # no frame yet? wait",
    "                self.wfile.write(f\"--{BOUNDARY}\\r\\n\".encode())  # frame marker",
    "                self.send_header_line(jpg)   # this frame's headers",
    "                self.wfile.write(jpg)        # the JPEG itself",
    "                self.wfile.write(b\"\\r\\n\")",
    "                time.sleep(1 / 30)           # pace it to ~30 fps",
    "        except (BrokenPipeError, ConnectionResetError):",
    "            pass          # the browser closed the tab; that's fine",
    "",
    "    def send_header_line(self, jpg):",
    "        # the small headers that go in front of each JPEG frame",
    "        self.wfile.write(b\"Content-Type: image/jpeg\\r\\n\")",
    "        self.wfile.write(f\"Content-Length: {len(jpg)}\\r\\n\\r\\n\".encode())",
    "",
    "    def log_message(self, *args):",
    "        pass          # quiet the per-request console spam",
    "",
    "# The @click decorators below add command-line options so you can change",
    "# the camera, port and size without editing the code, e.g.",
    "#   python3 stream_server.py --width 320 --height 240",
    "# Run  python3 stream_server.py --help  to see them all.",
    "@click.command()",
    "@click.option(\"--camera\", default=0, help=\"Camera index (0 is the first USB camera).\")",
    "@click.option(\"--port\", default=8000, help=\"Port to serve the stream on.\")",
    "@click.option(\"--width\", default=640, help=\"Frame width in pixels.\")",
    "@click.option(\"--height\", default=480, help=\"Frame height in pixels.\")",
    "def main(camera, port, width, height):",
    "    # click fills in these arguments from the command line for us",
    "    global camera_obj",
    "    camera_obj = Camera(camera, width, height)   # start grabbing frames",
    "    # ThreadingHTTPServer handles several viewers at the same time",
    "    server = ThreadingHTTPServer((\"0.0.0.0\", port), StreamingHandler)",
    "    print(f\"Streaming at http://<pi-ip-address>:{port}/  (Ctrl+C to stop)\")",
    "    try:",
    "        server.serve_forever()               # run until Ctrl+C",
    "    except KeyboardInterrupt:",
    "        pass",
    "    finally:",
    "        camera_obj.close()                   # always release the camera",
    "        server.shutdown()",
    "",
    "if __name__ == \"__main__\":",
    "    main()",
  ]),
  p([t("Extra things to try with the advanced version: open the stream in "), b("two browser tabs"), t(" at once and confirm both update (this works because of ThreadingHTTPServer); and add a "), mono("--fps"), t(" option that controls the "), mono("time.sleep(1 / 30)"), t(" value instead of hard-coding 30.")]),

  callout("Reference — the Python modules:", "OpenCV (cv2) — docs.opencv.org/4.x • Flask (camera_simple.py) — flask.palletsprojects.com • click (stream_server.py) — click.palletsprojects.com • http.server (standard library) — docs.python.org/3/library/http.server.html", LIGHT, TEAL),
  h3("Section 6 checklist"),
  checkbox("python3-opencv installed on the Pi (and Flask, for the simple version)"),
  checkbox("USB camera video opens in a browser on the surface computer"),
  checkbox("Stream viewed at two resolutions; end-to-end latency measured with the phone-photo method"),
  checkbox("Read and understood the simple version (camera_simple.py)"),
  checkbox("Camera program committed to Git"),
  pageBreak(),
);

// ============================================================ SECTION 7 — THRUSTERS
children.push(
  ...sectionBanner("Section 7", "Thrusters"),
  atAGlance([
    ["Time", "One to two sessions"],
    ["You need", "Section 3 (PWM/ESC) and Section 4 (software). The joystick plugged into the Pi, the SparkFun Servo pHAT on the Pi, and the three goBILDA motor controllers wired to the thrusters."],
    ["Unlocks", "A vehicle you fly with a joystick. Combined with the camera from Section 6, that is a complete, working ROV."],
  ]),
  spacer(),
  callout("Goal:", "Write the program that reads your joystick and drives the three thrusters, so you can pilot the ROV. Run it alongside the camera stream from Section 6 and you have a full vehicle.", LIGHT, TEAL),
  p("The Raspberry Pi reads your Logitech joystick and sends thruster commands to the goBILDA motor controllers through the SparkFun Servo pHAT (see Section 3 for how the servo-style PWM signal works). The program uses pygame to read the joystick and the pi_servo_hat library to drive the pHAT's channels."),
  p("Before you start, install the libraries this program uses. On the Pi, install pip3 and the packages that have apt versions with apt-get:"),
  ...code([
    "sudo apt-get update",
    "sudo apt-get install python3-pip python3-pygame python3-pigpio pigpio",
  ]),
  p([t("The SparkFun Pi Servo HAT library isn't in apt, so it's pip-only. The setup script already installs it into the shared virtual environment; to add it by hand, activate that venv first so it never touches the system Python:")]),
  ...code([
    "source ~/robotics-lesson/.venv/bin/activate",
    "pip install -r requirements.txt",
  ]),
  p([t("Then start the pigpio daemon (needed for PWM):")]),
  ...code([
    "sudo pigpiod",
  ]),

  h2("Joystick thruster control"),
  h3("How the pieces connect"),
  bullet([b("Joystick axes → numbers: "), t("pushing a stick gives a value from about -1 to +1.")]),
  bullet([b("Numbers → thruster mix: "), t("forward/back drives both horizontal thrusters together; turning drives them oppositely; the up/down axis drives the vertical thruster.")]),
  bullet([b("Thruster values → Servo pHAT channel: "), t("each thruster plugs into a channel on the SparkFun Servo pHAT. The pHAT generates the servo-style PWM the goBILDA controllers read, so you set a position in degrees instead of timing pulses yourself.")]),
  h3("Channel map on the Servo pHAT"),
  p("The three thrusters and the gripper each use one channel of the Servo pHAT:"),
  twoColTable([
    ["Channel 0", "Gripper (see the Servo Gripper section)"],
    ["Channel 1", "Left thruster"],
    ["Channel 2", "Right thruster"],
    ["Channel 3", "Vertical thruster"],
  ], ["pHAT channel", "What's connected"]),
  spacer(),
  callout("Why degrees, not microseconds:", "The SparkFun pi_servo_hat library drives each channel by angle with move_servo_position(channel, degrees). With the pHAT at its default 50 Hz and a 180-degree swing, 0° is full one way, 90° is neutral (stop), and 180° is full the other way. So the code maps a thruster value of -1..+1 onto 0…180 degrees, with 0.0 landing on 90° (stop).", LIGHT, TEAL),

  h3("The program: thrusters_simple.py"),
  p("Start with this version. It drives just the two horizontal thrusters (left and right) so you can get driving and turning working first, with a comment on almost every line. Once this makes sense, the advanced version at the end adds the vertical thruster and a clean shutdown."),
  ...code([
    "# thrusters_simple.py",
    "# Reads the joystick and drives the LEFT and RIGHT thrusters.",
    "# Read this file top to bottom: every step is commented.",
    "",
    "import pygame          # reads the joystick",
    "import pi_servo_hat    # talks to the SparkFun Servo pHAT",
    "import time            # lets us pause between updates",
    "",
    "# ---- which pHAT channel each thruster is plugged into ----",
    "LEFT = 1              # left thruster is on channel 1",
    "RIGHT = 2            # right thruster is on channel 2",
    "",
    "STOP = 90            # 90 degrees means \"stopped\"",
    "SPAN = 40            # how hard to push; start gentle, raise later (max 90)",
    "",
    "# ---- connect to the Servo pHAT ----",
    "hat = pi_servo_hat.PiServoHat()",
    "hat.restart()",
    "",
    "",
    "def set_thruster(channel, value):",
    "    # value is -1.0 (full reverse) to +1.0 (full forward); 0.0 is stop.",
    "    if value > 1.0:",
    "        value = 1.0          # never ask for more than full",
    "    if value < -1.0:",
    "        value = -1.0",
    "    angle = STOP + value * SPAN   # turn the value into an angle",
    "    hat.move_servo_position(channel, angle, 180)   # send it to the pHAT",
    "",
    "",
    "# ---- get the joystick ready ----",
    "pygame.init()",
    "pygame.joystick.init()",
    "stick = pygame.joystick.Joystick(0)   # 0 = the first joystick",
    "stick.init()",
    "",
    "# ---- start with thrusters stopped so nothing jumps ----",
    "set_thruster(LEFT, 0.0)",
    "set_thruster(RIGHT, 0.0)",
    "time.sleep(2)        # wait 2 seconds for the controllers to wake up",
    "",
    "# ---- main loop: read the stick, drive the thrusters, repeat ----",
    "while True:",
    "    pygame.event.pump()              # refresh the joystick readings",
    "",
    "    forward = -stick.get_axis(1)     # push stick up to go forward",
    "    turn = stick.get_axis(0)         # push stick sideways to turn",
    "",
    "    left = forward + turn            # mix forward and turn...",
    "    right = forward - turn           # ...onto the two thrusters",
    "",
    "    set_thruster(LEFT, left)",
    "    set_thruster(RIGHT, right)",
    "",
    "    time.sleep(0.02)                 # about 50 updates per second",
  ]),
  callout("Test dry first:", "Run with the propellers out of the water. Confirm pushing the stick forward spins both horizontals the same way, and turning spins them opposite ways, before you ever put it in the tank. Press Ctrl+C to stop.", LIGHT, ACCENT),
  callout("If a thruster runs backwards:", "Swap the sign in the code (for example use left = -(forward + turn)), or swap that motor's two wires. Raise SPAN toward 90 once you trust the controls.", LIGHT, TEAL),
  callout("Axis numbers vary:", "Different joysticks number axes differently. Add print(stick.get_axis(0), stick.get_axis(1)) inside the loop and move the sticks to learn which axis is which, then set forward and turn to match.", LIGHT, TEAL),

  h2("Bringing it together"),
  numbered("Run stream_server.py (Section 6) and your thruster program at the same time on the Pi (two terminals, or run one in the background)."),
  numbered("Put the ROV in the water and pilot it while watching the live video on the surface."),
  numbered("Confirm the ROV is still slightly positively buoyant and sits level with the camera mounted."),
  numbered("Commit both working programs to your team's Git repository."),

  h2("Piloting with a gamepad: the control layout"),
  p("When you pilot over the network with pilot.py and a gamepad, the controls use a two-stick layout, the same idea as many real ROV and drone controllers:"),
  twoColTable([
    ["Left stick (up/down)", "Vertical — dive and surface"],
    ["Right stick (up/down)", "Forward and reverse"],
    ["Right stick (left/right)", "Turn"],
    ["Trigger", "Gripper — squeeze to close on something"],
  ], ["Control", "What it does"]),
  spacer(),
  callout("Two hands-free helpers:", "The gripper opens by default; squeeze the trigger to close it on an object, and it KEEPS holding that grip when you let go of the trigger — so you can carry something across the pool without holding the trigger down. Squeezing again only tightens; press the release button to open it and let go. Cruise control locks all three thruster speeds (forward, turn, and vertical) at once so the ROV keeps doing what it's doing hands-free: push the sticks to the speeds you want, squeeze the left trigger to lock them in, then let go of the sticks. Squeeze the left trigger again to turn it off; letting go when you engage does not cancel, but a fresh stick push (after the sticks return to center) does. On the F310 the gripper release is the A button and cruise is the left trigger; on the Extreme 3D Pro, which has no left trigger, release is button 2 and cruise toggles on button 3. These are set in each controller's profile in pilot.py; use --calibrate if yours differ.", LIGHT, TEAL),

  h2("Checking the hardware with rovtest"),
  p("Before you pilot a freshly built ROV, use the rovtest tool to check each piece of hardware on its own. If a part passes in rovtest, the real programs will see the same thing — so when something misbehaves on the water you already know which part is good."),
  ...code([
    "source ~/robotics-lesson/.venv/bin/activate",
    "cd ~/robotics-lesson/rovtest",
    "",
    "python3 rovtest.py scan-i2c                      # Servo HAT (0x40) + sensor (0x3C)?",
    "python3 rovtest.py arm                           # do the ESCs arm?",
    "python3 rovtest.py thruster left --percent 30 --seconds 2    # spin one thruster",
    "python3 rovtest.py thruster vertical --pulse 1.6 --seconds 2 # ...or by raw PWM",
    "python3 rovtest.py temperature                   # read the sensor",
    "python3 rovtest.py camera                        # is a camera available?",
    "python3 rovtest.py all                           # every non-moving check at once",
  ]),
  callout("Safe by design:", "Every rovtest thruster command arms first, runs for a fixed number of seconds, then stops — it never leaves a thruster running. As always, props off or the ROV fully submerged and clear of hands.", LIGHT, AMBER),

  h2("Advanced version"),
  p("Once the simple version drives and turns, this version adds the third (vertical) thruster so you can change depth, and stops all three cleanly when you press Ctrl+C. It is the version you would fly in competition."),
  h3("Full example: joystick_thrusters.py"),
  ...code([
    "# joystick_thrusters.py — advanced: drives all three thrusters and",
    "# stops cleanly on Ctrl+C. Same ideas as thrusters_simple.py.",
    "",
    "import pygame, pi_servo_hat, time",
    "",
    "# ---- channel map on the Servo pHAT ----",
    "LEFT, VERTICAL, RIGHT = 1, 2, 3   # gripper is channel 0",
    "STOP = 90       # 90 degrees = neutral (thruster stopped)",
    "SPAN = 85       # how far from neutral at full stick (<=90)",
    "",
    "hat = pi_servo_hat.PiServoHat()   # connect to the pHAT over I2C",
    "hat.restart()",
    "",
    "def set_thruster(channel, value):",
    "    value = max(-1.0, min(1.0, value))      # clamp to -1..+1",
    "    angle = STOP + value * SPAN             # map to 5..175 deg",
    "    hat.move_servo_position(channel, angle, 180)",
    "",
    "# ---- arm: hold neutral so the controllers wake up safely ----",
    "for ch in (LEFT, VERTICAL, RIGHT):",
    "    set_thruster(ch, 0.0)",
    "time.sleep(2)",
    "",
    "pygame.init()                     # start pygame",
    "pygame.joystick.init()            # turn on joystick support",
    "stick = pygame.joystick.Joystick(0)   # the first joystick",
    "stick.init()",
    "",
    "try:",
    "    while True:",
    "        pygame.event.pump()            # refresh joystick data",
    "",
    "        forward  = -stick.get_axis(1)  # up/down on left stick",
    "        turn     =  stick.get_axis(0)  # left/right on left stick",
    "        vertical = -stick.get_axis(3)  # up/down on right stick (depth)",
    "",
    "        left  = forward + turn         # mix into horizontals",
    "        right = forward - turn",
    "",
    "        set_thruster(LEFT, left)       # drive each thruster",
    "        set_thruster(RIGHT, right)",
    "        set_thruster(VERTICAL, vertical)",
    "        time.sleep(0.02)               # ~50 updates per second",
    "",
    "except KeyboardInterrupt:",
    "    for ch in (LEFT, VERTICAL, RIGHT):   # stop cleanly on Ctrl-C",
    "        set_thruster(ch, 0.0)",
  ]),
  callout("Tune SPAN gently:", "Start with a small SPAN (say 40) so thrusters run gently while you learn the controls, then increase toward 90. If a thruster runs the wrong way, swap that value's sign or its two motor wires.", LIGHT, TEAL),

  h2("Project: make the ROV drive itself (with AI help)"),
  p("Now that you can pilot by hand, write software that drives the ROV through a pattern on its own — no hands on the controller. This is the project that pulls the whole course together: Python, the thruster code, PWM, and a bit of planning. There is a starter in the repo at autopilot/autopilot.py, and a full write-up in autopilot/lesson.md."),
  p([b("You may use an AI assistant — Claude, ChatGPT, or Gemini — to help you write the code."), t(" That is not cheating here: using AI well is a real engineering skill, and this program teaches it on purpose. But you are the engineer: you decide what to build, you test it safely, and you must understand every line before you run it.")]),
  h3("The task"),
  p("Extend the starter (change build_pattern() so the ROV drives your pattern) or write your own from scratch. A pattern is just a list of maneuvers — each one a forward, turn, and vertical setting held for a number of seconds — run one after another with the same rig.drive(forward, turn, vertical) you already used. Ideas, easiest first:"),
  numbered("A longer there-and-back (the starter already does a short one)."),
  numbered("A square — four “forward, then turn” pairs; a loop makes this tidy."),
  numbered("A figure-eight — forward while turning one way, then the other."),
  numbered("A search sweep, or a dive-pattern-surface run that uses depth."),
  callout("Test it dry first, then safe:", "Run python3 autopilot.py --dry-run to print exactly what the ROV WOULD do, without touching the thrusters — plan your whole pattern this way. Then test for real only with props removed, or the ROV fully submerged and clear of hands. The starter always stops the thrusters on exit (even Ctrl+C) and caps step and mission time; keep those safety limits.", LIGHT, AMBER),
  h3("Using an AI assistant (Claude, ChatGPT, or Gemini) well"),
  p("Treat the AI like a fast, tireless teammate whose work you always check. It works the same way in all three: paste in your code and context, ask, then verify."),
  p([b("A prompt template you can reuse. "), t("Give the AI the context it needs, not just “write me a pattern”:")]),
  callout("Prompt template", "I'm writing Python to drive an underwater ROV autonomously. I control it with one function: rig.drive(forward, turn, vertical), each value -1.0 to +1.0 (forward: -1 reverse..+1 forward; turn: -1 left..+1 right; vertical: -1 down..+1 up). I hold a setting with time.sleep(seconds). Here is my current program: [paste autopilot.py]. Please change build_pattern() so the ROV drives ____ (describe the pattern). Keep the safety caps and the finally stop that are already there. Explain each step, and tell me which numbers I'll need to tune by testing.", LIGHT, GREY),
  p("Example prompts for different patterns:"),
  bullet([b("Square: "), t("“…so the ROV drives a square: forward, turn about 90°, repeat four times. Use a loop so I'm not copying the same lines. Explain how to find the turn time by testing with --dry-run first.”")]),
  bullet([b("Figure-eight: "), t("“…so it drives a figure-eight: forward while turning right for one loop, then forward while turning left. Make the turn amount a variable I can tune.”")]),
  bullet([b("Search sweep: "), t("“…forward a few seconds, turn 180°, forward back, then a short sideways step, repeated 3 times.”")]),
  bullet([b("Explain, don't just write: "), t("“Explain what build_pattern() returns and why it's a list of tuples, as if to a student who just learned Python lists.”")]),
  callout("A worked example to learn from", "autopilot/autopilot_example_square.py in the repo is a finished program that drives a square using a loop — the kind of result a good AI conversation produces. Read it, run it with --dry-run, then write your OWN pattern rather than copying it.", LIGHT, TEAL),
  p("Whichever assistant you use, do these every time:"),
  bullet([b("Read what it wrote "), t("and make sure you understand every line — if you can't explain a line to your teammate, ask the AI to explain it, don't run it.")]),
  bullet([b("Dry-run it "), t("before powering the thrusters.")]),
  bullet([b("Keep the safety caps and the stop-on-exit. "), t("If the AI removes them, put them back. Safety is your call, not the AI's.")]),
  bullet([b("Expect to tune. "), t("The AI can't know how fast your ROV turns in your water — discovering the right turn amounts and times by testing is most of the exercise.")]),

  h3("Section 7 checklist"),
  checkbox("Libraries installed (pygame, pi-servo-hat, pigpio)"),
  checkbox("Servo pHAT seen at 0x40 with i2cdetect"),
  checkbox("Read and understood the simple version (thrusters_simple.py)"),
  checkbox("Joystick program arms at neutral and drives all three thrusters correctly (tested dry)"),
  checkbox("Thruster mixing verified: forward, turn, and vertical all behave"),
  checkbox("Piloted in water using joystick and live video together"),
  checkbox("Wrote (or extended) an autonomous pattern; ROV drove it hands-off, then stopped"),
  checkbox("Can explain every line of the autonomous program, including any the AI wrote"),
  checkbox("Thruster program committed to Git"),
  pageBreak(),
);

// ============================================================ SECTION 8 — STRETCH: GRIPPER
children.push(
  ...sectionBanner("Section 8", "Servo Gripper"),
  callout("Add a gripper.", "Do this once Section 6 works, if you want your ROV to pick things up.", LIGHT, AMBER),
  atAGlance([
    ["Time", "About one session (one week)"],
    ["You need", "Section 6 working, a hobby servo, a gripper/claw mechanism, and a spare GPIO pin."],
    ["Unlocks", "A claw you open and close with a joystick button \u2014 useful for competition retrieval tasks."],
  ]),
  spacer(),
  callout("Goal:", "Drive a servo from a joystick button so you can open and close a gripper on the ROV.", LIGHT, TEAL),

  h2("How a servo differs from a thruster"),
  p("A hobby servo takes the same servo-style PWM as your ESCs, but instead of speed it usually sets a position. A pulse near 1000 \u00B5s moves it to one end of its travel, ~2000 \u00B5s to the other, ~1500 \u00B5s to the middle. For a gripper, you only need two positions: open and closed."),
  callout("Same signal, same library:", "Because it's servo-style PWM, you drive it with pigpio's set_servo_pulsewidth() \u2014 exactly like a thruster, just with two fixed pulse values.", LIGHT, TEAL),

  h2("Reading a joystick button"),
  p("Buttons are simpler than axes: each returns 0 (not pressed) or 1 (pressed). We watch for the moment a button goes from not-pressed to pressed (an \u201Cedge\u201D) and toggle the gripper each time, so one press opens and the next press closes."),

  h3("Full example: gripper.py"),
  ...code([
    "import pygame, pigpio, time",
    "",
    "GRIPPER_PIN = 23      # a spare GPIO pin for the servo",
    "OPEN_US   = 2000      # pulse width for 'open'",
    "CLOSED_US = 1000      # pulse width for 'closed'",
    "BUTTON = 0            # which joystick button toggles the gripper",
    "",
    "pi = pigpio.pi()",
    "",
    "def set_gripper(is_open):",
    "    pi.set_servo_pulsewidth(GRIPPER_PIN,",
    "                            OPEN_US if is_open else CLOSED_US)",
    "",
    "pygame.init()",
    "pygame.joystick.init()",
    "stick = pygame.joystick.Joystick(0)",
    "stick.init()",
    "",
    "gripper_open = False",
    "set_gripper(gripper_open)      # start closed",
    "was_pressed = False",
    "",
    "try:",
    "    while True:",
    "        pygame.event.pump()",
    "        pressed = stick.get_button(BUTTON) == 1",
    "",
    "        # act only on the press, not while held down",
    "        if pressed and not was_pressed:",
    "            gripper_open = not gripper_open   # toggle",
    "            set_gripper(gripper_open)",
    "        was_pressed = pressed",
    "",
    "        time.sleep(0.02)",
    "",
    "except KeyboardInterrupt:",
    "    pi.set_servo_pulsewidth(GRIPPER_PIN, 0)   # release the servo",
    "    pi.stop()",
  ]),
  callout("Find your button number:", "Like axes, button numbers vary. Print stick.get_button(i) for each button (0 to stick.get_numbuttons()-1) and press the one you want to learn its number.", LIGHT, TEAL),
  callout("Tune the endpoints:", "Adjust OPEN_US and CLOSED_US so the claw fully opens and closes without straining the servo. If the servo buzzes or gets hot at an endpoint, back off that value \u2014 you're pushing it past its travel.", LIGHT, ACCENT),

  h2("Your tasks"),
  numbered("Mount the servo and gripper mechanism on the ROV; run its signal wire to a spare GPIO pin."),
  numbered("Find your button number and set OPEN_US / CLOSED_US for full, gentle travel."),
  numbered("Test on the bench: one press opens, the next closes."),
  numbered("Add the gripper logic into your main control loop, or run it as a second program."),

  h3("Section 8 checklist"),
  checkbox("Servo driven with pigpio at two pulse values"),
  checkbox("Correct joystick button identified"),
  checkbox("One press opens, next press closes (edge-detected, not repeating while held)"),
  checkbox("Endpoints tuned so the servo doesn't strain"),
  pageBreak(),
);

// ============================================================ SECTION 9 — STRETCH: I2C
children.push(
  ...sectionBanner("Section 9", "I2C Sensors"),
  callout("Add a sensor.", "Great once Section 6 works and you want your ROV to sense its environment.", LIGHT, AMBER),
  atAGlance([
    ["Time", "About one session (one week)"],
    ["You need", "Section 4 (Python), a SparkFun Micro Temperature Sensor STTS22H (Qwiic), and a Qwiic cable to the Servo pHAT."],
    ["Unlocks", "Live temperature readings you can print and graph in real time."],
  ]),
  spacer(),
  callout("Goal:", "Connect the STTS22H temperature sensor over I2C through the Servo pHAT's Qwiic port, read the temperature in Python, and plot it live once per second.", LIGHT, TEAL),

  h2("What is I2C?"),
  p("I2C (say \u201CI-squared-C\u201D) is a simple two-wire system that lets the Raspberry Pi talk to small sensor chips. Two signal wires are shared by every device on the bus: SDA (data) and SCL (clock), plus power and ground. Each device has its own address, so the Pi can talk to many sensors over the same two wires."),
  twoColTable([
    ["SDA", "Serial Data \u2014 the wire the actual data travels on."],
    ["SCL", "Serial Clock \u2014 keeps both sides in step."],
    ["Address", "A number (like 0x3C) that identifies one device on the bus."],
    ["VCC / GND", "Power and ground for the sensor \u2014 check the sensor's required voltage (often 3.3 V)."],
  ], ["Pin / term", "What it is"]),
  spacer(),

  h2("Check the sensor is on the bus"),
  p("The setup script in Section 4 already enabled I2C. With the STTS22H plugged into the Servo pHAT's Qwiic connector, scan the bus to confirm the Pi sees it:"),
  ...code([
    "i2cdetect -y 1             # lists addresses of devices found",
  ]),
  callout("What you should see:", "The STTS22H shows up at 3c, and the Servo pHAT itself at 40. If 3c is missing, re-seat the Qwiic cable and check the pHAT is powered. This is the I2C version of \u201Cping the Pi first.\u201D", LIGHT, ACCENT),

  h2("Options for reading the sensor"),
  p("There's more than one way to get a number out of an I2C sensor in Python. The code for both lives in the i2c folder of the robotics-lesson repo:"),
  bullet([b("A sensor library "), t("(temperature.py). The stts22h CircuitPython driver knows the chip's registers, so your code is short: make the sensor, read sensor.temperature. Easiest; the trade-off is an extra dependency (it runs on Adafruit's Blinka layer).")]),
  bullet([b("Register-level with smbus2 "), t("(temperature_smbus2.py). You talk to the chip directly: write its control register to start it, read its temperature registers, and do the math yourself. Almost no dependencies, and you see exactly what I2C is doing.")]),
  bullet([b("SparkFun's own Python package: "), t("there isn't one for the STTS22H \u2014 SparkFun ships an Arduino library for this sensor, not a Python/Qwiic one \u2014 which is why the library version uses the stts22h CircuitPython driver.")]),
  p("The setup script already installed the pip-only drivers (circuitpython-stts22h, adafruit-blinka, adafruit-lgpio, smbus2) into the shared virtual environment, and matplotlib from apt for the graph. The adafruit-lgpio package is the GPIO backend Blinka needs on the Pi 5 — without it, import board fails with \"No module named 'lgpio'\". Activate the venv before running (so import board finds the drivers): source ~/robotics-lesson/.venv/bin/activate"),

  h2("The library version: temperature.py"),
  p("The whole read is three lines:"),
  ...code([
    "import board, stts22h",
    "i2c = board.I2C()                 # the Pi's I2C pins (SCL/SDA)",
    "sensor = stts22h.STTS22H(i2c)     # default address 0x3C",
    "print(sensor.temperature)         # degrees Celsius",
  ]),
  p([t("Run it from the i2c folder: "), mono("cd robotics-lesson/i2c"), t(", then "), mono("python3 temperature.py"), t(" for a live graph, or "), mono("python3 temperature.py --no-plot"), t(" to just print readings over SSH. Press Ctrl+C to stop.")]),

  h2("The register-level alternative: temperature_smbus2.py"),
  p("This version uses only smbus2 and talks to the STTS22H's registers directly \u2014 the best way to understand what I2C is doing. Each sensor has numbered registers (little memory slots). The STTS22H's are:"),
  twoColTable([
    ["WHO_AM_I (0x01)", "Identity \u2014 always reads 0xA0, so you can confirm the right chip."],
    ["CTRL (0x04)", "Control \u2014 turn on continuous reading and set the data rate."],
    ["STATUS (0x05)", "Busy/limit flags."],
    ["TEMP_L (0x06)", "Temperature, low byte."],
    ["TEMP_H (0x07)", "Temperature, high byte."],
  ], ["Register (address)", "What it's for"]),
  spacer(),
  p("Reading the temperature is: read the two temperature bytes, combine them into a 16-bit number, handle the sign, and divide by 100 (the sensor reports hundredths of a degree):"),
  ...code([
    "from smbus2 import SMBus",
    "",
    "ADDR = 0x3C",
    "with SMBus(1) as bus:                 # bus 1 = /dev/i2c-1",
    "    lo = bus.read_byte_data(ADDR, 0x06)",
    "    hi = bus.read_byte_data(ADDR, 0x07)",
    "    raw = (hi << 8) | lo",
    "    if raw >= 32768:                  # top bit set -> negative",
    "        raw -= 65536",
    "    celsius = raw / 100.0             # 1 count = 0.01 C",
    "    print(celsius)",
  ]),
  p([t("Run it the same way: "), mono("python3 temperature_smbus2.py"), t(" (or "), mono("--no-plot"), t("). The full file adds a WHO_AM_I check, starts continuous mode by writing CTRL, and plots the readings.")]),

  h2("Your tasks"),
  numbered("Plug the STTS22H into the Servo pHAT's Qwiic port and confirm it with i2cdetect -y 1 (look for 3c)."),
  numbered("Run temperature.py and watch the live graph; try --no-plot over SSH."),
  numbered("Run temperature_smbus2.py and confirm it reports the same temperature."),
  numbered("Warm the sensor with your fingers and watch the graph rise, then let go and watch it fall."),

  callout("Reference \u2014 the Python modules:", "circuitpython-stts22h \u2014 pypi.org/project/circuitpython-stts22h \u2022 Adafruit Blinka \u2014 pypi.org/project/Adafruit-Blinka \u2022 smbus2 \u2014 pypi.org/project/smbus2 \u2022 matplotlib \u2014 matplotlib.org", LIGHT, TEAL),
  h3("Section 9 checklist"),
  checkbox("Can explain SDA, SCL, and I2C addresses"),
  checkbox("STTS22H found at 3c with i2cdetect"),
  checkbox("Read the temperature with the library version (temperature.py)"),
  checkbox("Read the temperature with the register-level version (temperature_smbus2.py)"),
  checkbox("Plotted the temperature live and saw it respond to warming the sensor"),
  pageBreak(),
);

// ============================================================ SECTION 10 — DASHBOARD
children.push(
  ...sectionBanner("Section 10", "ROV Dashboard"),
  callout("Ties it all together.", "Once the camera, thrusters, and sensor each work on their own and you can pilot over the network, the dashboard shows everything on one screen.", LIGHT, TEAL),
  atAGlance([
    ["Time", "About one session (one week)"],
    ["You need", "The camera, thruster/control, and (optionally) sensor lessons working, and the shared venv."],
    ["Unlocks", "One web page with live video, telemetry gauges, a heading dial, and status — the ROV's “glass cockpit.”"],
  ]),
  spacer(),
  callout("Goal:", "Run the dashboard web app on the Pi and open it in a browser to watch the live camera, water temperature, each thruster's PWM and power, a heading dial, and the cruise / gripper status — all at once.", LIGHT, TEAL),

  h2("How the pieces fit together"),
  p("The dashboard brings together programs you already built. Two independent data paths feed it, the same idea as the piloting lesson:"),
  bullet([b("Telemetry (UDP): "), t("rov_server.py sends a small JSON packet every control cycle — each thruster's PWM, power percent, and direction, the temperature, and the cruise / gripper state. The dashboard listens for it and keeps the latest.")]),
  bullet([b("Video (HTTP): "), t("the camera lesson's stream (stream_server.py) is embedded straight into the page by URL, so the camera is opened once, not twice.")]),
  p("The browser then asks the dashboard for the newest telemetry a few times a second and redraws the gauges, table, and dial. Video and telemetry are separate, so a hiccup in one doesn't stall the other."),

  h2("Running it on the Pi"),
  p("With the shared virtual environment active, start the three programs (the start_rov.sh script in the repo does all of this for you, including opening the dashboard in a browser):"),
  ...code([
    "source ~/robotics-lesson/.venv/bin/activate",
    "",
    "# 1. the camera stream",
    "cd ~/robotics-lesson/camera && python3 stream_server.py &",
    "",
    "# 2. the thruster server, now also sending telemetry to the dashboard",
    "cd ~/robotics-lesson/thrusters && python3 ../control/rov_server.py &",
    "",
    "# 3. the dashboard web app",
    "cd ~/robotics-lesson/dashboard && python3 dashboard.py",
  ]),
  p([t("Then open "), mono("http://<pi-ip-address>:8080/"), t(" in a browser. The video follows whatever address you used to reach the dashboard, so when everything is on one Pi there is nothing extra to configure. Pilot with the joystick as usual and watch the gauges move.")]),
  callout("One-command start:", "On the Pi, ./start_rov.sh kills any old copies, starts the camera, thruster server, pilot, and dashboard on localhost, and opens the dashboard in a browser. ./start_rov.sh stop shuts them all down.", LIGHT, TEAL),

  h2("What the dashboard shows"),
  twoColTable([
    ["Camera", "The live video stream from the ROV."],
    ["Water temp", "The sensor reading, in both °C and °F."],
    ["Armed", "Whether the thrusters have seen neutral and will accept throttle (a startup safety step); not armed means they ignore commands."],
    ["Thruster channels", "Each thruster's channel, direction, power %, and PWM pulse in microseconds."],
    ["Heading dial", "An arrow showing which way the ROV is driving and how fast."],
    ["Cruise / Gripper", "Whether cruise control is holding a speed, and whether the gripper is holding a grip."],
  ], ["Panel", "What it tells you"]),

  h2("Why UDP for telemetry"),
  p("Telemetry is a steady stream of “here's the state right now,” just like the control commands. If one packet is lost, the next one a fraction of a second later has fresh numbers anyway, so there's no reason to pay for the guaranteed, in-order delivery that TCP gives. That's the same reasoning that made UDP the right choice for piloting (Section 5 / control)."),

  h2("Your tasks"),
  numbered("Start the camera, thruster server, and dashboard (or run ./start_rov.sh) and open the dashboard in a browser."),
  numbered("Confirm the live video appears and the temperature shows in °C and °F."),
  numbered("Pilot the ROV and watch the thruster power, PWM values, and heading dial change."),
  numbered("Engage cruise and the gripper and confirm the status badges update."),
  h3("Section 10 checklist"),
  checkbox("Camera, thruster server, and dashboard all running (or started with ./start_rov.sh)"),
  checkbox("Dashboard opens at http://<pi-ip>:8080/ and shows the live video"),
  checkbox("Temperature, armed state, and thruster PWM/power all update live"),
  checkbox("Heading dial and cruise / gripper badges respond while piloting"),
  pageBreak(),
);

// ============================================================ APPENDIX
children.push(
  h1("Appendix \u2014 Quick Reference"),
  h2("Linux commands"),
  ...code([
    "pwd                  # print the current working directory",
    "ls                   # list the files in this directory",
    "cd <folder>          # change into a folder",
    "cd ..                # go up one folder",
    "mkdir <name>         # make a new folder",
    "nano <file>          # open a file in a simple editor",
    "python3 <file>       # run a Python program",
    "sudo apt update      # refresh the list of installable software",
    "hostname -I          # show the Pi's IP address",
    "ip addr              # show this computer's network addresses",
    "ping <address>       # test whether you can reach a device",
    "ssh user@address     # open a remote terminal on the Pi",
    "i2cdetect -y 1       # list I2C devices (look for 40 and 3c)",
    "ls /dev/video*       # list connected cameras",
  ]),
  h2("Git commands"),
  ...code([
    "git init             # start tracking a project with Git",
    "git status           # see what has changed",
    "git add <file>       # stage a file to be saved",
    "git commit -m \"msg\"  # save a snapshot with a message",
    "git log              # view the history of snapshots",
    "git clone <url>      # copy a project from the internet",
    "git pull             # get teammates' latest changes",
    "git push             # share your changes with the team",
  ]),
  h2("Servo pHAT / thruster quick facts"),
  ...code([
    "Servo pHAT at I2C address 0x40, 50 Hz, 16 channels",
    "Channels: 0 = gripper, 1 = left, 2 = vertical, 3 = right",
    "move by angle:  hat.move_servo_position(channel, degrees, 180)",
    "90 deg = stop (neutral)   0 and 180 = full each way",
    "always start thrusters at neutral (arm) before driving",
  ]),
  h2("STTS22H temperature sensor"),
  ...code([
    "I2C address 0x3C (Micro, default)   bus = smbus.SMBus(1)",
    "CTRL 0x04 (set 0x3C for free-run)   TEMP_L 0x06  TEMP_H 0x07",
    "temp_C = signed16(hi<<8 | lo) / 100.0",
  ]),
  h2("Ohm's law"),
  ...code([
    "V = I x R        (volts = amps x ohms)",
    "I = V / R        R = V / I",
    "Voltage drop in a wire = current x wire resistance",
  ]),
  h2("Troubleshooting flow"),
  numbered("Nothing works? Check power and cables first."),
  numbered("Motors weak on a long tether? Suspect voltage drop \u2014 measure voltage at the controller."),
  numbered("Can't reach the Pi? ping its IP address."),
  numbered("Ping works but a program fails? The network is fine \u2014 look at the code, camera, or controller."),
  numbered("Sensor not found? Re-check I2C wiring and run i2cdetect."),
  numbered("Still stuck? Read the full error message, then ask an AI assistant or instructor with that exact message."),
  h2("Glossary"),
  twoColTable([
    ["ROV", "Remotely Operated Vehicle \u2014 an underwater robot controlled from the surface."],
    ["Thruster", "A motor and propeller that pushes water to move the ROV."],
    ["COG / COB", "Center of gravity (where weight acts) / center of buoyancy (where lift acts)."],
    ["Ballast", "Added weight used to trim and level the ROV."],
    ["Buoyancy", "The upward push of water; positive buoyancy means the ROV floats."],
    ["Tether", "The cable from surface to ROV carrying power and video."],
    ["Ohm's law", "V = I \u00D7 R, relating voltage, current, and resistance."],
    ["Voltage drop", "Voltage lost along a wire due to its resistance."],
    ["PWM", "Pulse-Width Modulation \u2014 encoding a command in on/off pulses."],
    ["ESC", "Electronic Speed Controller \u2014 turns a PWM signal into motor power."],
    ["Arming", "Sending neutral at startup so a controller is ready and safe."],
    ["IP address", "A device's numeric address on a network."],
    ["SSH", "Secure Shell \u2014 a remote terminal to the Pi over the network."],
    ["UVC", "USB Video Class \u2014 a standard type of USB camera."],
    ["I2C", "A two-wire bus (SDA + SCL) for talking to sensor chips."],
    ["Git", "A tool that saves snapshots of your code."],
  ], ["Term", "Meaning"]),
);

// ============================================================ REFERENCE
children.push(
  ...sectionBanner("Reference", "Reference"),
  p("A grab-bag of one-off Raspberry Pi setup tasks you'll do occasionally, not every session. Keep this page handy; you don't need to read it start to finish."),

  h2("Set up the SD card (first-time install)"),
  p("This is the very first step for a brand-new Pi: flash Ubuntu onto the SD card, boot the Pi, and run the setup script. You only do this once per Pi."),
  callout("Before you start:", "You need a microSD card (32 GB or larger), an SD card reader on your laptop, and the login details below. Ask your instructor if you don't have them.", LIGHT, TEAL),
  h3("1. Flash Ubuntu onto the SD card"),
  bullet([b("a. Download and install the Raspberry Pi Imager "), t("from raspberrypi.com/software, then open it.")]),
  bullet([b("b. Insert "), t("the SD card into your laptop, then in the Imager choose:")]),
  bullet([b("Device: "), t("Raspberry Pi 5")], 1),
  bullet([b("Operating System: "), t("Other general-purpose OS → Ubuntu → Ubuntu Desktop 26.04 LTS (64-bit)")], 1),
  bullet([b("Storage: "), t("your SD card")], 1),
  bullet([b("c. Click Write "), t("and wait for it to finish, then eject the card.")]),
  h3("2. Boot the Pi and finish Ubuntu's first-run setup"),
  bullet([b("a. Insert "), t("the SD card into the Pi, connect a monitor, keyboard, and mouse, and power it on.")]),
  bullet([b("b. Work through "), t("Ubuntu's welcome screens:")]),
  bullet([b("Create your account — Name: "), mono("X Academy"), t("   Username: "), mono("xacademy"), t("   Password: "), mono("Gauss5050")], 1),
  bullet([b("Language, locale, and keyboard: "), t("English (US)")], 1),
  bullet([b("Wi-Fi — Network (SSID): "), mono("X Academy"), t("   Password: "), mono("Gauss5050")], 1),
  bullet([b("Skip "), t("the Ubuntu Pro sign-up.")], 1),
  bullet([b("Turn off "), t("Location Services.")], 1),
  callout("Keep these the same on every Pi.", "Using the same username and password on all the ROV Pis means one set of login details works everywhere — and the lessons' commands (which assume the xacademy user) just work.", LIGHT, AMBER),
  h3("3. Install the course software"),
  p("Open a Terminal and run these, one block at a time:"),
  ...code([
    "# install git",
    "sudo apt update && sudo apt install -y git",
    "",
    "# clone the course repository",
    "git clone https://github.com/X-Academy-Santa-Cruz/robotics-lesson.git",
    "",
    "# run the setup script (installs everything; takes a while)",
    "cd robotics-lesson",
    "chmod +x setup.sh",
    "sudo ./setup.sh",
  ]),
  p("When the script finishes, reboot the Pi:"),
  ...code([
    "sudo reboot",
  ]),
  p("After it reboots you're ready for the lessons: Terminal, PyCharm, and Chrome are on the dock, and the shared virtual environment is set up."),

  h2("Change the Pi's hostname"),
  p("Every Pi on the network has a hostname — a name you can use instead of its IP address. If several Pis share the same Wi-Fi, give each one a unique name (for example rov-1, rov-2) so they don't collide and so you can tell them apart. Set a new hostname, then reboot for it to take effect:"),
  ...code([
    "sudo hostnamectl set-hostname rov-1",
    "sudo reboot",
  ]),
  p([t("After rebooting, "), mono("hostname"), t(" shows the new name, and on most networks you can reach the Pi by name instead of IP, e.g. "), mono("ssh xacademy@rov-1.local"), t(". If the .local name doesn't resolve, fall back to the IP address from "), mono("hostname -I"), t(".")]),

  h2("Set the time from the command line"),
  p("The Pi normally sets its own clock from the internet. If it's off (for example after being offline), you can check and set it by hand. First see the current status:"),
  ...code([
    "timedatectl                         # show the current date, time, and time zone",
  ]),
  p("Set the time zone, and turn automatic network time on (recommended when the Pi has internet):"),
  ...code([
    "sudo timedatectl set-timezone America/Los_Angeles",
    "sudo timedatectl set-ntp true       # sync the clock from the internet",
  ]),
  p("If the Pi has no internet and you must set the clock manually, turn NTP off first, then set the date and time (YYYY-MM-DD HH:MM:SS):"),
  ...code([
    "sudo timedatectl set-ntp false",
    "sudo timedatectl set-time \"2026-10-11 11:30:00\"",
  ]),

  h2("Set a static IP address"),
  p("By default the Pi gets a different IP address each time it joins the network, which is annoying when you connect to it by address. A static (fixed) IP keeps it the same. On Ubuntu, the network is managed by NetworkManager; the easiest way is nmcli."),
  p("First find your connection's name and the interface:"),
  ...code([
    "nmcli connection show               # the NAME column (e.g. \"Wired connection 1\")",
  ]),
  p("Then set a fixed address, gateway, and DNS (adjust to your network — ask your instructor for the right numbers), and bring the connection back up:"),
  ...code([
    "sudo nmcli connection modify \"Wired connection 1\" \\",
    "    ipv4.addresses 192.168.1.50/24 \\",
    "    ipv4.gateway 192.168.1.1 \\",
    "    ipv4.dns 8.8.8.8 \\",
    "    ipv4.method manual",
    "sudo nmcli connection up \"Wired connection 1\"",
  ]),
  p([t("Confirm it took effect with "), mono("hostname -I"), t(" or "), mono("ip addr"), t(". To go back to automatic addresses, set "), mono("ipv4.method auto"), t(" and bring the connection up again.")]),

  h2("Turn the Pi into a Wi-Fi hotspot"),
  p("Out in the field there may be no Wi-Fi to join. The Pi can instead BE the Wi-Fi network: it broadcasts its own hotspot, and your laptop joins that to reach the camera, dashboard, and controls. Ubuntu manages Wi-Fi with NetworkManager, so one nmcli command does it. (The Pi can't use its one Wi-Fi radio to join a network and host a hotspot at the same time — so either connect the Pi to the internet over Ethernet, or accept that in hotspot mode it's off the internet.)"),
  p([t("Create the hotspot on the Wi-Fi interface ("), mono("wlan0"), t("), using the X Academy network name and password so your devices already know them:")]),
  ...code([
    "sudo nmcli device wifi hotspot \\",
    "    ifname wlan0 \\",
    "    ssid \"X Academy\" \\",
    "    password \"Gauss5050\"",
  ]),
  p([t("The Pi is now a Wi-Fi access point. On your laptop, join the "), b("X Academy"), t(" network (password "), mono("Gauss5050"), t("), then reach the Pi at its hotspot address — find it on the Pi with "), mono("hostname -I"), t(" (it's usually "), mono("10.42.0.1"), t("). The camera is then at "), mono("http://10.42.0.1:8000/"), t(" and the dashboard at "), mono("http://10.42.0.1:8080/"), t(".")]),
  p("Make the hotspot come back automatically every boot, so you don't have to retype the command. Find the connection NetworkManager just made (it's usually named “Hotspot”), then set it to autoconnect:"),
  ...code([
    "nmcli connection show                       # find the hotspot's NAME",
    "sudo nmcli connection modify Hotspot connection.autoconnect yes",
  ]),
  p([t("To stop hosting and go back to joining normal Wi-Fi, bring the hotspot down (and turn autoconnect off if you set it):")]),
  ...code([
    "sudo nmcli connection down Hotspot",
    "sudo nmcli connection modify Hotspot connection.autoconnect no",
  ]),
  callout("Heads up:", "While the Pi is a hotspot it usually can't also be on the internet over the same Wi-Fi radio, so git pull, apt, and pip won't reach the internet unless the Pi is also plugged in by Ethernet. Set the Pi up (run setup.sh, pull the latest code) on regular Wi-Fi first, then switch to hotspot mode in the field.", LIGHT, AMBER),
);

children.push(
  ...sectionBanner("Prompts", "Building This Repo with Claude"),
  p("Every program in this course can be written with an AI assistant — that's the engineering skill the autopilot project teaches. This page collects clean, reusable prompts you can give Claude (or ChatGPT or Gemini) to recreate each part of this repository from scratch. Use them to learn how the code was built, to rebuild a piece you broke, or as templates for your own new programs."),
  callout("How to use these prompts", "Give one prompt at a time, read what the AI writes, and make sure you understand every line before you run it. Paste in the real hardware details (below) so the code matches your ROV, and always test with a dry run or props off first. You are the engineer; the AI is a fast assistant whose work you check.", LIGHT, TEAL),

  h2("Start every prompt with this context"),
  p("The AI writes better code when it knows your exact hardware and conventions. Keep this block handy and paste it (or refer back to it) at the start of a build prompt:"),
  ...code([
    "I'm building an underwater ROV controlled by a Raspberry Pi 5 running",
    "Ubuntu. The hardware is:",
    "  - 3 bilge-pump thrusters (left, right, vertical), each on its own ESC",
    "  - a SparkFun Pi Servo HAT (PCA9685) at I2C address 0x40 for PWM",
    "  - a small servo gripper on one PWM channel",
    "  - a USB camera, streamed to a laptop over the network",
    "  - an STTS22H I2C temperature sensor",
    "  - a USB game controller plugged into the topside laptop for piloting",
    "Code is Python 3, runs in a shared virtualenv, and is organized one folder",
    "per topic (camera/, thrusters/, control/, dashboard/, sensors/, autopilot/).",
    "Write clear, commented code a high-school student can read and explain.",
  ]),

  h2("1. Scaffold the repository"),
  p("Create the folder structure and the shared files first, so every later program has a home."),
  ...code([
    "Create the folder structure for this ROV course repo: a top-level README,",
    "a setup.sh, a start_rov.sh, and one folder per topic (hello, shell, git,",
    "pycharm, camera, thrusters, sensors, control, dashboard, autopilot,",
    "rovtest, debugging). Each topic folder should have a lesson.md and, where",
    "there is code, a requirements.txt. Give me the README outline that lists",
    "the hardware above and links to each lesson in a sensible learning order.",
  ]),

  h2("2. The camera stream"),
  ...code([
    "Write camera/stream_server.py: read a USB camera with OpenCV and serve it",
    "as MJPEG over HTTP at /video, so a laptop can watch it in a browser. Read",
    "the camera on a background thread so several viewers can connect at once.",
    "Use click for command-line options: --camera, --width, --height, --port",
    "(default 8000). Comment it so a beginner can follow it.",
  ]),

  h2("3. The thrusters"),
  ...code([
    "Write thrusters/thruster_control.py: a ThrusterRig class that drives three",
    "thrusters and a gripper through a SparkFun Pi Servo HAT (pi_servo_hat,",
    "PCA9685 at 0x40). Give it arm(), a drive(forward, turn, vertical) method",
    "that mixes those into the three channels, a set_gripper(0..1), a stop(),",
    "and a telemetry() method returning each channel's pulse width and percent.",
    "Convert a -1..+1 throttle to a servo pulse in microseconds. Expose a click",
    "CLI to test one channel at a time. Spinning props are dangerous — always",
    "stop in a finally block.",
  ]),

  h2("4. Joystick control over the network"),
  p("Two programs: the pilot (on the laptop) reads the joystick and sends commands; the server (on the Pi) receives them and drives the thrusters."),
  ...code([
    "Write control/pilot.py: read a game controller with pygame and send a",
    "control packet (forward, turn, vertical, gripper, gripper_release,",
    "cruise_on) as UDP to the Pi. Add a click CLI for --host and --port",
    "(default 5005). Map a Logitech F310's sticks and triggers sensibly.",
  ]),
  ...code([
    "Write control/rov_server.py: receive the UDP control packets from pilot.py,",
    "drive the ThrusterRig from thrusters/thruster_control.py, and stream JSON",
    "telemetry back over UDP to a dashboard (--telemetry-host/--telemetry-port,",
    "default 5006). click CLI; always stop the thrusters if packets stop.",
  ]),

  h2("5. The dashboard"),
  ...code([
    "Write dashboard/dashboard.py: a Flask web app on port 8080 that shows one",
    "screen with the live camera video (embedded from the camera server by URL),",
    "the water temperature in C and F, each thruster's PWM and power, a heading",
    "dial, and the armed / cruise / gripper status. Listen for the JSON",
    "telemetry UDP packets from rov_server.py on a background thread and let the",
    "page poll /telemetry a few times a second. Fit 1920x1080 with no scrolling.",
  ]),

  h2("6. The temperature sensor"),
  ...code([
    "Write sensors/temperature.py: read an STTS22H I2C temperature sensor and",
    "print the temperature once a second, in C and F. Use the CircuitPython",
    "STTS22H driver. Also write a second version, sensors/temperature_smbus2.py,",
    "that reads the same sensor at the register level with smbus2, so students",
    "can compare a high-level driver with raw I2C.",
  ]),

  h2("7. The autonomous-driving project"),
  ...code([
    "Write autopilot/autopilot.py: a starter that drives the ROV through a timed",
    "pattern on its own by reusing ThrusterRig. Include a --dry-run that prints",
    "each step without moving the thrusters, and hard safety caps (max step time,",
    "max mission time, clamped speed) that can't be removed. Leave build_pattern()",
    "simple so students extend it. Then write autopilot_example_square.py: a",
    "finished example that drives a square using a loop, as a worked solution.",
  ]),

  h2("8. The setup script"),
  ...code([
    "Write setup.sh for a Raspberry Pi 5 running Ubuntu: install the apt packages",
    "the lessons need (OpenCV, Flask, click, pygame, I2C tools, build tools),",
    "create one shared virtualenv with --system-site-packages, pip-install the",
    "pip-only libraries (SparkFun pi-servo-hat, the I2C sensor drivers) into it,",
    "enable the I2C bus, and verify at the end that click, flask and cv2 import",
    "from the venv. Make each step safe to re-run and report clearly if one fails.",
  ]),

  h2("9. The lessons"),
  p("Once the code works, have the AI write the lesson that teaches it — then read it critically and fix anything that doesn't match your build."),
  ...code([
    "Write camera/lesson.md: a lesson that teaches a high-school student how the",
    "camera streaming works and how to run it. Explain MJPEG and the background",
    "thread simply, give the exact commands to run it and view it from a laptop,",
    "list the hardware and install steps, add a short 'if it doesn't work' table,",
    "and end with a checklist of what 'done' looks like. Keep the tone friendly.",
  ]),

  callout("Remember", "The point isn't to paste prompts and ship whatever comes back. It's to understand what good code looks like, check the AI's work against your real hardware, and be able to explain and fix every line yourself. That's what makes you the engineer.", LIGHT, ACCENT),
);

// ============================================================ DOCUMENT
const doc = new Document({
  creator: "MATE Underwater Robotics Program",
  title: "MATE ROV Builder's Workbook",
  description: "Section-based, self-guided workbook for new ROV student teams",
  styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { run: { color: TEAL }, paragraph: { indent: { left: 460, hanging: 260 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "\u2013", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 900, hanging: 260 } } } },
      ] },
      ...Array.from({ length: 60 }, (_, k) => ({
        reference: "steps" + k,
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { run: { bold: true, color: NAVY }, paragraph: { indent: { left: 460, hanging: 300 } } } },
        ],
      })),
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } } },
    children: (() => {
      const flat = children.flat();
      let group = -1, prevStep = false;
      const out = [];
      for (const item of flat) {
        if (item && item.__step) {
          if (!prevStep) group++;
          prevStep = true;
          out.push(new Paragraph({ numbering: { reference: "steps" + (group % 60), level: 0 }, spacing: { after: 60 }, children: item.runs }));
        } else if (item && item.__landscape) {
          prevStep = false;
          for (const c of item.__landscape) out.push(c);
        } else {
          prevStep = false;
          out.push(item);
        }
      }
      return out;
    })(),
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/claude/MATE_ROV_Workbook.docx", buf);
  console.log("written");
});
