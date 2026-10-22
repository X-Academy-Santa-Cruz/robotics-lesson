const H = require("./wb_common.js");
const content = require("./wb_content.js")(H);
const { Packer } = require("docx");
const { makeDoc, docCover, fs } = H;

const OUT = "/mnt/user-data/outputs";

// strip a leading sectionBanner from a block when we supply our own docCover?
// The section blocks begin with ...sectionBanner(label,title). We keep that for context,
// but our docCover adds a cleaner titled header + review tag. To avoid a double title,
// we DROP the block's own sectionBanner (first 3 paragraphs) for section docs.
function dropBanner(arr) {
  // sectionBanner returns 3 paragraphs spread at the top; remove them.
  return arr.slice(3);
}

const { h1, h2, h3, p, b, t, bullet, numbered, callout, twoColTable, spacer, LIGHT, TEAL, ACCENT, AMBER } = H;

// ---- Intro / welcome content (self-study guide + this project's specs) ----
function introBlock() {
  return [
    h1("Welcome \u2014 Read This First"),
    p("Welcome to X Academy Underwater Robotics! This is a self-study guide for new members of the program. You will work through it largely on your own and with your team, with mentors available to help and to check your work at key points."),
    p("Over the next few weeks you will work in a small team of three or four students to build another ROV \u2014 a better one than the ROV from the first week \u2014 designed using first principles of physics and engineering. Your vehicle will have:"),
    bullet([b("Three thrusters "), t("(left, right, and vertical) for driving, turning, and changing depth.")]),
    bullet([b("A better design "), t("worked out from the physics and engineering ideas in this guide, not just trial and error.")]),
    bullet([b("Raspberry Pi control: "), t("a Raspberry Pi running Python software, driven by a joystick.")]),
    h3("On the controller board"),
    p("Your controller board (the plate that carries the electronics) will hold:"),
    bullet([b("Raspberry Pi 5 "), t("\u2014 the brain of the ROV.")]),
    bullet([b("USB web camera "), t("\u2014 streams live video to the surface.")]),
    bullet([b("Small gripper "), t("\u2014 to pick things up during missions.")]),
    bullet([b("I2C temperature sensor "), t("\u2014 measures water temperature.")]),
    h3("What your Python software will do"),
    numbered("Read the joystick and send PWM commands to the motor controllers to drive the three thrusters and the small gripper."),
    numbered("Stream live video from the camera to a web browser on the surface."),
    numbered("Read the temperature sensor and plot a graph of the temperature."),
    callout("The goal:", "By the end of this guide, your team will have designed, built, and programmed an ROV plus a camera, gripper and sensor \u2014 and be ready to pilot it, just like a real MATE competition vehicle.", LIGHT, TEAL),
  ];
}

// ---- About the MATE ROV Competition ----
function mateBlock() {
  return [
    h1("About the MATE ROV Competition"),
    p("The ROV you build in this program is modeled on the vehicles students build for the MATE ROV Competition. MATE stands for Marine Advanced Technology Education."),
    p("The MATE ROV Competition is an annual, international underwater robotics contest. Student teams design, build, and pilot remotely operated vehicles (ROVs) to complete real-world ocean missions \u2014 and then present their work to judges. It is run by the MATE program (part of the Marine Technology Society), and it has grown to hundreds of teams and thousands of students around the world since it began in 2001."),
    h3("How it works"),
    bullet([b("Teams act like companies. "), t("Each team works like a small start-up: you design and build a vehicle to meet a request for proposal (aka the competition manual), then show it off.")]),
    bullet([b("Missions in the water. "), t("Your ROV completes timed tasks in a pool or tank \u2014 for example driving a course, finding and identifying objects with the camera, or retrieving items with a gripper.")]),
    bullet([b("More than just the robot. "), t("Teams also give a technical presentation, write engineering documentation, and create a marketing display. Communication counts, not only the vehicle.")]),
    h3("Competition classes"),
    p("MATE has several classes, from beginner to advanced, so teams compete at a level that matches their experience:"),
    twoColTable([
      ["SCOUT", "Entry level \u2014 new teams, often elementary and middle school."],
      ["NAVIGATOR", "For teams with some robotics experience; a common starting class for high schools."],
      ["RANGER", "Intermediate \u2014 teams with a good grasp of robotic systems and electricity."],
      ["PIONEER / EXPLORER", "Advanced \u2014 experienced high school, community college, and university teams."],
    ], ["Class", "Who it's for"]),
    spacer(),
    callout("Why this matters for you:", "The skills in this guide \u2014 thruster design, buoyancy, power and electronics, Python control, and teamwork \u2014 are exactly what MATE teams use. Learn them here and you are ready to join a competition team.", LIGHT, TEAL),
    p("You can learn more at the MATE ROV Competition website: https://materovcompetition.org"),
  ];
}

const docs = [];

// ---- Front matter doc (cover + intro + MATE + how to use + appendix) ----
{
  const kids = [
    ...docCover("New-Member Self-Study Guide", "X Academy Underwater Robotics",
      "Build, program, and pilot your own ROV", null),
    ...introBlock(),
    H.pageBreak(),
    ...mateBlock(),
    H.pageBreak(),
    ...content.howto(),
    H.pageBreak(),
    ...content.appendix(),
  ];
  docs.push({ file: "00_Front_Matter.docx", kids, tag: "FM",
    title: "X Academy Underwater Robotics \u2014 Front Matter", trackChanges: false });
}

// ---- Section docs ----
const sectionDefs = [
  { key: "sec1", n: "01", tag: "1", label: "Section 1", title: "Build Your First ROV",
    sub: "Get a working vehicle in the water fast", review: null, track: true },
  { key: "sec2", n: "02", tag: "2", label: "Section 2", title: "Mechanical Design",
    sub: "Thruster placement, balance, and buoyancy (buoyancy table)", review: null, track: true },
  { key: "sec3", n: "03", tag: "3", label: "Section 3", title: "Power & Electronics",
    sub: "Tether, Ohm's law, PWM, and motor controllers", review: null, track: false },
  { key: "sec4", n: "04", tag: "4", label: "Section 4", title: "Raspberry Pi and Linux",
    sub: "Set up the Pi, then Linux, Git, Python, an IDE, and AI assistants", review: null, track: false },
  { key: "sec5", n: "05", tag: "5", label: "Section 5", title: "Networking",
    sub: "IP addresses, SSH, ping, and Wireshark", review: null, track: false },
  { key: "sec6", n: "06", tag: "6", label: "Section 6", title: "Camera",
    sub: "Stream the USB camera to a web browser on the surface", review: null, track: false },
  { key: "sec7", n: "07", tag: "7", label: "Section 7", title: "Thrusters",
    sub: "Joystick control of the three thrusters", review: null, track: false },
  { key: "sec8", n: "08", tag: "8", label: "Section 8", title: "Servo Gripper",
    sub: "Drive a gripper from a joystick button", review: null, track: false },
  { key: "sec9", n: "09", tag: "9", label: "Section 9", title: "I2C Sensors",
    sub: "Read and plot a temperature sensor", review: null, track: false },
  { key: "dashboard", n: "10", tag: "10", label: "Section 10", title: "ROV Dashboard",
    sub: "One screen: live video, telemetry, dial, and status", review: null, track: false },
];

for (const s of sectionDefs) {
  const kids = [
    ...docCover(s.label, s.title, s.sub, s.review),
    ...dropBanner(content[s.key]()),
  ];
  docs.push({ file: `${s.n}_${s.title.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "")}.docx`,
    kids, tag: s.tag, title: `X Academy Underwater Robotics \u2014 ${s.title}`, trackChanges: s.track });
}

// ---- Reference doc (occasional one-off Pi setup tasks) ----
{
  const kids = [
    ...docCover("Reference", "Reference",
      "Occasional Raspberry Pi setup tasks (hostname, time, static IP, hotspot)", null),
    ...dropBanner(content.reference()),
  ];
  docs.push({ file: "11_Reference.docx", kids, tag: "R",
    title: "X Academy Underwater Robotics \u2014 Reference", trackChanges: false });
}

// ---- Prompts doc (clean Claude prompts to build the repo) ----
{
  const kids = [
    ...docCover("Prompts", "Building This Repo with Claude",
      "Clean, reusable AI prompts to recreate each program", null),
    ...dropBanner(content.prompts()),
  ];
  docs.push({ file: "12_Prompts.docx", kids, tag: "P",
    title: "X Academy Underwater Robotics \u2014 Prompts", trackChanges: false });
}

(async () => {
  const flagged = [];
  for (const d of docs) {
    const doc = makeDoc(d.kids, { title: d.title, sectionTag: d.tag });
    const buf = await Packer.toBuffer(doc);
    fs.writeFileSync(`${OUT}/${d.file}`, buf);
    if (d.trackChanges) flagged.push(d.file);
    console.log("wrote", d.file, d.trackChanges ? "(track-changes ON)" : "");
  }
  fs.writeFileSync("/tmp/flagged.txt", flagged.join("\n"));
  console.log("done:", docs.length, "documents");
})();
