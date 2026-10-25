# Stereo Vision: Measuring Distance and Size with Two Webcams

A MATE ROV pilot often has to report how far away something is, or how long it
is, without touching it. Two cameras a known distance apart can measure that
from video alone. In this lesson you build a stereo rig from two matching
Logitech webcams and measure real objects from a **web browser** — calibrate and
measure, both on one page.

## What's in this folder

| File | What it is |
|---|---|
| [`stereo_web.py`](stereo_web.py) | The main tool: a web app with two tabs — **Calibrate** and **Measure**. Auto-detects the cameras; runs on the x86 laptop or a Raspberry Pi. |
| [`stereo_measure.py`](stereo_measure.py) | The older desktop version (OpenCV windows instead of a browser). Same math and calibration-file format; kept for reference. |
| [`requirements.txt`](requirements.txt) | The package list, for reference. `setup.sh` / `setup_x86.sh` already install these into the shared venv — you don't install them yourself. |
| [`../start_stereo.sh`](../start_stereo.sh) | One command: starts `stereo_web.py` and opens the browser. |

## How it works

Hold a finger in front of your face and close one eye, then the other. The
finger jumps sideways; something far away barely moves. That sideways jump is
**disparity**, and two cameras produce it just like two eyes.

With the cameras a known distance apart (the **baseline** B, in mm) and a known
**focal length** in pixels (f), an object that appears d pixels further over in
one image than the other is at distance

    Z = f * B / d

**Calibration** finds f, B and the exact tilt between the cameras by
photographing a checkerboard of known size from many angles. OpenCV does the
math; your job is good pictures. The app has two ways to measure:

- **Calibrated mode (accurate).** You calibrate once with the checkerboard; the
  app saves `stereo_calib.npz` and uses it to *rectify* (line up) the two images
  so the matcher is reliable. Use this for real measurements.
- **No-calibration / "quick" mode (`--no-calib`, approximate).** Skips the
  checkerboard and computes depth straight from the baseline and field of view
  you give it. Fast to try, but it does **not** rectify the images, so readings
  are rough and can fluctuate. Good for a first look; not for accuracy.

## Hardware

- Two **matching** webcams. This course uses two **Logitech C270s**. Mixed
  models calibrate badly.
- A rigid bracket holding them parallel and level, lenses a known distance
  apart. The 3D-printed [`../cad/`](../cad) stereo mount does this. Measure the
  **baseline** (centre of lens to centre of lens) with a ruler and write it
  down — calibration should compute the same number within a couple of mm.
- A **9×6 inner-corner** checkerboard with **25 mm squares**, glued to something
  flat. ("Inner corners" are the points where four squares meet — a board
  printed as 10×7 squares has 9×6 inner corners.) Generate one at
  https://calib.io/pages/camera-calibration-pattern-generator
- Objects of known size to test against (PVC cut to 10, 20, 30 cm) and a tape
  measure.

> **Plug the two cameras into USB ports on opposite sides of the laptop.** Two
> C270s on the *same* USB hub can't both stream at full resolution — the bus
> runs out of bandwidth and one camera goes black or drops frames. The app runs
> the cameras at **640×480** specifically so two of them fit; even so, separate
> USB controllers are more reliable. (See Troubleshooting.)

## Setup

You don't install anything for this lesson. On the **x86 laptop**, `setup_x86.sh`
put OpenCV, numpy, and click into the shared virtual environment; on the
**Raspberry Pi 5**, `setup.sh` installed `python3-opencv`, `python3-numpy`, and
`v4l-utils`. In PyCharm, select the shared `~/robotics-lesson/.venv` interpreter;
from a terminal, `source ~/robotics-lesson/.venv/bin/activate` first.

### Check the cameras are seen

```bash
python3 stereo_web.py --list
```

This prints the camera indexes it can open. You normally **don't** need the
indexes, though — the app finds the two C270s by name automatically (next).

## Running it

### The easy way

From the top of the repo:

```bash
./start_stereo.sh
```

It auto-detects the two cameras, starts the web app, and opens the browser to
**http://localhost:8010/**. `./start_stereo.sh stop` stops it. Any option you
add is passed straight through, e.g. `./start_stereo.sh --no-calib`.

### Running it directly

```bash
# Accurate mode (calibrate first, then measure):
python3 stereo/stereo_web.py

# Quick look, no checkerboard (approximate):
python3 stereo/stereo_web.py --no-calib --baseline 100 --hfov 60
```

No `--left`/`--right` needed: the app reads the system's camera list, finds the
two **C270** capture devices, and skips the laptop's built-in webcam. Watch the
startup line — it reports what it found:

```
Auto-detected 'C270' cameras: left=4, right=5
Cameras: left=4 right=5, 640x480
```

(If your cameras report a different name, pass `--match <name>`; to force
specific devices, pass `--left N --right M`.)

Then open **http://localhost:8010/**. The page has two tabs: **Calibrate** and
**Measure**.

### Running it from PyCharm

The app is a normal Python program, so you can run it from PyCharm instead of
the terminal — handy for reading the code alongside it.

- **On the laptop:** open `stereo/stereo_web.py`, make sure the interpreter is
  your **laptop's local Python** (the cameras are plugged into the laptop), then
  click **Run ▶**. To use quick mode, open **Run → Edit Configurations…** and
  put `--no-calib --baseline 100 --hfov 60` in the **Parameters** field. The
  startup line appears in the Run tool window; open http://localhost:8010/ in a
  browser; click the red ■ to stop.
- **On the Pi:** pick the **Pi SSH interpreter** (from the
  [PyCharm lesson](../pycharm/lesson.md)) in the Run configuration, plug the
  cameras into the Pi, and open `http://<pi-ip>:8010/`. The code is the same;
  only *where* it runs changes.

Both the Run button and the terminal do exactly the same thing — use whichever
you like.

## Calibrating (for accurate measurements)

Run **without** `--no-calib` so the app will build and use a calibration:

```bash
python3 stereo/stereo_web.py        # or ./start_stereo.sh
```

On the **Calibrate** tab:

1. Hold the 9×6 checkerboard so **both** cameras see the whole board. The status
   turns green and says **BOTH** when both cameras detect it.
2. Click **Capture pair**. Repeat for **15+ poses**, and *vary every one*: near
   and far, tilted left / right / up / down, and with the board in different
   parts of the frame (corners, edges, centre). Variety is what makes a
   calibration good — don't just hold it flat and centred.
3. Click **Calibrate**. The app reports a quality verdict:
   - **GOOD** — stereo RMS **under 1.0 px**. Trust it.
   - **OK** — RMS 1.0–2.0 px. Usable; recapture for better accuracy.
   - **POOR** — RMS over 2.0 px. Click **Clear pairs** and recapture with more
     varied poses.
   It also prints the computed **baseline** — check it matches your ruler
   measurement (within a couple of mm). It saves `stereo_calib.npz`.

Then switch to the **Measure** tab. Because a calibration now exists, the app
rectifies the images and measurements are stable.

> **Lock the focus.** A webcam's autofocus changes f every time it refocuses,
> which silently breaks the calibration. The app turns autofocus off on Linux;
> if a camera ignores it:
> ```bash
> v4l2-ctl -d /dev/video4 -c focus_automatic_continuous=0 -c focus_absolute=0
> ```
> **Calibrate where you measure.** For the bench project, calibrate on the
> bench. For the ROV, calibrate in the water with the housing sealed — light
> bends at the port, so an in-air calibration gives wrong distances underwater.

## Measuring

On the **Measure** tab you see the live camera with a large distance readout:

1. **Click one point** — its distance appears, large, on the image.
2. **Click a second point** — the line between them shows the object's **size**.
3. A **third click** starts over.

In no-calibration mode the readout is tagged **[quick (no calibration)]** and is
approximate — expect it to wander. For stable, accurate numbers, calibrate first.

Test with the known PVC lengths and record every reading. Wrap plain or shiny
objects in **patterned tape** — a blank, featureless surface gives the matcher
nothing to match, so it reads "no match."

## Accuracy: choosing a baseline

Depth error grows with the **square** of distance:

    ΔZ ≈ Z² · Δd / (f · B)

where Δd is the matcher's error (~0.5 px for a good calibration). Two
consequences:

- **Farther is much worse.** Doubling the distance quadruples the error.
- **A wider baseline helps** (bigger B → smaller error), up to a point — a very
  wide baseline makes *close* objects hard to match.

Rough guide with the C270s at 640×480 (f ≈ 554 px):

| Baseline | Error at 1 m | Error at 3 m | Error at 5 m |
|---|---|---|---|
| 100 mm | ~1.5 cm | ~8 cm | ~23 cm |
| 150 mm | ~1 cm | ~5 cm | ~15 cm |
| 250 mm | ~0.4 cm | ~3 cm | ~9 cm |

For an ROV working mostly within ~3 m, a **150–200 mm baseline** is a good
balance of accuracy and a rig that stays rigid. To do better at long range,
raise the resolution to 1280 wide — but that needs the two cameras on
**separate USB controllers** (bandwidth), and you should raise `numDisparities`
in the code so close objects still match.

Remember: in **calibrated** mode you don't set f or B in software — calibration
*measures* them. You set B physically by how you mount the cameras. The
`--baseline`/`--hfov` flags only matter in `--no-calib` mode.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| One camera panel is **black** | Two C270s starving the USB bus, or the cameras still warming up | Plug the cameras into ports on **different sides** of the laptop (separate USB controllers); the app also waits for both to warm up before serving |
| App opens the **wrong** camera (e.g. the built-in) | Auto-detect matched the wrong device | It skips non-C270s by name; if needed pass `--match` or explicit `--left/--right` (find indexes with `--list`) |
| Camera indexes changed since last time | USB devices renumber on reboot/replug | You don't need indexes — auto-detect finds the C270s by name each run |
| Measure view looks **zoomed / cropped** vs calibrate | A stale/poor `stereo_calib.npz` was rectifying with bad maps | In `--no-calib` the app ignores any saved file; to recalibrate cleanly, delete `stereo/stereo_calib.npz` and calibrate again |
| Distance reads wildly (e.g. 27 m) or **fluctuates** | No rectification (quick mode) or a poor calibration | Do a **GOOD** calibration (RMS < 1.0); quick mode is inherently approximate |
| Computed baseline far from your ruler | Left/right swapped, or bad poses | Recalibrate; if it's mirrored, swap the cameras or `--left/--right` |
| Checkerboard never detected | Blurry, too tilted, or glare | Move slower and closer; whole board visible in **both** views |
| "no match" on the target | Target has no texture | Wrap it in patterned tape |
| Readings drift over time | Autofocus came back on | Re-lock focus (see above) |

## Going further

- Put the rig in a housing and recalibrate in the tank. Compare the focal length
  the calibration reports in air vs. water; the ratio is close to 1.33.
- Stream both cameras from the Pi to the laptop over the tether and measure
  topside (see the [camera lesson](../camera/lesson.md) for MJPEG streaming).
- Put an AprilTag on the target and measure distance with **one** camera using
  `cv2.aruco`. When does each method win?

---

*Not part of the numbered course flow — this is a standalone project you can
take on after the main lessons.*
