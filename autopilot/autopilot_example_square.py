"""
autopilot_example_square.py - a WORKED EXAMPLE for the autonomous-driving
project. It drives the ROV in a square, built with a loop.

This is here to learn from, not to copy. It's the kind of finished program a
good conversation with an AI assistant (Claude, ChatGPT, or Gemini) produces
from the starter autopilot.py: same safety structure, but build_pattern()
constructs a square in code with a loop instead of a hand-typed list. Read it,
run it with --dry-run, then write your OWN pattern.

HOW IT DRIVES (same as autopilot.py)
------------------------------------
    rig.drive(forward, turn, vertical)   # each value -1.0 .. +1.0
A "maneuver" is one of those settings held for a number of seconds; a pattern
is a list of maneuvers run one after another.

SAFETY
------
- Props removed, or the ROV fully submerged and clear of hands.
- Always stops the thrusters on exit (even Ctrl+C), caps each move and the
  whole mission, and clamps every speed. Keep those caps.
- Dry-run it first (--dry-run), then test in the water.
"""

import argparse
import sys
import time
from pathlib import Path

# Reuse ThrusterRig from the sibling thrusters/ folder (same trick as the
# starter and control/rov_server.py).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "thrusters"))
from thruster_control import ThrusterRig  # noqa: E402

# --- Safety caps. Do not raise these without a mentor. ----------------------
MAX_STEP_SECONDS = 5.0      # no single maneuver may run longer than this
MAX_MISSION_SECONDS = 60.0  # no whole mission may run longer than this
MAX_SPEED = 0.6             # clamp every axis; start gentle, speed up later

# --- Tuning knobs for the square. These are the numbers you'd adjust by
# testing with --dry-run and then in the water for YOUR ROV. ----------------
SIDES = 4                   # a square has 4 sides (try 3 for a triangle!)
DRIVE_SPEED = 0.4           # how fast to go forward along each side
DRIVE_SECONDS = 2.0         # how long each side takes
TURN_SPEED = 0.4            # how hard to turn at each corner
TURN_SECONDS = 1.2          # how long to turn ~90 deg - TUNE THIS to your ROV
PAUSE_SECONDS = 0.5         # brief settle between driving and turning


def clamp_speed(value: float) -> float:
    """Keep an axis within +/- MAX_SPEED so a typo can't command full throttle."""
    return max(-MAX_SPEED, min(MAX_SPEED, value))


def build_pattern():
    """Build a square by looping once per side.

    Each side is: drive forward for DRIVE_SECONDS, settle, then turn ~90 deg.
    Using a loop (instead of typing four near-identical blocks by hand) is the
    whole point - change SIDES to 3 and you get a triangle, 6 and you get a
    hexagon, with no extra code.
    """
    pattern = []
    for side in range(SIDES):
        pattern.append((f"side {side + 1}: forward", DRIVE_SPEED, 0.0, 0.0, DRIVE_SECONDS))
        pattern.append((f"side {side + 1}: settle", 0.0, 0.0, 0.0, PAUSE_SECONDS))
        pattern.append((f"corner {side + 1}: turn", 0.0, TURN_SPEED, 0.0, TURN_SECONDS))
    pattern.append(("stop", 0.0, 0.0, 0.0, 0.5))
    return pattern


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
        print(f"[{seconds:4.1f}s] {label:<22} "
              f"forward={f:+.2f} turn={t:+.2f} vertical={v:+.2f}")
        rig.drive(f, t, v)
        time.sleep(seconds)
    rig.drive(0.0, 0.0, 0.0)  # stop at the end
    print("Pattern complete.")


def main():
    parser = argparse.ArgumentParser(description="Drive the ROV in a square.")
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
        print("DRY RUN - no thrusters will move.\n")
        for label, f, t, v, s in pattern:
            print(f"[{min(s, MAX_STEP_SECONDS):4.1f}s] {label:<22} "
                  f"forward={clamp_speed(f):+.2f} turn={clamp_speed(t):+.2f} "
                  f"vertical={clamp_speed(v):+.2f}")
        total = min(sum(s for *_, s in pattern), MAX_MISSION_SECONDS)
        print(f"\nTotal mission time: {total:.1f}s")
        return

    rig = ThrusterRig(i2c_address=args.address)
    try:
        rig.arm()
        run_pattern(rig, pattern)
    finally:
        rig.close()  # always stop, even on Ctrl+C or an error partway through


if __name__ == "__main__":
    main()
