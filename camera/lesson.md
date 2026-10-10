# Lesson 1: Streaming Video from a USB Camera

Your ROV is sealed inside its hull underwater — you can't see it. The camera
is how you see what it sees. In this lesson you'll get a live video feed
from a USB camera on the Raspberry Pi showing up in a browser on your
laptop, over the network.

## What you'll build

A small Python program that:

1. Reads frames from the USB camera using **OpenCV**
2. Compresses each frame to a JPEG image
3. Runs a tiny web server that sends a continuous stream of those JPEGs to
   any browser that connects — a format called **MJPEG** (Motion JPEG)

When you're done, opening `http://<pi-ip-address>:8000/` in a browser on
your laptop will show the live camera feed, updating continuously, with the
Pi doing all the work and your laptop just displaying the result.

There are **two programs** in this folder that do the same basic job:

| File | For | What it is |
|---|---|---|
| [`camera_simple.py`](camera_simple.py) | Learning | The beginner version. Short, uses Flask, a comment on almost every line. Start here. |
| [`stream_server.py`](stream_server.py) | The real ROV | The advanced version. Reads the camera on a background thread, serves several viewers at once, and takes command-line options (via `click`). |

## Getting the code: clone the repository

All the lessons live in one Git repository. Clone it once onto whatever
machine you're working on (your laptop, and/or the Pi). You need Git
installed first — see the [Git lesson](../git/lesson.md) if `git` isn't set
up yet.

```bash
# Clone over HTTPS (works for everyone)
git clone https://github.com/X-Academy-Santa-Cruz/robotics-lesson.git

# Go into the camera lesson
cd robotics-lesson/camera
```

> **Already cloned it before?** Don't clone again — just update your copy:
> ```bash
> cd robotics-lesson
> git pull
> ```

If your team uses SSH keys with GitHub, you can clone with SSH instead:

```bash
git clone git@github.com:X-Academy-Santa-Cruz/robotics-lesson.git
```

## Why stream over the network instead of showing it on the Pi?

The Pi is going to be sealed inside the ROV with no monitor attached. The
only way to see its camera is to send the video *off* the Pi, over the
tether/network, to a laptop at the surface. This is exactly how real ROVs
work — everything the pilot sees comes over a network or tether connection,
not from a screen on the vehicle itself.

## Background: how a digital camera becomes a browser-friendly video

1. **The camera hardware** shows up on Linux as a device file, typically
   `/dev/video0` (or `/dev/video1`, etc. if you have more than one camera).
   Index `0` is what you'll pass to OpenCV to say "use this camera."

2. **OpenCV's `cv2.VideoCapture`** talks to that device and gives you
   frames — each one is just a grid of pixel values (a NumPy array), the
   same as a photo.

3. **JPEG compression** (`cv2.imencode`) squeezes each frame down to a much
   smaller size. Raw video is too large to send efficiently; JPEG trades a
   little image quality for a huge reduction in data size, which matters a
   lot on a network link.

4. **MJPEG over HTTP** is a trick that's been around for decades: instead of
   a video *file*, the server keeps one HTTP response open forever and
   keeps writing new JPEG images into it, one after another, each separated
   by a marker called a **boundary**. A browser showing that response in an
   `<img>` tag just keeps redrawing the image as new ones arrive — which
   looks exactly like video.

## Install the libraries

You need three things: **pip3** (Python's package installer), and the Python
modules the programs use (OpenCV, Flask, click). On the Raspberry Pi (and any
Ubuntu machine) the simplest way is with `apt-get`.

### 1. Install pip3

```bash
sudo apt-get update
sudo apt-get install python3-pip
```

### 2. Install the Python modules with apt-get (recommended on the Pi)

Installing the modules through `apt-get` gets versions already built for the
Pi, which is faster and avoids compile errors:

```bash
sudo apt-get install python3-opencv python3-flask python3-click
```

That's everything the two programs need:

| Module | apt package | Used by |
|---|---|---|
| OpenCV | `python3-opencv` | both programs (reads the camera, makes JPEGs) |
| Flask | `python3-flask` | `camera_simple.py` (the web server) |
| click | `python3-click` | `stream_server.py` (command-line options) |

Once these are installed you can skip straight to running the programs.

### Alternative: pip and a virtual environment

If you'd rather keep this lesson's packages separate from the rest of your
system (or you're not on Ubuntu), use a virtual environment and `pip`
instead. Do this once, inside the `camera` folder:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

That installs the same three modules from `requirements.txt`. With a
virtual environment you run the programs with `venv` activated (your prompt
shows `(venv)`); run `deactivate` when you're done.

## Start here: the simple version (`camera_simple.py`)

Open [`camera_simple.py`](camera_simple.py) in PyCharm and read it top to
bottom — almost every line is commented. In short:

- `make_frames()` grabs a frame from the camera, compresses it to a JPEG,
  and `yield`s it with the `--frame` boundary marker.
- The `/` route serves a tiny HTML page whose `<img>` points at `/video`.
- The `/video` route returns the never-ending stream of JPEGs, under the
  header `multipart/x-mixed-replace; boundary=frame`, which tells the
  browser "keep replacing the image with each new one I send."

Run it on the Pi:

```bash
python3 camera_simple.py
```

Now open `http://<pi-ip-address>:8000/` in a browser **on your laptop**
(not the Pi). You should see the live camera feed. Press `Ctrl+C` in the
terminal to stop the server. Find the Pi's address with `hostname -I` on
the Pi.

## The advanced version (`stream_server.py`)

Once the simple version makes sense, open
[`stream_server.py`](stream_server.py). It does the same job but adds the
things you'd want on a real competition ROV.

### `Camera` — grabbing frames in the background

```python
self._thread = threading.Thread(target=self._capture_loop, daemon=True)
```

Reading from a camera can momentarily block while waiting for the next
frame. If we only read a frame when a browser asks for one, every viewer
would be stuck waiting on the camera hardware. Instead, a **background
thread** continuously reads frames and stores only the most recent one.
When a browser asks for a frame, it instantly gets whatever's already
there — no waiting on the camera.

A `threading.Lock` guards the shared `_latest_jpeg` variable so the capture
thread and the web server thread never read/write it at the exact same
instant and corrupt it.

### `StreamingHandler` — the web server side

This is built on Python's standard `http.server`. Two URLs are handled:

- `/` returns a tiny HTML page containing `<img src="/stream.mjpg">` — the
  page your browser actually opens.
- `/stream.mjpg` is the actual video stream. The key line is the
  `multipart/x-mixed-replace` header, same idea as the simple version, then
  it writes `boundary + headers + one JPEG` over and over until the browser
  disconnects.

### `ThreadingHTTPServer`

A plain `HTTPServer` can only handle one connection at a time. Since the
video stream holds its connection open indefinitely, a second viewer (or
even just reloading the page) would hang forever waiting for the first
connection to finish. `ThreadingHTTPServer` spins up a new thread per
connection so multiple people can view the stream at once.

### `main()` and command-line options with `click`

The `@click.command()` and `@click.option(...)` decorators on `main()` turn
camera index, port, and frame size into command-line options — so you can
change them without editing the file — and give you a `--help` message for
free:

```bash
python3 stream_server.py                      # defaults: camera 0, port 8000, 640x480
python3 stream_server.py --width 320 --height 240   # smaller + lower latency
python3 stream_server.py --camera 1           # use the second camera
python3 stream_server.py --help               # list every option
```

On `Ctrl+C` it shuts the server down and releases the camera cleanly.

## If it doesn't work

| Problem | Likely cause |
|---|---|
| `Could not open camera 0` | Camera isn't plugged in, or it's `/dev/video1` instead — try `--camera 1` (advanced) or `cv2.VideoCapture(1)` (simple) |
| `Permission denied` opening the camera | Your user isn't in the `video` group — see the shell lesson, section 5 |
| Page loads but never shows an image | Check the Pi's firewall isn't blocking port 8000; confirm you used the Pi's IP, not `localhost`, from your laptop |
| Laptop can't reach the Pi's IP at all | Confirm both devices are on the same network; re-check `hostname -I` on the Pi |

## Measuring real-world latency with a phone

**Latency** is the delay between something happening in front of the camera
and you actually seeing it on your laptop screen — capture, JPEG encoding,
network transfer, and browser decoding all take a small amount of time. For
piloting an ROV, high latency is the difference between "I see a wall and
stop in time" and "I see a wall after I've already hit it," so it's worth
measuring, not just assuming it's small.

You can't measure this with a regular stopwatch, because by the time you
read the stopwatch and compare it to the screen, you've introduced your own
reaction-time error. The trick is to capture *both* the real time and the
delayed time **in a single photo**, using a second phone.

### What you need

- The ROV's USB camera, running one of the programs, viewed in a browser on
  your laptop
- A phone showing a **millisecond stopwatch** (many free stopwatch apps show
  `MM:SS.mmm`; a web search for "online millisecond stopwatch" also works in
  a mobile browser)
- A second phone (or anyone's phone camera) to take the measurement photo

### Steps

1. Start the millisecond stopwatch on the first phone and let it run
   continuously.
2. Point the USB camera directly at that phone's screen, close enough that
   the numbers are sharp and readable in the stream.
3. On your laptop, open the stream (`http://<pi-ip-address>:8000/`) so it's
   clearly visible — you're now looking at a video of a stopwatch, running
   slightly behind the real one.
4. Using the **second phone**, take a single photo that frames **both**
   screens at once: the original stopwatch phone, and the laptop screen
   showing the stream. Both timestamps need to be sharp enough to read in
   the photo.
5. Zoom into the photo and read both timestamps. The real stopwatch will
   read a later (bigger) time than the one visible in the stream on the
   laptop — that difference **is** your end-to-end latency, in
   milliseconds.

### Why this works

Both numbers exist at the exact same instant: the instant the measurement
photo's shutter opens. One of them traveled straight to your eye at the
speed of light (basically instant); the other traveled through the entire
camera → Pi → network → browser pipeline you just built, which takes
measurably longer. The photo freezes both of them side by side so you can
read the gap directly, instead of trying to perceive it in real time.

### Things to try

- Take several photos and average the readings — a single measurement can
  be off by a frame or two.
- Repeat at your original resolution and again at the smaller `320x240`
  resolution (`--width 320 --height 240`). Lower resolution means less data
  to encode and send per frame, so you should measure *lower* latency — the
  same tradeoff you noticed in smoothness, now with a number attached to it.
- Try it on a slow/congested Wi-Fi network vs. a direct wired connection to
  see the network's contribution to the delay.

## Exercises

1. Run **both** programs and view the stream from your laptop's browser.
   Notice they look the same in the browser even though the code is quite
   different.
2. Shrink the resolution with `--width 320 --height 240` (advanced version)
   and notice how much smoother the stream looks on a slow network — the
   same bandwidth-vs-quality tradeoff real ROV pilots deal with.
3. Open the stream in two browser tabs at once and confirm both update —
   this works with `stream_server.py` because of `ThreadingHTTPServer`. Try
   it with `camera_simple.py` and see the difference.
4. Add a `--fps` command-line option to `stream_server.py` that controls the
   `time.sleep(1 / 30)` value instead of hard-coding 30.
5. Measure the stream's end-to-end latency using the phone-photo method
   above, at two different resolutions, and record both numbers.
