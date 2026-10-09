# Lesson: Debugging — print() vs PyCharm's Debugger

Every program you write will eventually do something other than what you
expected. **Debugging** is the skill of figuring out why. This lesson
covers the two techniques you'll use constantly for the rest of this
course: sprinkling `print()` statements through your code, and using
PyCharm's built-in debugger (breakpoints, stepping, watches — set up in
the [PyCharm lesson](../pycharm/lesson.md)). Both are real, professional
techniques. The skill worth building isn't "always use the debugger" —
it's knowing which one fits the bug in front of you.

This lesson assumes you've already read the Debugging section of the
PyCharm lesson for the mechanics of breakpoints, stepping, and watches. If
you haven't, do that first — here we focus on *when* to reach for each
tool, not how to click the buttons.

## 1. The bug you'll practice on

[`buggy_differential_drive.py`](buggy_differential_drive.py) is a
standalone copy of the steering math from `ThrusterRig.drive()` in the
thrusters lesson, deliberately broken, with **no hardware, no Pi, and no
venv required** — just plain Python, so you can practice debugging
technique on any laptop before ever touching a bug on real hardware.

Run it:

```bash
python3 buggy_differential_drive.py
```

```
straight ahead: forward=1.0, turn=0.0 -> left=1.0, right=1.0
spin in place: forward=0.0, turn=1.0 -> left=1.0, right=1.0
curve while moving forward: forward=0.5, turn=0.5 -> left=1.0, right=1.0
```

Something's wrong: "spin in place" should turn the two thrusters in
*opposite* directions (`left=1.0, right=-1.0`), not drive them identically.
Whatever's broken, it's not in this printed summary — it's somewhere
inside `differential_drive()`. That's exactly the situation both
techniques below are for: you can see the symptom, not the cause.

## 2. Debugging with `print()`

The technique: insert `print()` calls at points where you suspect the
value might be wrong, re-run, read the output, and narrow it down — edit,
run, read, repeat.

For example, add a print inside `differential_drive()` right after `left`
and `right` are computed:

```python
def differential_drive(forward: float, turn: float):
    left = forward + turn
    right = forward + turn
    print(f"left={left}, right={right}")   # <- added temporarily
    return clamp(left), clamp(right)
```

Re-running shows `left` and `right` are identical *before* `clamp()` even
runs — which tells you the bug is in how `right` is calculated, not in
`clamp()`. You just narrowed down the search space without touching a
debugger at all.

### Strengths

- Works anywhere you can run Python — an SSH terminal on the Pi, no IDE
  required. It's exactly what you've already been doing throughout this
  course.
- Shows you a value across **many** moments in time at once, in the
  scrollback — great for watching a trend, or waiting for a rare case to
  show up in a long-running loop.
- Doesn't pause your program, so it doesn't change *when* things happen —
  important for the robotics-specific cautions below.

### Weaknesses

- You have to guess in advance what to print and where.
- Finding a bug often means several edit → rerun → read cycles.
- Output inside a loop gets noisy fast.
- You have to remember to remove your debug prints afterward.

## 3. Debugging with PyCharm's debugger

Set a breakpoint on the line `right = forward + turn` and run
`buggy_differential_drive.py` in **Debug** mode (this script runs entirely
on your laptop — no remote interpreter needed for this exercise). When it
pauses:

- The **Variables** panel shows `forward` and `turn` for the current test
  case — no `print()` needed to see them.
- **Step Over** runs the line and updates `right` in the Variables panel —
  watch it get the same value as `left`, right there, without re-running
  anything.
- You can even open the **Evaluate Expression** tool and type
  `forward - turn` to see what `right` *should* have been, without editing
  the file at all.

### Strengths

- No guessing what to print — once paused, every variable in scope is
  inspectable, including ones you didn't think to check in advance.
- Step line-by-line and watch a value change in real time.
- Nothing to add to or clean up from your source code afterward.
- A **conditional breakpoint** can wait silently through thousands of
  iterations for a rare case, instead of you scrolling through that many
  lines of printed output.

### Weaknesses

- Needs the debugger actually attached — for code that must run on the
  Pi, that means the SSH remote interpreter from the PyCharm lesson is
  already set up and working.
- Pausing execution changes *when* things happen in your program — which
  matters a lot here (next section).
- Watching a value change across many iterations means repeatedly hitting
  **Resume**, one pause at a time — slower than scanning a scrollback.

## 4. Why this choice matters more on a robot than in a typical program

### Pausing live hardware

A breakpoint freezes your *code* — it does not freeze the *hardware*. If
you pause inside thruster-control code while the last command sent to an
ESC was a nonzero throttle, that thruster keeps spinning at that speed for
as long as you stay paused, because nothing told it to stop. **Never set a
breakpoint inside thruster-control code with propellers powered and
attached.** Use `print()` there instead, or disconnect the battery first —
see the [thrusters lesson](../thrusters/lesson.md) safety section.

### Timing-sensitive and multi-threaded bugs ("Heisenbugs")

The [camera lesson](../camera/lesson.md)'s `_capture_loop` runs continuously
in a background thread. A breakpoint only pauses the thread it's in — the others keep
going — which means hitting a breakpoint can shift the relative timing
between threads enough to make a race condition disappear exactly while
you're looking for it (or create one that wasn't there before). A bug that
seems to vanish specifically because you tried to observe it is common
enough to have an actual name: a **Heisenbug**. For this category, `print()`
statements — which don't pause anything, and can include a timestamp or
thread name — are usually more trustworthy than a breakpoint.

## 5. Choosing one

| Situation | Prefer |
|---|---|
| A rare, unpredictable failure in a loop | `print()` with timestamps — a breakpoint can change the timing and hide the bug |
| You need to see a value across many iterations at a glance | `print()` — scrollback beats repeatedly hitting Resume |
| A motor/thruster is powered and could move | `print()` — never leave live hardware paused mid-command |
| You don't yet know which function is even responsible | PyCharm debugger — step through and watch, instead of guessing where to print |
| You need to inspect a large/complex value (e.g. a whole camera frame) | PyCharm debugger — the Variables panel beats formatting a huge `print()` |
| A rare condition (`not ok`, a `ValueError`, ...) might not even be happening | PyCharm debugger — a conditional breakpoint waits for it silently |

These aren't mutually exclusive. Professional developers reach for both,
often on the same bug, often within the same five minutes.

## Exercises

1. Run `buggy_differential_drive.py` and, from the printed output alone
   (not the source), figure out which test case's result is wrong and why.
2. Find the bug using **only** `print()` statements: add one, re-run,
   narrow it down, confirm exactly which line is wrong — then remove your
   temporary prints.
3. Using `git checkout -- debugging/buggy_differential_drive.py` to put
   the bug back (or just re-introduce it by hand), now find the same bug
   using **only** PyCharm's debugger — a breakpoint, the Variables panel,
   stepping — without adding any `print()` calls.
4. Fix the bug for real and confirm all three test cases now produce the
   values you'd expect from `ThrusterRig.drive()`.
5. In a sentence or two, describe a bug from earlier in this course (real
   or imagined) where a breakpoint would be the wrong tool, and one where
   `print()` would be the wrong tool.
