"""
Drives three BlueRobotics-style brushless thrusters (left, right, vertical)
through a SparkFun Pi Servo HAT (PCA9685-based) plugged onto the Pi's GPIO
header, using the SparkFun pi_servo_hat library.

Run this with the thrusters either out of the water with propellers removed,
or fully submerged and clear of anyone's hands - never run them in air with
propellers attached pointed at anything you care about.
"""

import argparse
import time

import pi_servo_hat

# Pulse widths (milliseconds) BlueRobotics ESCs expect, same convention as a
# standard RC continuous-rotation servo. The Pi Servo HAT library works in
# milliseconds: we tell it our ESCs' min/max pulse, then command a position
# in "degrees" that the library converts into a pulse width for us.
MIN_PULSE_MS = 1.1  # full reverse (1100 us)
MAX_PULSE_MS = 1.9  # full forward (1900 us)
# Neutral/stop is the midpoint, 1.5 ms, which is position 90 below.

# Treat the servo as a 180-degree servo so position maps cleanly onto throttle:
#   position 0   -> MIN_PULSE_MS (full reverse)
#   position 90  -> midpoint     (stop)
#   position 180 -> MAX_PULSE_MS (full forward)
SWING = 180

# Which Servo HAT channel each thruster's signal wire is plugged into.
CHANNEL_LEFT = 0
CHANNEL_RIGHT = 1
CHANNEL_VERTICAL = 2

ARM_SECONDS = 3  # how long to hold neutral before an ESC will accept throttle


def _throttle_to_position(throttle: float) -> float:
    """Map a throttle of -1.0..+1.0 onto a 0..180 position for the HAT.

    -1.0 -> 0    (full reverse)
     0.0 -> 90   (stop)
    +1.0 -> 180  (full forward)
    """
    throttle = max(-1.0, min(1.0, throttle))
    return (throttle + 1.0) * (SWING / 2.0)


class ThrusterRig:
    """Controls the three thrusters as a single unit: left, right, vertical."""

    def __init__(self, i2c_address: int = 0x40, frequency: int = 50):
        # Create the HAT. The default I2C address of the Pi Servo HAT is 0x40.
        self._hat = pi_servo_hat.PiServoHat(address=i2c_address)
        self._hat.restart()                       # reset the chip; sets 50 Hz
        if frequency != 50:
            self._hat.set_pwm_frequency(frequency)
        # Match the library's pulse range to what the ESCs expect.
        self._hat.set_pulse_time(MIN_PULSE_MS, MAX_PULSE_MS)
        self._armed = False

    def _set_throttle(self, channel: int, throttle: float):
        self._hat.move_servo_position(channel, _throttle_to_position(throttle), SWING)

    def arm(self):
        """Send neutral to every thruster and hold it for ARM_SECONDS.

        An ESC ignores throttle commands until it has first seen a steady
        neutral signal - this is also what prevents a prop from jumping to
        an arbitrary speed the instant the ESC powers on.
        """
        print("Arming thrusters - keep clear of propellers...")
        self._set_throttle(CHANNEL_LEFT, 0.0)
        self._set_throttle(CHANNEL_RIGHT, 0.0)
        self._set_throttle(CHANNEL_VERTICAL, 0.0)
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
        self._set_throttle(CHANNEL_LEFT, self._clamp(forward + turn))
        self._set_throttle(CHANNEL_RIGHT, self._clamp(forward - turn))
        self._set_throttle(CHANNEL_VERTICAL, self._clamp(vertical))

    def stop(self):
        self._check_armed()
        self._set_throttle(CHANNEL_LEFT, 0.0)
        self._set_throttle(CHANNEL_RIGHT, 0.0)
        self._set_throttle(CHANNEL_VERTICAL, 0.0)

    def close(self):
        if self._armed:
            self.stop()
        # Cut PWM output so the ESCs see no signal once we're done.
        self._hat.sleep()


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
        help="Pi Servo HAT I2C address (default 0x40)",
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
