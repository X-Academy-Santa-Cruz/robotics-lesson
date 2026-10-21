# Stereo Vision: Measuring Distance and Size with Two Webcams

A MATE ROV pilot often has to report how far away something is, or how long
it is, without touching it. Two cameras a known distance apart can do that
measurement from video alone. In this lesson you build a stereo rig from two
matching Logitech webcams, calibrate it, and measure real objects.

This folder holds the mentor's reference implementation. In the three-hour
classroom version of this project, students use an AI assistant to write
their own `measure.py` one step at a time and compare it against this one.
The full session plan, AI prompting rules, rubric and troubleshooting table
are in the lesson document *Stereo Vision Project: Measuring Distance and
Size with Two Webcams and AI-Assisted Python*.

## What's in this folder

| File | What it is |
|---|---|
| [`stereo_measure.py`](stereo_measure.py) | One script, three modes: `list` cameras, `calibrate`, `measure`. Runs on a Mac or a Raspberry Pi 5. |
| [`requirements.txt`](requirements.txt) | Packages for a Mac. The Pi uses the apt packages from `setup.sh`. |

## How it works

Hold a finger in front of your face and close one eye, then the other. The
finger jumps sideways; something far away barely moves. That sideways jump
is **disparity**, and two cameras produce it just like two eyes.

With the cameras a known distance apart (the **baseline** B) and a known
**focal length** in pixels (f), an object that appears d pixels further left
in the right image than in the left is at distance

    Z = f * B / d

**Calibration** finds f, B and the exact tilt between the cameras by
photographing a checkerboard of known size from many angles. OpenCV does the
math; your job is good pictures.

**Lock the focus.** A webcam's autofocus changes f every time it refocuses,
which silently breaks the calibration. Set focus once, by hand, and leave it.

**Calibrate where you measure.** For the bench project, calibrate on the
bench. For the ROV, calibrate in the water with the housing sealed: light
bends at the port, so an in-air calibration gives wrong distances underwater.

## Hardware

- Two **matching** webcams (both C920, or both C922). Mixed models calibrate badly.
- A rigid bracket holding them parallel, lenses 60 to 100 mm apart. Measure the
  baseline with a ruler and write it down; calibration should compute the
  same number within 2 mm.
- A 9×6 inner-corner checkerboard with 25 mm squares, glued to something flat.
  Generate one at https://calib.io/pages/camera-calibration-pattern-generator
- Objects of known size to test against (PVC cut to 10, 20, 30 cm) and a tape measure.

## Setup on a Mac

```bash
cd stereo
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 stereo_measure.py list
```

The first run asks for camera permission. Allow it for Terminal (or PyCharm)
under System Settings → Privacy & Security → Camera, then run `list` again.
The script defaults to left = 0 and right = 1. On a Mac with a built-in camera,
index 0 may be the FaceTime camera and the webcams 1 and 2; if `list` shows
that, pass `--left 1 --right 2`.
Plug them into different USB ports if one refuses to open.

macOS does not let OpenCV change a webcam's focus. Lock it with Logitech's
app (G HUB or Logi Tune), or:

```bash
brew install uvc-util
uvc-util -I 1 -s auto-focus=0 -s focus-abs=0   # repeat with -I 2
```

Right-click in the window is ctrl-click on a trackpad; pressing `c` also clears.

## Setup on the Raspberry Pi 5

`setup.sh` already installs `python3-opencv`. Add the camera tools and find
the indexes:

```bash
sudo apt install -y v4l-utils
v4l2-ctl --list-devices
python3 stereo_measure.py list
```

Each camera appears as two `/dev/videoN` entries; use the one that `list`
prints a size for (often 0 and 2, in which case pass `--right 2`). Plug each camera into a different port.
The script locks focus and exposure itself on Linux; if a camera ignores it:

```bash
v4l2-ctl -d /dev/video0 -c focus_automatic_continuous=0 -c focus_absolute=0
```

## Running it

**1. Calibrate**

```bash
python3 stereo_measure.py calibrate
```

Hold the checkerboard so both cameras see all of it. Press SPACE when both
show coloured corners. Collect at least 15 pairs at 30, 50 and 80 cm, tilted
left, right, up and down, and in the corners of the frame. Press `c` to
calibrate. Good results: stereo RMS under 1.0 px, baseline within 2 mm of
your ruler. Otherwise delete the blurry pairs and go again.

**2. Measure**

```bash
python3 stereo_measure.py measure
```

Left-click a point: its distance appears in cm. Click a second point: the
line between them shows the object's size. The right panel is the disparity
map; red is close, blue is far, black is no match. Blank walls and shiny
surfaces give no match, so wrap test objects in patterned tape.

Aim for 5% at 50 cm. Test with the PVC lengths and record every reading.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Only one camera opens | Both on the same USB hub, or wrong index | Different ports; run `list` |
| Video stutters | Camera fell back to uncompressed YUYV | MJPG is set in `open_camera`; drop to 640×480 if it persists |
| Checkerboard never detected | Blurry, too tilted, or glare | Move slower and closer; whole board in both frames |
| Stereo RMS over 1.5 px | Blurry pairs, or cameras moved | Delete bad pairs; check the bracket for flex |
| Computed baseline far from measured | Left and right swapped | Swap `--left` and `--right`, recalibrate |
| Readings drift | Autofocus came back on | Re-lock focus; on a Mac, check the Logitech app didn't reset it |
| "no match" everywhere | Target has no texture, or `numDisparities` too small | Patterned tape; raise `numDisparities` in steps of 16 |
| Under 5 fps on the Pi | SGBM at 720p on the CPU | Set `FRAME_W, FRAME_H = 640, 480` |

## Going further

- Put the rig in a housing and recalibrate in the tank. Compare the focal
  length the calibration reports in air and in water; the ratio is close to 1.33.
- Stream both cameras from the Pi to the laptop over the tether and run
  `measure` topside (see the camera lesson for MJPEG streaming).
- Put an AprilTag on the target and measure distance with one camera using
  `cv2.aruco`. When does each method win?
