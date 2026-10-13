# Lesson: Autonomous Driving — Make the ROV Drive Itself

So far you've piloted the ROV by hand with the joystick. In this project you'll
write software that drives the ROV through a **pattern on its own** — no hands
on the controller. This is your chance to put together everything from the
course: Python, the thruster code, PWM, and a little bit of planning.

You can use an **AI assistant (Claude or ChatGPT)** to help you write the code.
That's not cheating here — using AI well is a real skill, and it's one this
program teaches on purpose. But you are the engineer: you decide what to build,
you test it safely, and you have to understand every line before you run it.

## What you'll build

A Python program that makes the ROV drive a pattern by itself — for example a
square, a figure-eight, a search sweep, or a spiral — and comes back to a stop.

There's a starter in this folder, [`autopilot.py`](autopilot.py). It already:

- arms the thrusters safely,
- runs one very simple pattern (forward, turn around, come back),
- **stops the thrusters no matter what** — even if you press `Ctrl+C`,
- refuses to run any single move longer than 5 s or a whole mission longer
  than 60 s, and clamps every speed, so an autonomous run is safe to test.

Your job is to **extend it or rewrite it** into a more interesting pattern.

## Two ways to do the exercise

Pick whichever fits your team:

1. **Extend the starter.** Change `build_pattern()` so the ROV drives your
   pattern. A pattern is just a list of maneuvers — each one is a `forward`,
   `turn`, and `vertical` setting held for some seconds. Start by editing the
   list; then try building it with a loop (a loop is the easy way to make a
   square or a spiral).
2. **Write your own from scratch.** Import `ThrusterRig` the way the starter
   does, arm it, and drive your own pattern. Keep the same safety habits:
   always stop in a `finally` block, and cap your speeds and times.

## How the ROV drives

You command the ROV with one method, three numbers, each from `-1.0` to `+1.0`:

```python
rig.drive(forward, turn, vertical)
#          forward: -1 reverse  ... +1 forward
#          turn:    -1 left      ... +1 right
#          vertical:-1 down      ... +1 up
```

Hold a setting for a while with `time.sleep(seconds)`, then command the next
one. That's the whole idea of a timed pattern.

## Test it safely with `--dry-run` first

Before the thrusters ever move, run the pattern as a **dry run**. It prints
exactly what the ROV *would* do — every step, speed, and time — and never
touches the hardware:

```bash
source ~/robotics-lesson/.venv/bin/activate
cd ~/robotics-lesson/autopilot
python3 autopilot.py --dry-run
```

Get the pattern looking right on paper this way. Then test for real — **props
off or the ROV fully submerged and clear of hands** — and watch each step:

```bash
python3 autopilot.py
```

Press `Ctrl+C` any time to stop; the program always sends a stop command on
its way out.

## Using Claude or ChatGPT well

The AI is a fast, tireless helper that sometimes confidently gets things wrong.
Use it like a smart teammate whose work you always check.

**Give it the context it needs.** Paste in `autopilot.py` (and
`thruster_control.py` if it asks), then describe what you want. A good prompt:

> "Here's my ROV's `autopilot.py`. `rig.drive(forward, turn, vertical)` takes
> three values from −1 to 1. Help me change `build_pattern()` so the ROV drives
> a **square**: forward, turn ~90°, four times. I don't know the exact turn
> time — explain how I'd find it by testing."

**Then do these every time:**

- **Read what it wrote** and make sure you understand each line. If you can't
  explain a line to your teammate, ask the AI to explain it — don't run it.
- **Dry-run it** (`--dry-run`) before powering the thrusters.
- **Keep the safety caps and the `finally` stop.** If the AI removes them or
  tells you to raise them, put them back. Safety is your call, not the AI's.
- **Expect to tune.** The AI can't know how fast *your* ROV turns in *your*
  water. Turn amounts and times are something you discover by testing — that
  tuning is most of the exercise.
- **Ask it to teach, not just to type.** "Why a loop here?" "What would make
  the square drift?" You'll learn more and build better.

## Ideas, easiest to hardest

1. **There-and-back** (the starter already does this) — make it longer.
2. **A square** — four "forward, then turn" pairs; a loop makes this tidy.
3. **A figure-eight** — forward while turning one way, then the other.
4. **A search sweep** — forward, turn, forward, turn back, step across.
5. **Add depth** — dive at the start, run the pattern, surface at the end.
6. **A spiral** — grow the forward time a little each lap.

## What "done" looks like (rubric)

Show a mentor:

- [ ] The ROV drives your pattern **by itself**, start to stop, hands off.
- [ ] You can **explain every line** of your program (yours or the AI's).
- [ ] It **always stops** — you demonstrated `Ctrl+C` leaves the thrusters off.
- [ ] You kept the **safety caps** (max step/mission time, clamped speed).
- [ ] You can describe **how you tuned** the turns and times to your ROV.
- [ ] (Bonus) You used the AI to learn something you then explained back.

## If it doesn't work

| Problem | Likely cause and fix |
|---|---|
| `ModuleNotFoundError: No module named 'pi_servo_hat'` | Activate the venv first: `source ~/robotics-lesson/.venv/bin/activate`. |
| `ModuleNotFoundError: No module named 'thruster_control'` | Run it from inside the `autopilot/` folder so the path trick can find the sibling `thrusters/` folder. |
| `Remote I/O error` when it starts | The Servo HAT isn't responding — check it's seated and powered; `i2cdetect -y 1` should show `40`. |
| A thruster spins the wrong way | Expected on a new build — note it, and either swap the wiring or flip the sign in your pattern. |
| The ROV won't turn far enough | Tune it: more `turn`, or hold the turn longer. Use `--dry-run` to plan, then test. |
