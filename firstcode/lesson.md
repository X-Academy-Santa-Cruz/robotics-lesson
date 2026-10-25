# Lesson: Your First Real Code — Run and Read the Dashboard in PyCharm

You've set up Linux, learned git, and configured PyCharm. Before you write any
ROV code of your own, let's do something motivating: **run the finished ROV
dashboard and read its code in PyCharm.** You won't change anything yet — the
goal is to see a real, working program end to end, and to get comfortable
moving around a real codebase in PyCharm.

The dashboard is the "glass cockpit" for the ROV: one web page showing the live
camera, water temperature, each thruster's power, and a heading dial. You'll
build toward every piece of it over the coming lessons. Today you just get it
on screen and poke around the code that makes it work.

> This is a gentle first look. The full dashboard build — telemetry, UDP, and
> extending it — is **Lesson 10** ([`dashboard/`](../dashboard/lesson.md)).
> Here we only run it and read it.

## What you need

- The `robotics-lesson` repo cloned and open in PyCharm (from the
  [git](../git/lesson.md) and [PyCharm](../pycharm/lesson.md) lessons).
- Python working on your **laptop**. The dashboard is a plain web app — it does
  **not** need the Pi, the camera, or any ROV hardware to run. It will just show
  placeholder values (`--`) until real telemetry arrives later, which is fine.
- The shared virtual environment, which `setup.sh` (Pi) or `setup_x86.sh`
  (laptop) already created with Flask and click installed. You don't install
  anything — just select the `~/robotics-lesson/.venv` interpreter in PyCharm
  (see the [PyCharm lesson](../pycharm/lesson.md)).

## Part 1 — Run the dashboard from PyCharm

You'll run this one on your **laptop** with the laptop's own Python (no SSH
needed — there's no hardware involved yet).

1. In PyCharm's **Project** panel (left side), open
   `dashboard/` and double-click **`dashboard.py`** to open it in the editor.
2. Near the top-right, make sure the interpreter is your **laptop's local
   Python**, not the Pi SSH interpreter. (If the only interpreter set up is the
   Pi one from the PyCharm lesson, add a local one: **Settings → Project →
   Python Interpreter → Add Interpreter → Add Local Interpreter**, and pick your
   laptop's Python or a virtual environment.)
3. Right-click anywhere in the editor and choose **Run 'dashboard'** (or click
   the green ▶ button). PyCharm creates a **Run configuration** named
   `dashboard` and starts the program.
4. Look at the **Run** tool window at the bottom. You should see a line like:
   ```
   Dashboard on http://0.0.0.0:8080/  (telemetry UDP :5006, camera <dashboard host>:8000/video)
   ```
5. Open a browser and go to **http://localhost:8080/**. You'll see the dashboard
   page: the camera box (blank — no camera yet), the thruster table and gauges
   showing `--`, and the heading dial. That's the whole app running on your
   laptop.
6. Click the red ■ square in the Run tool window to stop it (the same as
   `Ctrl+C` in a terminal).

### The same thing from the terminal

PyCharm is running a command for you. The equivalent by hand, in PyCharm's
built-in terminal (or any terminal) on the laptop:

```bash
cd dashboard
python3 dashboard.py
```

Then open http://localhost:8080/ and press `Ctrl+C` to stop. Use whichever you
prefer — the Run button and the terminal do exactly the same thing. Throughout
the course we'll show both.

> **Running it on the Pi instead.** Later, the dashboard runs on the Pi next to
> the camera and thrusters. To run it there from PyCharm, you'd pick the **Pi
> SSH interpreter** (from the [PyCharm lesson](../pycharm/lesson.md)) in the Run
> configuration instead of the local one, and open
> `http://<pi-ip>:8080/` in your browser. The code is identical — only *where*
> it runs changes. For today, keep it on the laptop.

## Part 2 — Read the code in PyCharm

Open `dashboard/dashboard.py`. It's about 300 lines, but it's really just four
parts. Find each one — this is the skill: reading a real program by its shape,
not line by line.

### 1. The telemetry listener (a background thread)

Near the top, find:

```python
def telemetry_listener(port):
    """Background thread: receive JSON telemetry packets and keep the newest."""
```

This opens a **UDP socket** and waits for small JSON packets from the thruster
server (`rov_server.py`) with the latest ROV state. It runs on its own thread so
receiving data never freezes the web page. It keeps only the **newest** snapshot
in the shared `_latest` variable.

- **Try it:** Ctrl-click (Cmd-click on Mac) the name `telemetry_listener` where
  it's *used* lower in the file. PyCharm jumps to where it's started as a thread.
  This "go to definition / usage" jumping is how you navigate any codebase.

### 2. The web page (one big HTML string)

Find the line:

```python
PAGE = """<!doctype html>
```

Everything between the triple quotes is the web page — the HTML layout, the CSS
styling (the dark blue theme, the cards, the dial), and the JavaScript that runs
**in the browser**. Scroll through it and find:

- the `<img class="video" ...>` tag — the camera box
- the `<table>` with `id="channels"` — the thruster table
- the `<svg id="dial" ...>` — the heading dial
- the `async function tick()` near the bottom — the browser asks the server for
  fresh telemetry every 150 milliseconds (`setInterval(tick, 150)`) and redraws.

- **Try it:** PyCharm shows a **structure** of the file. Open **View → Tool
  Windows → Structure** (or the Structure tab on the left). Click items to jump
  straight to them instead of scrolling.

### 3. The Flask routes (what the browser can ask for)

Find:

```python
@app.route("/")
def index():
```
and
```python
@app.route("/telemetry")
def telemetry():
```

A **route** is a URL the server answers. `"/"` returns the whole dashboard page.
`"/telemetry"` returns the latest snapshot as JSON — that's exactly what the
browser's `tick()` function fetches. Open http://localhost:8080/telemetry in a
browser while the dashboard is running: you'll see the raw JSON (it says `null`
until telemetry arrives). The page you see is just that data, drawn nicely.

### 4. The command-line options (`main`)

Find the block of `@click.option(...)` lines above `def main(...)`. These are the
settings you can pass when you start it — `--port`, `--telemetry-port`,
`--camera-port`, and so on. Run this in the terminal to see them all:

```bash
python3 dashboard.py --help
```

This is the **click** library, which every program in this course uses for its
command-line options. Seeing `--help` list them is a quick way to understand
what any of our scripts can do.

## Part 3 — Make PyCharm work for you

A few PyCharm habits worth building now, while reading simple code:

- **Go to definition:** Ctrl/Cmd-click any function or variable to jump to where
  it's defined. Ctrl/Cmd-click it again at the definition to see everywhere it's
  used.
- **Search everywhere:** press **Shift** twice and type a name (e.g. `telemetry`)
  to find it anywhere in the project.
- **Structure view:** the outline of the current file, for jumping around.
- **Run window:** the program's output, and the red ■ to stop it.

## Exercises

1. Run `dashboard.py` from PyCharm (laptop interpreter) and open
   http://localhost:8080/ — confirm the page loads with `--` placeholders.
2. Open http://localhost:8080/telemetry in the browser and describe, in one
   sentence, what you see and why it's `null`.
3. Run `python3 dashboard.py --help` and list two options you could change.
4. Run it again with a different web port, e.g. `python3 dashboard.py --port 9000`
   (or add `--port 9000` to the Run configuration's **Parameters** field), and
   open the new address. What changed, and what stayed the same?
5. Using **Go to definition**, find where `telemetry_listener` is started as a
   thread, and explain in one sentence why it runs on a separate thread instead
   of in the web request.
6. In the Structure view, find the `render(t)` JavaScript function inside `PAGE`
   and name one gauge or field it updates.

<!-- course-flow-nav -->
---

### Where this lesson fits

Step 5 of 12 in the course. ← Previous: **PyCharm** (`../pycharm/lesson.md`) &nbsp;&nbsp;|&nbsp;&nbsp; Next: **Debugging** (`../debugging/lesson.md`) →
