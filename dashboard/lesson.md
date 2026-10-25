# Lesson: The ROV Dashboard (advanced)

The dashboard is one web page that shows everything the pilot wants at a
glance: the live camera, the water temperature, each thruster's PWM and power,
a dial of which way the ROV is driving, and whether cruise control and the
gripper's grip are active. It's the "glass cockpit" for your ROV.

This is an **advanced** project: it ties together the camera, the thrusters,
the sensor, and networking, and introduces streaming **telemetry** between two
programs. There's a full working app in this folder ([`dashboard.py`](dashboard.py));
read it top to bottom and then extend it.

## How the pieces fit together

```
        Pi                                         Laptop
        --                                         ------
thrusters  <--  rov_server.py  --(telemetry, UDP :5006)-->  dashboard.py  --(web, :8080)-->  browser
camera     -->  stream_server.py  --------(MJPEG video, HTTP :8000)------------------------>  browser
```

Two independent data paths, same idea as the piloting lesson:

- **Telemetry** is a small JSON packet `rov_server.py` sends over a **UDP
  socket** every control cycle: the per-channel PWM, power percent and
  direction, the temperature, and the cruise / gripper state. `dashboard.py`
  listens for it and keeps the latest one.
- **Video** is the camera lesson's MJPEG stream, embedded straight into the
  page by URL. The camera is opened once (by `stream_server.py`), so the
  dashboard never fights it for the camera device.

The browser then polls the dashboard's `/telemetry` endpoint a few times a
second and redraws the gauges, table, and dial.

## Why UDP for telemetry

Telemetry is exactly like the control commands: a steady stream of "here's the
state right now." If one packet is lost, the next one (a fraction of a second
later) has fresh numbers anyway, so there's no reason to pay for guaranteed,
in-order delivery. That's the same reasoning that made UDP the right choice for
piloting — see the [control lesson](../control/lesson.md).

## Running it

You need three programs up. On the **Pi**, with the shared venv active:

```bash
source ~/robotics-lesson/.venv/bin/activate

# 1. the camera stream (camera lesson)
cd ~/robotics-lesson/camera && python3 stream_server.py &

# 2. the thruster listener, now also sending telemetry to the dashboard.
#    Point it at wherever the dashboard runs (here, the laptop's IP).
cd ~/robotics-lesson/thrusters && \
  python3 ../control/rov_server.py --telemetry-host <laptop-ip>
```

Then run the **dashboard** — on the laptop or the Pi — pointing it at the
camera stream:

```bash
cd ~/robotics-lesson/dashboard
python3 dashboard.py
```

Open **http://<dashboard-machine-ip>:8080/** in a browser. Pilot with
`pilot.py` as usual and watch the gauges move.

### Running it in PyCharm

You already met this program in the [First Code lesson](../firstcode/lesson.md),
where you ran it on the **laptop** with the laptop's local interpreter. For the
full ROV it usually runs **on the Pi** instead, next to the camera and thruster
server — same code, different interpreter:

- **Dashboard on the Pi:** give `dashboard/dashboard.py`'s Run configuration the
  **Pi SSH interpreter**, run it, and open `http://<pi-ip>:8080/`.
- **Dashboard on the laptop:** use the **laptop's local interpreter** and open
  `http://localhost:8080/` (then pass `--camera-url` only if the camera is on the
  Pi).

Put any options (`--telemetry-host`, `--port`, …) in the Run configuration's
**Parameters** field. With the camera stream and `rov_server.py` as their own Run
configurations (see the [PyCharm](../pycharm/lesson.md) and
[control](../control/lesson.md) lessons), you can bring the whole stack up from
one PyCharm window. The Run button and the terminal commands above do the same
thing.

### Options

| Program | Option | What it does |
|---|---|---|
| `rov_server.py` | `--telemetry-host` | where to send telemetry (the dashboard's IP) |
| `rov_server.py` | `--telemetry-port` | telemetry UDP port (default 5006) |
| `dashboard.py` | `--camera-port` | port the camera stream uses (default 8000); the video URL is built from this and the host you opened the dashboard on |
| `dashboard.py` | `--camera-path` | stream path (default `/video`, which both camera programs serve) |
| `dashboard.py` | `--camera-url` | only if the camera is on a different host than the dashboard; a full MJPEG URL |
| `dashboard.py` | `--telemetry-port` | UDP port to receive telemetry on (match the server) |
| `dashboard.py` | `--port` | web port for the dashboard page (default 8080) |

## Reading the code

- **`telemetry_listener`** runs in a background thread so receiving UDP packets
  never blocks the web server. It keeps only the newest snapshot.
- **`rig.telemetry()`** (in the thrusters lesson) builds the per-channel data:
  it remembers the last throttle set on each channel and converts it to a
  pulse width, a power percent, and a direction word.
- The **dial** is drawn in the browser with SVG: the left/right throttles are
  combined into a heading angle and the arrow length shows speed; it turns
  amber when driving in reverse.

## If it doesn't work

| Problem | Likely cause and fix |
|---|---|
| Page loads but gauges say `--` | No telemetry arriving — check `rov_server.py`'s `--telemetry-host` is this machine's IP and the ports match. |
| Video box is blank | `stream_server.py` isn't running — open `http://<same-host>:8000/video` directly in a browser to check. Both camera programs serve the stream at `/video`. The video follows the dashboard's host automatically; only use `--camera-url` if the camera is on another machine. |
| `Address already in use` | Another program has the port — stop it, or pass a different `--port` / `--telemetry-port`. |
| Temperature shows `n/a` | No sensor on the bus (that's fine) — the dashboard just omits it. |

## Exercises

1. Add a **depth** or **battery voltage** field to the telemetry in
   `rov_server.py` and show it on the dashboard.
2. Make the dial also show the **vertical** thruster (e.g. a second indicator
   for up/down).
3. Log every telemetry packet to a file with a timestamp, so you can replay a
   dive afterward.
4. Turn a channel's power bar **red** when it's above, say, 80%.
5. (Advanced) Replace the browser's polling with **server-sent events** (SSE)
   so the page updates the instant a packet arrives.

<!-- course-flow-nav -->
---

### Where this lesson fits

Step 11 of 12 in the course. ← Previous: **Networked Control (Piloting)** (`../control/lesson.md`) &nbsp;&nbsp;|&nbsp;&nbsp; Next: **Autonomous Driving (AI project)** (`../autopilot/lesson.md`) →
