"""
autopilot.py - drive the ROV through a pattern all by itself.

This is a STARTER for the autonomous-driving exercise. It already arms the
thrusters safely and runs one very simple pattern (a there-and-back). Your job
is to extend it - or rewrite it - so the ROV drives a more interesting pattern
on its own: a square, a figure-eight, a search sweep, a spiral, your choice.

You may use an AI assistant (Claude, ChatGPT, or Gemini) to help you write it.
Read the lesson (lesson.md) for how to do that well - including prompt hints -
and for the safety rules, which are on you, not the AI. For a finished example
to learn from, see autopilot_example_square.py in this folder.

HOW IT DRIVES
-------------
This reuses the ThrusterRig from the thrusters lesson. The one method you need:

    rig.drive(forward, turn, vertical)

Each value is -1.0 .. +1.0:
    forward:  -1 full reverse  ...  +1 full forward
    turn:     -1 hard left     ...  +1 hard right
    vertical: -1 down          ...  +1 up

A "maneuver" is just one of those settings held for a number of seconds. A
pattern is a list of maneuvers run one after another.

SAFETY (read this)
------------------
- Props removed or the ROV fully submerged and clear of hands. Never spin
  props in air at anything you care about.
- The program ALWAYS stops the thrusters when it ends - even on Ctrl+C - and
  it refuses to run a single move or a whole mission longer than the caps
  below. Keep those caps; they are what makes an autonomous run safe to test.
- Test on the bench first (watch the props spin the right way for each step),
  THEN in the water.
"""

import argparse
import sys
import time
from pathlib import Path

# ThrusterRig lives in the sibling thrusters/ folder (not an installed
# package), so add that folder to Python's import path - the same trick
# control/rov_server.py uses. Then we can import ThrusterRig and reuse all the
# safe arming / driving code from the thrusters lesson instead of rewriting it.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "thrusters"))
from thruster_control import ThrusterRig  # noqa: E402

# --- Safety caps. Do not raise these without a mentor. ----------------------
MAX_STEP_SECONDS = 5.0      # no single maneuver may run longer than this
MAX_MISSION_SECONDS = 60.0  # no whole mission may run longer than this
MAX_SPEED = 0.6             # clamp every axis; start gentle, speed up later


# A maneuver is (label, forward, turn, vertical, seconds).
Maneuver = tuple


def clamp_speed(value: float) -> float:
    """Keep an axis within +/- MAX_SPEED so a typo can't command full throttle."""
    return max(-MAX_SPEED, min(MAX_SPEED, value))


def run_pattern(rig: ThrusterRig, pattern):
    """Run a list of maneuvers in order, enforcing the safety caps."""
    total = sum(step[4] for step in pattern)
    if total > MAX_MISSION_SECONDS:
        raise ValueError(
            f"This mission is {total:.0f}s long; the cap is "
            f"{MAX_MISSION_SECONDS:.0f}s. Shorten it before running."
        )

    for label, forward, turn, vertical, seconds in pattern:
        seconds = min(seconds, MAX_STEP_SECONDS)
        f, t, v = clamp_speed(forward), clamp_speed(turn), clamp_speed(vertical)
        print(f"[{seconds:4.1f}s] {label:<24} "
              f"forward={f:+.2f} turn={t:+.2f} vertical={v:+.2f}")
        rig.drive(f, t, v)
        time.sleep(seconds)

    rig.drive(0.0, 0.0, 0.0)  # stop at the end of the pattern
    print("Pattern complete.")


# ---------------------------------------------------------------------------
# THE PATTERN  <-- this is the part you change.
#
# Right now it just goes forward, pauses, and comes back. Replace the steps
# below (or build the list in code - a loop can make a square or a spiral)
# so the ROV drives a pattern you designed. Ideas, easiest first:
#   * a square:        forward, turn 90-ish, forward, turn, ... x4
#   * a figure-eight:  forward while turning one way, then the other
#   * a search sweep:  forward a bit, turn, forward, turn back, step over
#   * depth included:  dive, run the pattern, surface
# You will have to TUNE the seconds and turn amounts to your ROV and water -
# that tuning is most of the exercise.
# ---------------------------------------------------------------------------
def build_pattern():
    return [
        # label                 forward  turn  vertical  seconds
        ("drive forward",          0.4,   0.0,   0.0,      2.0),
        ("hold / coast",           0.0,   0.0,   0.0,      1.0),
        ("turn around",            0.0,   0.4,   0.0,      2.0),
        ("drive back",             0.4,   0.0,   0.0,      2.0),
        ("stop",                   0.0,   0.0,   0.0,      0.5),
    ]


def main():
    parser = argparse.ArgumentParser(description="Drive the ROV through a pattern.")
    parser.add_argument(
        "--address", type=lambda s: int(s, 0), default=0x40,
        help="Pi Servo HAT I2C address (default 0x40)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print the pattern and the commands WITHOUT touching the thrusters.",
    )
    args = parser.parse_args()

    pattern = build_pattern()

    if args.dry_run:
        # Great for testing your pattern with the AI's help before you ever
        # power the thrusters: it prints what WOULD happen, safely.
        print("DRY RUN - no thrusters will move.\n")
        for label, f, t, v, s in pattern:
            print(f"[{min(s, MAX_STEP_SECONDS):4.1f}s] {label:<24} "
                  f"forward={clamp_speed(f):+.2f} turn={clamp_speed(t):+.2f} "
                  f"vertical={clamp_speed(v):+.2f}")
        total = min(sum(s for *_ , s in pattern), MAX_MISSION_SECONDS)
        print(f"\nTotal mission time: {total:.1f}s")
        return

    rig = ThrusterRig(i2c_address=args.address)
    try:
        rig.arm()
        run_pattern(rig, pattern)
    finally:
        # Always stop, even on Ctrl+C or an error partway through a pattern.
        rig.close()


if __name__ == "__main__":
    main()
