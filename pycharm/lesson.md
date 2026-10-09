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

## 2. Setting up a remote interpreter on the Pi

Your laptop doesn't have a USB camera plugged into *it* — the Pi does. So
code that imports `cv2` and opens the camera needs to actually **run on the
Pi**, not on your laptop. PyCharm Professional can do this directly:

1. **Settings/Preferences \> Project: robotics-lesson \> Python Interpreter**
2. **Add Interpreter \> On SSH...**
3. Enter the Pi's address (`hostname -I` from the shell lesson), your
   username, and password (or SSH key).
4. PyCharm will ask where to sync files on the Pi — this creates a
   **deployment mapping**: your local `robotics-lesson` folder on your
   laptop is mirrored to a folder on the Pi.
5. Point the interpreter at the virtual environment you already created
   for that lesson on the Pi - `camera/venv/bin/python3` for the camera
   lesson, for example - or let PyCharm create a fresh one and install
   that folder's `requirements.txt` for you.

Once this is set up, PyCharm's autocomplete and error-checking reflect what's
actually installed *on the Pi*, and you're ready to run code there.

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

### Different scripts, different interpreters

`stream_server.py` needs the packages installed in `camera/venv`;
`rov_server.py` imports `ThrusterRig`, which needs the packages installed
in `thrusters/venv` instead (see the [control lesson](../control/lesson.md)
for why it reuses that venv rather than its own). Repeat the SSH
interpreter setup from step 5 above to add a **second** remote interpreter
pointing at `thrusters/venv/bin/python3`, then open **Run \> Edit
Configurations...** and set each script's configuration to use the
matching interpreter. Running the wrong one gives you a familiar error -
`ModuleNotFoundError` - which is PyCharm telling you the selected
interpreter doesn't have that package installed, the same as it would from
a terminal.

To run both at once:

1. Run `camera/stream_server.py` as usual. Its output appears in a tab in
   the **Run** tool window at the bottom, and it keeps running.
2. Without stopping it, select `rov_server.py` from the configuration
   dropdown and click Run again. It opens in a **second tab** in the same
   Run tool window - both scripts are now running on the Pi simultaneously,
   each with its own console output and its own red ■ stop button.

You can switch between tabs to watch either one's output, and stop either
independently without affecting the other. This is the PyCharm equivalent
of opening two separate SSH terminals - just without needing two terminals.

### Naming and organizing configurations

By default, configurations are named after the script. With several
scripts in play, rename them to something clearer: **Run \> Edit
Configurations...**, select one, and change its **Name** field (e.g. "Pi:
camera stream", "Pi: rov control"). This also shows you every setting a
configuration holds - script path, working directory, interpreter, and any
command-line arguments (useful for `rov_server.py --port 5005` or
`pilot.py`'s required `pi_address` argument) - all set once instead of
retyped every run.

### A note on `pilot.py`

`pilot.py` runs on your **laptop**, reading your laptop's game controller -
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

This is the biggest upgrade over `print()` statements. Since your remote
interpreter runs the code on the Pi, debugging in PyCharm means **pausing
code while it's actually running on the Pi** and looking inside it from your
laptop.

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

The breakpoint debugger isn't always the right tool, especially once
motors are involved - see the [debugging lesson](../debugging/lesson.md)
for when to reach for this versus plain `print()` statements instead.

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
