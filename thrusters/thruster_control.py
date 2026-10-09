"""
Drives three BlueRobotics-style brushless thrusters (left, right, vertical)
through a PCA9685 PWM driver board connected to the Pi over I2C.

Run this with the thrusters either out of the water with propellers removed,
or fully submerged and clear of anyone's hands - never run them in air with
propellers attached pointed at anything you care about.
"""

import argparse
import time

import board
import busio
from adafruit_motor import servo
from adafruit_pca9685 import PCA9685

# Pulse widths (microseconds) BlueRobotics ESCs expect, same convention as a
# standard RC continuous-rotation servo.
MIN_PULSE_US = 1100  # full reverse
MAX_PULSE_US = 1900  # full forward
# (neutral/stop is the midpoint, 1500us, which ContinuousServo sends for
# throttle = 0.0)

# Which PCA9685 channel each thruster's signal wire is plugged into.
CHANNEL_LEFT = 0
CHANNEL_RIGHT = 1
CHANNEL_VERTICAL = 2

ARM_SECONDS = 3  # how long to hold neutral before an ESC will accept throttle


class ThrusterRig:
    """Controls the three thrusters as a single unit: left, right, vertical."""

    def __init__(self, i2c_address: int = 0x40, frequency: int = 50):
        i2c = busio.I2C(board.SCL, board.SDA)
        self._pca = PCA9685(i2c, address=i2c_address)
        self._pca.frequency = frequency

        self._left = self._make_servo(CHANNEL_LEFT)
        self._right = self._make_servo(CHANNEL_RIGHT)
        self._vertical = self._make_servo(CHANNEL_VERTICAL)
        self._armed = False

    def _make_servo(self, channel: int) -> servo.ContinuousServo:
        return servo.ContinuousServo(
            self._pca.channels[channel],
            min_pulse=MIN_PULSE_US,
            max_pulse=MAX_PULSE_US,
        )

    def arm(self):
        """Send neutral to every thruster and hold it for ARM_SECONDS.

        An ESC ignores throttle commands until it has first seen a steady
        neutral signal - this is also what prevents a prop from jumping to
        an arbitrary speed the instant the ESC powers on.
        """
        print("Arming thrusters - keep clear of propellers...")
        self._left.throttle = 0.0
        self._right.throttle = 0.0
        self._vertical.throttle = 0.0
        time.sleep(ARM_SECONDS)
        self._armed = True
        print("Armed.")

    def _check_armed(self):
        if not self._armed:
            raise RuntimeError("Call arm() before commanding the thrusters.")

    @staticmethod
    def _clamp(value: float) -> float:
        return max(-1.0, min(1.0, value))

    def drive(self, forward: float, turn: float, vertical: float):
        """Set all three thrusters from three simple axes, each -1.0 to 1.0.

        forward:  reverse <-> forward
        turn:     left <-> right, applied as opposite speed changes to the
                  left/right thrusters (differential steering)
        vertical: down <-> up
        """
        self._check_armed()
        self._left.throttle = self._clamp(forward + turn)
        self._right.throttle = self._clamp(forward - turn)
        self._vertical.throttle = self._clamp(vertical)

    def stop(self):
        self._check_armed()
        self._left.throttle = 0.0
        self._right.throttle = 0.0
        self._vertical.throttle = 0.0

    def close(self):
        self.stop()
        self._pca.deinit()


def demo(rig: ThrusterRig):
    """A short, low-speed sequence to confirm everything is wired correctly."""
    steps = [
        ("forward, half speed", dict(forward=0.5, turn=0.0, vertical=0.0)),
        ("turn right in place", dict(forward=0.0, turn=0.5, vertical=0.0)),
        ("rise", dict(forward=0.0, turn=0.0, vertical=0.5)),
        ("stop", dict(forward=0.0, turn=0.0, vertical=0.0)),
    ]
    for label, axes in steps:
        print(label)
        rig.drive(**axes)
        time.sleep(2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--address", type=lambda s: int(s, 0), default=0x40,
        help="PCA9685 I2C address (default 0x40)",
    )
    args = parser.parse_args()

    rig = ThrusterRig(i2c_address=args.address)
    try:
        rig.arm()
        demo(rig)
    finally:
        # Runs even on Ctrl+C, so the thrusters always get a stop command
        # before the program exits.
        rig.close()


if __name__ == "__main__":
    main()
