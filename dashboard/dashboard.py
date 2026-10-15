"""
dashboard.py - a web dashboard for the ROV.

Open it in a browser on the surface laptop to see, all on one page:
  * the live camera video
  * the water temperature
  * each thruster channel's PWM (pulse width), power percent, and direction
  * a dial showing which way the thrusters are driving
  * whether cruise control and the gripper's grip-hold are active

How the data gets here
----------------------
rov_server.py (the thruster listener) streams telemetry as JSON over a UDP
socket. This app listens on that socket in a background thread, keeps the most
recent snapshot, and serves it to the browser at /telemetry. The browser polls
that a few times a second and redraws. The video is the camera lesson's own
stream, embedded by URL - so the camera is opened once, by stream_server.py,
not twice.

Run it on the Pi with the shared venv active:
    source ~/robotics-lesson/.venv/bin/activate
    cd ~/robotics-lesson/dashboard
    python3 dashboard.py

Then open http://<pi-ip>:8080/ in a browser. The video follows whatever host
you used to open the dashboard, so no camera URL is needed - the stream and the
dashboard are on the same Pi. (Only pass --camera-url if the camera lives on a
different host.)
"""

import json
import socket
import threading

import click
from flask import Flask, Response, jsonify, render_template_string

# The most recent telemetry snapshot from rov_server, shared between the UDP
# listener thread and the web requests. A lock keeps reads/writes tidy.
_latest = {"telemetry": None}
_lock = threading.Lock()


def telemetry_listener(port):
    """Background thread: receive JSON telemetry packets and keep the newest."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("0.0.0.0", port))
    while True:
        try:
            data, _addr = sock.recvfrom(4096)
            snap = json.loads(data.decode("utf-8"))
        except (OSError, ValueError):
            continue
        with _lock:
            _latest["telemetry"] = snap


PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ROV Dashboard</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #0e2439; color: #eef4f3;
         font-family: 'IBM Plex Sans', Arial, sans-serif; font-size: 18px; }
  header { padding: 18px 28px; background: #0b1c2e; border-bottom: 1px solid #1f4a66;
           display: flex; align-items: baseline; gap: 22px; flex-wrap: wrap; }
  header h1 { margin: 0; font-size: 28px; letter-spacing: 1px; }
  header span { color: #6fd3cf; font-weight: 600; }
  header .ip { color: #8fb3b0; font-size: 20px; }
  header .ip b { color: #eef4f3; font-weight: 600; }
  .help { font-size: 18px; color: #bfd8d5; line-height: 1.6; }
  .help b { color: #eef4f3; }
  .help .key { display: inline-block; background: #0b1c2e; border: 1px solid #1f4a66;
               border-radius: 6px; padding: 1px 7px; font-weight: 600; color: #6fd3cf; }
  .hint { font-size: 15px; color: #8fb3b0; margin-top: 6px; line-height: 1.45; }
  /* Top row: camera (wide) + status/dial. */
  .wrap { display: grid; grid-template-columns: 2fr 1fr; gap: 22px;
          padding: 22px; max-width: 1800px; margin: 0 auto; }
  /* Second row: controls (left) and thruster channels (right), full width. */
  .row2 { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr;
          gap: 22px; }
  @media (max-width: 1000px) {
    .wrap { grid-template-columns: 1fr; }
    .row2 { grid-template-columns: 1fr; }
  }
  .card { background: #13324a; border: 1px solid #1f4a66; border-radius: 14px;
          padding: 22px; }
  .card h2 { margin: 0 0 16px; font-size: 18px; text-transform: uppercase;
             letter-spacing: 2px; color: #6fd3cf; font-weight: 600; }
  img.video { width: 100%; border-radius: 10px; background: #000; display: block; }
  .stat-row { display: flex; gap: 18px; flex-wrap: wrap; }
  .stat { flex: 1; min-width: 150px; background: #0e2439; border-radius: 10px;
          padding: 16px 18px; }
  .stat .label { font-size: 15px; color: #8fb3b0; text-transform: uppercase;
                 letter-spacing: 1px; }
  .stat .value { font-size: 34px; font-weight: 600; margin-top: 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 12px 10px; border-bottom: 1px solid #1f4a66;
           font-size: 20px; }
  th { color: #8fb3b0; font-weight: 600; font-size: 15px; text-transform: uppercase; }
  .bar { height: 10px; background: #0b1c2e; border-radius: 5px; overflow: hidden; margin-top: 6px; }
  .bar > div { height: 100%; background: #6fd3cf; width: 0; transition: width .15s; }
  .pill { display: inline-block; padding: 7px 16px; border-radius: 999px;
          font-size: 18px; font-weight: 600; }
  .on { background: #15803d; color: #eafff0; }
  .off { background: #334155; color: #cbd5e1; }
  .badges { display: flex; gap: 14px; }
  svg text { fill: #eef4f3; }
  .stale { opacity: .45; }
</style>
</head>
<body>
<header>
  <h1>X Academy <span>ROV Dashboard</span></h1>
  <div class="ip">Pi address: <b id="piaddr">--</b></div>
</header>
<div class="wrap">
  <div class="card">
    <h2>Camera</h2>
    <img class="video" id="camera" alt="ROV camera stream">
  </div>

  <div class="card">
    <h2>Status</h2>
    <div class="stat-row">
      <div class="stat"><div class="label">Water temp</div>
        <div class="value" id="temp">--</div></div>
      <div class="stat"><div class="label">Armed</div>
        <div class="value" id="armed">--</div>
        <div class="hint">Thrusters have seen neutral and will accept throttle. Not armed = they ignore commands (a safety step at startup).</div></div>
    </div>
    <div class="badges" style="margin-top:16px">
      <span class="pill off" id="cruise">Cruise off</span>
      <span class="pill off" id="grip">Gripper open</span>
    </div>
    <h2 style="margin-top:22px">Heading dial</h2>
    <div style="display:flex;justify-content:center">
      <svg id="dial" width="220" height="220" viewBox="0 0 220 220">
        <circle cx="110" cy="110" r="96" fill="#0e2439" stroke="#1f4a66" stroke-width="2"/>
        <circle cx="110" cy="110" r="4" fill="#6fd3cf"/>
        <!-- forward/back arrow (drive) -->
        <line id="driveArrow" x1="110" y1="110" x2="110" y2="30"
              stroke="#6fd3cf" stroke-width="6" stroke-linecap="round"/>
        <!-- vertical indicator (up/down) as a side bar -->
        <text x="110" y="22" text-anchor="middle" font-size="16">FWD</text>
        <text x="110" y="214" text-anchor="middle" font-size="16">REV</text>
        <text x="16" y="116" font-size="16">L</text>
        <text x="198" y="116" font-size="16">R</text>
      </svg>
    </div>
    <div class="stat" style="margin-top:10px"><div class="label">Vertical</div>
      <div class="value" id="vert">--</div></div>
  </div>

  <div class="row2">
    <div class="card">
      <h2>Controls (Logitech F310 gamepad)</h2>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="stat">
          <div class="label">Driving</div>
          <div class="help">
            <b>Left stick — up/down:</b> vertical thruster (push up = surface, down = dive).<br>
            <b>Right stick — up/down:</b> forward / reverse (both horizontal thrusters together).<br>
            <b>Right stick — left/right:</b> turn (the left and right thrusters drive opposite ways).
          </div>
        </div>
        <div class="stat">
          <div class="label">Gripper</div>
          <div class="help">
            <b>Right trigger (RT):</b> squeeze to close the gripper on an object. It
            <b>keeps holding</b> once you let go of the trigger, so you can carry
            things hands-free; squeezing again only tightens.<br>
            <b>A button:</b> opens the gripper to release / let go.
          </div>
        </div>
        <div class="stat">
          <div class="label">Cruise control</div>
          <div class="help">
            <b>Left trigger (LT):</b> squeeze once to lock all three thruster speeds
            (forward, turn, vertical) so the ROV holds course hands-free; squeeze
            again to turn cruise off. <b>Moving any stick</b> also cancels cruise
            and returns to manual control.
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Thruster channels</h2>
      <table>
        <thead><tr><th>Thruster</th><th>Channel</th><th>Direction</th>
          <th>Power</th><th>PWM (&micro;s)</th></tr></thead>
        <tbody id="channels"></tbody>
      </table>
    </div>
  </div>
</div>

<script>
const names = ["left", "right", "vertical"];
let lastTime = null, staleTicks = 0;

// Point the <img> at the camera stream. Build the URL FROM THE HOSTNAME THE
// BROWSER USED to open this dashboard - so when you open the dashboard at the
// Pi's address, the video loads from that same Pi. (A server-side "localhost"
// would wrongly mean the viewer's own laptop.) An explicit CAMERA_URL override
// passed by the server wins, for the rare case the camera is on another host.
(function () {
  const override = {{ camera_override | tojson }};
  const port = {{ camera_port | tojson }};
  const path = {{ camera_path | tojson }};   // both camera programs serve /video
  const url = override || (window.location.protocol + "//" +
              window.location.hostname + ":" + port + path);
  document.getElementById("camera").src = url;
})();

// Show the Pi's address - the host you opened the dashboard on IS the Pi.
document.getElementById("piaddr").textContent = window.location.hostname;

async function tick() {
  try {
    const r = await fetch("/telemetry", {cache: "no-store"});
    const t = await r.json();
    document.body.classList.toggle("stale", t === null);
    if (t) render(t);
  } catch (e) { /* keep polling */ }
}

function render(t) {
  const tc = t.temperature_c;
  document.getElementById("temp").textContent =
    (tc == null) ? "n/a"
    : tc.toFixed(1) + " °C / " + (tc * 9/5 + 32).toFixed(1) + " °F";
  document.getElementById("armed").textContent = t.armed ? "Yes" : "No";

  const cruise = document.getElementById("cruise");
  cruise.textContent = t.cruise ? "Cruise ON" : "Cruise off";
  cruise.className = "pill " + (t.cruise ? "on" : "off");

  const grip = document.getElementById("grip");
  const closed = (t.gripper_closed || 0);
  const gripping = closed > 0.05;
  grip.textContent = gripping ? ("Gripper holding " + Math.round(closed*100) + "%") : "Gripper open";
  grip.className = "pill " + (gripping ? "on" : "off");

  const ch = t.channels || {};
  // table
  const rows = names.map(n => {
    const c = ch[n]; if (!c) return "";
    return `<tr><td>${n}</td><td>${c.channel}</td><td>${c.direction}</td>
      <td>${c.percent.toFixed(0)}%<div class="bar"><div style="width:${c.percent}%"></div></div></td>
      <td>${Math.round(c.pulse_ms * 1000)} µs</td></tr>`;
  }).join("");
  document.getElementById("channels").innerHTML = rows;

  // dial: left/right throttles make a heading angle; forward leans the arrow up
  const fwd = ((ch.left?.throttle || 0) + (ch.right?.throttle || 0)) / 2;   // -1..1
  const turn = ((ch.left?.throttle || 0) - (ch.right?.throttle || 0)) / 2;  // -1..1
  // Arrow angle: straight up = forward; turn rotates it; magnitude = speed.
  const angle = Math.atan2(turn, Math.max(fwd, 0.001));  // radians from +fwd axis
  const speed = Math.min(1, Math.hypot(fwd, turn));
  const len = 20 + speed * 60;
  const cx = 110, cy = 110;
  // screen: up is -y. forward (fwd>0) -> up. turn>0 (right) -> +x.
  const x2 = cx + Math.sin(angle) * len * (fwd < 0 ? -1 : 1);
  const y2 = cy - Math.cos(angle) * len * (fwd < 0 ? -1 : 1);
  const arrow = document.getElementById("driveArrow");
  arrow.setAttribute("x2", x2.toFixed(1));
  arrow.setAttribute("y2", y2.toFixed(1));
  arrow.setAttribute("stroke", fwd < 0 ? "#f5a623" : "#6fd3cf");

  const v = ch.vertical;
  document.getElementById("vert").textContent =
    v ? (v.direction + " " + v.percent.toFixed(0) + "%") : "--";
}

setInterval(tick, 150);
tick();
</script>
</body>
</html>"""


@click.command()
@click.option("--port", default=8080, show_default=True,
              help="Port to serve the dashboard web page on.")
@click.option("--telemetry-port", default=5006, show_default=True,
              help="UDP port to receive telemetry from rov_server on.")
@click.option("--camera-port", default=8000, show_default=True,
              help="Port the camera stream (stream_server.py) runs on. The "
                   "dashboard builds the video URL from this and whatever host "
                   "the browser used to open the dashboard.")
@click.option("--camera-path", default="/video", show_default=True,
              help="Path the camera server serves the MJPEG stream at. Both "
                   "stream_server.py and camera_simple.py serve /video.")
@click.option("--camera-url", default=None,
              help="Full camera MJPEG URL, ONLY if the camera is on a different "
                   "host than the dashboard. Normally leave this unset so the "
                   "video follows the dashboard's own address.")
def main(port, telemetry_port, camera_port, camera_path, camera_url):
    """Serve the ROV dashboard and listen for telemetry."""
    listener = threading.Thread(target=telemetry_listener,
                                args=(telemetry_port,), daemon=True)
    listener.start()

    app = Flask(__name__)

    @app.route("/")
    def index():
        return render_template_string(PAGE, camera_override=camera_url,
                                      camera_port=camera_port,
                                      camera_path=camera_path)

    @app.route("/telemetry")
    def telemetry():
        with _lock:
            return jsonify(_latest["telemetry"])

    where = camera_url or f"<dashboard host>:{camera_port}{camera_path}"
    click.echo(f"Dashboard on http://0.0.0.0:{port}/  "
               f"(telemetry UDP :{telemetry_port}, camera {where})")
    app.run(host="0.0.0.0", port=port, threaded=True)


if __name__ == "__main__":
    main()
