# Lesson: PyCharm for Remote ROV Development

So far you've edited files and run commands by hand over SSH. PyCharm wraps
all of that in one tool: an editor with error-checking and autocomplete, a
built-in git client, a debugger, and — because you have **PyCharm
Professional** — the ability to run and debug code that lives on the Pi,
without manually copying files back and forth every time.

## 1. Opening the project

1. Clone the repo first if you haven't (see the [git lesson](../git/lesson.md)).
2. In PyCharm: **File \> Open...** and select the `robotics-lesson` folder.
3. If prompted "Trust and Open Project?", choose **Trust Project** — this
   lets PyCharm run helper tools (like code inspections) for this project.

The repo already ships a PyCharm project (a small, shared `.idea/` is committed),
so it opens as **one project covering every lesson**, all using the **same
interpreter**. That interpreter is named **`robotics-lesson venv`** and points at
the shared course virtual environment. You don't make a project or a venv — you
just connect that one named interpreter to the actual venv once (next). Your own
PyCharm settings (window layout, local run history) are *not* committed, so you
won't clash with classmates.

## 2. Pointing the shared interpreter at the Pi's venv

Your laptop doesn't have a USB camera plugged into *it* — the Pi does. So
code that imports `cv2` and opens the camera needs to actually **run on the
Pi**, not on your laptop. PyCharm Professional can do this directly, and the
course project is already set up to use one shared interpreter named
`robotics-lesson venv` for every lesson — you just tell PyCharm what that name
points to:

1. **Settings/Preferences \> Project: robotics-lesson \> Python Interpreter**
2. **Add Interpreter \> On SSH...**
3. Enter the Pi's address (`hostname -I` from the shell lesson), your
   username, and password (or SSH key).
4. PyCharm will ask where to sync files on the Pi — this creates a
   **deployment mapping**: your local `robotics-lesson` folder on your
   laptop is mirrored to a folder on the Pi.
5. Point the interpreter at the **shared course virtual environment** that
   `setup.sh` created on the Pi: `~/robotics-lesson/.venv/bin/python`. When
   PyCharm asks for the interpreter's name, call it **`robotics-lesson venv`** so
   it matches the name the committed project already uses — then every lesson
   picks it up automatically. It was built with `--system-site-packages`, so it
   sees both the apt modules and the pip-only libraries `setup.sh` installed.

Once this is set up, PyCharm's autocomplete and error-checking reflect what's
actually installed *on the Pi*, and you're ready to run code there. **This is the
only interpreter setup you do for the whole course** — every lesson shares it.

> **Laptop-only lessons.** A few lessons run on the laptop, not the Pi (the
> [First Code](../firstcode/lesson.md) dashboard look, [stereo](../stereo/lesson.md),
> and `pilot.py` in the [control lesson](../control/lesson.md)). For those, add a
> **local** interpreter pointed at the laptop's own
> `~/robotics-lesson/.venv/bin/python` (made by `setup_x86.sh`) and pick it in
> that script's Run configuration. Same shared venv idea, just on the laptop.

### Deployment sync vs. git — don't mix these up

With a remote interpreter, PyCharm automatically copies your local files to
the Pi every time you click Run or Debug, so your edits take effect
immediately without a manual step. **This is not the same as git.**
Deployment sync keeps the Pi's working copy up to date for testing; it does
not save history, and nobody else sees it. Committing and pushing (next
section) is still how your work is actually saved and submitted. Expect to
use both: deployment sync constantly while iterating, commit/push at
meaningful checkpoints.

## 3. Running code on the Pi from PyCharm

1. Open `camera/stream_server.py`.
2. Right-click in the editor and choose **Run 'stream_server'**, or use the
   green ▶ button in the top right. PyCharm uploads the current files to
   the Pi and runs the script there, using the remote interpreter.
3. Watch the **Run** tool window at the bottom — this is the Pi's console
   output, piped back to your laptop. You should see the same
   `Streaming at http://...` message as when you ran it manually over SSH.
4. Open that address in your browser exactly as before.
5. Click the red ■ square in the Run tool window to stop it — this is the
   same as `Ctrl+C` in a terminal.

You no longer need a separate SSH terminal window open to run the script —
PyCharm is doing that for you.

## 4. Running multiple scripts at once (multiple Run configurations)

The [networked control lesson](../control/lesson.md) needs **two** scripts
running on the Pi at the same time: the camera stream and the control
listener. Clicking Run on `camera/stream_server.py` creates a **Run
configuration** for it automatically (visible in the dropdown at the top
of the window, next to the Run/Debug buttons). Clicking Run on
`control/rov_server.py` creates a second, separate one. Each configuration
remembers its own script, its own interpreter, and its own command-line
arguments.

### One interpreter for every script

Because the whole course shares a single virtual environment
(`~/robotics-lesson/.venv`), every script uses the **same** remote
interpreter — the one you set up in step 5. `stream_server.py`,
`rov_server.py`, `thruster_control.py`, and the I2C lessons all import from
the same venv, which has every package they need. There's no second
interpreter to add. If a script ever reports `ModuleNotFoundError`, it almost
always means the interpreter isn't the shared venv (or `setup.sh` didn't
finish) — check the interpreter is `~/robotics-lesson/.venv`, and re-run
`setup.sh` on the Pi if a package really is missing. You never pip-install
packages per lesson; `setup.sh` is the one place software gets installed.

To run both at once:

1. Run `camera/stream_server.py` as usual. Its output appears in a tab in
   the **Run** tool window at the bottom, and it keeps running.
2. Without stopping it, select `rov_server.py` from the configuration
   dropdown and click Run again. It opens in a **second tab** in the same
   Run tool window — both scripts are now running on the Pi simultaneously,
   each with its own console output and its own red ■ stop button.

You can switch between tabs to watch either one's output, and stop either
independently without affecting the other. This is the PyCharm equivalent
of opening two separate SSH terminals — just without needing two terminals.

### Naming and organizing configurations

By default, configurations are named after the script. With several
scripts in play, rename them to something clearer: **Run \> Edit
Configurations...**, select one, and change its **Name** field (e.g. "Pi:
camera stream", "Pi: rov control"). This also shows you every setting a
configuration holds — script path, working directory, interpreter, and any
command-line arguments (useful for `rov_server.py --port 5005` or
`pilot.py`'s required `pi_address` argument) — all set once instead of
retyped every run.

### A note on `pilot.py`

`pilot.py` runs on your **laptop**, reading your laptop's game controller —
not on the Pi. Give it its own Run configuration using your laptop's local
Python interpreter (not the SSH remote one), the same way you'd run any
ordinary local script.

## 5. Git integration

Everything from the [git lesson](../git/lesson.md) is available through the
UI instead of typing commands. The commands still work in PyCharm's
built-in terminal too — this is just another way to do the same thing.

| Command-line | PyCharm equivalent |
|---|---|
| `git status` / `git diff` | **Commit** tool window (left sidebar) — lists every changed file; double-click one to see a color-coded diff |
| `git add` + `git commit` | Check the files you want in the Commit window, write a message, click **Commit** |
| `git push` | **Commit and Push...**, or the ⬆ push button in the toolbar |
| `git pull` | The ⬇ update button in the toolbar |
| `git log` | Right-click a file \> **Git \> Show History** |
| `git checkout -- <file>` | Right-click the file in the Commit window \> **Rollback** |

If you ever get a merge conflict, PyCharm opens a three-panel merge tool
(your version / the incoming version / the result) instead of making you
hand-edit conflict markers in a text editor.

## 6. Debugging

This gives you a powerful alternative to `print()` statements — though not
a replacement for them; see the [debugging lesson](../debugging/lesson.md)
for when each one fits better. Since your remote interpreter runs the code
on the Pi, debugging in PyCharm means **pausing code while it's actually
running on the Pi** and looking inside it from your laptop.

### Breakpoints

Click in the left margin next to a line number to set a breakpoint (a red
dot appears). For example, set one on the line inside `_capture_loop` that
reads:

```python
ok, frame = self.capture.read()
```

Then click the green **bug icon** (▶ with a bug) instead of the plain Run
button — this starts the same script, but in **debug mode**.

### What happens when it hits the breakpoint

Execution pauses exactly at that line, before it runs. The bottom panel
switches to:

- **Variables** — every variable currently in scope, and you can expand
  `frame` to see its shape and values (it's a NumPy array — the actual
  pixel data from the camera at that instant)
- **Frames** (call stack) — which function called which, up to this point
- Step controls:
  - **Step Over** — run this line, pause before the next one
  - **Step Into** — if this line calls a function, follow execution inside it
  - **Step Out** — finish the current function and pause back in its caller
  - **Resume Program** — stop pausing, run normally until the next breakpoint

### Watches and conditional breakpoints

- In the **Watches** panel, add an expression (like `frame.shape`) to track
  its value every time you pause, without manually expanding variables.
- Right-click a breakpoint and add a **condition** (e.g. `not ok`) so
  execution only pauses when that condition is true — useful for catching a
  rare failure instead of stopping on every single frame.

### A caution specific to this project

`_capture_loop` runs continuously in a background thread the whole time the
server is up. If you leave a breakpoint in it and don't resume, the camera
stops producing new frames and the stream in your browser will freeze —
that's expected, not a bug. Click **Resume Program** to get it flowing
again.

## Exercises

1. Configure the SSH remote interpreter pointing at your Pi.
2. Run `stream_server.py` from PyCharm (not the terminal) and confirm the
   stream still works in your browser.
3. Change the default `--port` value in the script, run it with **Debug**
   instead of Run, and set a breakpoint on the `main()` line that creates
   the `Camera` object — confirm in the Variables panel that `args.port`
   shows your new value.
4. Use PyCharm's Commit tool window to commit and push that change.
5. Set a conditional breakpoint on `ok, frame = self.capture.read()` with
   the condition `not ok`, and explain (in a comment or to your instructor)
   what situation would actually trigger it.
6. Create Run configurations for both `camera/stream_server.py` and
   `control/rov_server.py`, rename them something clear, and start both at
   once. Confirm you can see two separate tabs in the Run tool window and
   stop one without affecting the other.

<!-- course-flow-nav -->
---

### Where this lesson fits

Step 4 of 12 in the course. ← Previous: **Git Basics** (`../git/lesson.md`) &nbsp;&nbsp;|&nbsp;&nbsp; Next: **First Code (Dashboard)** (`../firstcode/lesson.md`) →
