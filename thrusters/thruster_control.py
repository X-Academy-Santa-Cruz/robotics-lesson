"""
Drives three BlueRobotics-style brushless thrusters (left, right, vertical)
and a gripper servo through a SparkFun Pi Servo HAT (PCA9685-based) plugged
onto the Pi's GPIO header, using the SparkFun pi_servo_hat library.

Run this with the thrusters either out of the water with propellers removed,
or fully submerged and clear of anyone's hands - never run them in air with
propellers attached pointed at anything you care about.
"""

import time

import click
import pi_servo_hat

# Pulse widths (milliseconds) BlueRobotics ESCs expect, same convention as a
# standard RC continuous-rotation servo. The Pi Servo HAT library works in
# milliseconds: we tell it our ESCs' min/max pulse, then command a position
# in "degrees" that the library converts into a pulse width for us.
MIN_PULSE_MS = 1.1  # full reverse (1100 us)
MAX_PULSE_MS = 1.9  # full forward (1900 us)
MID_PULSE_MS = (MIN_PULSE_MS + MAX_PULSE_MS) / 2.0  # neutral / stop (1.5 ms)

# Treat the servo as a 180-degree servo so position maps cleanly onto throttle:
#   position 0   -> MIN_PULSE_MS (full reverse)
#   position 90  -> midpoint     (stop)
#   position 180 -> MAX_PULSE_MS (full forward)
SWING = 180

# Which Servo HAT channel each device is plugged into.
CHANNEL_GRIPPER = 0
CHANNEL_LEFT = 1
CHANNEL_RIGHT = 2
CHANNEL_VERTICAL = 3

# Friendly names for the thruster channels, used by the test CLI.
THRUSTER_CHANNELS = {
    "left": CHANNEL_LEFT,
    "right": CHANNEL_RIGHT,
    "vertical": CHANNEL_VERTICAL,
}

# Gripper servo travel (degrees). A standard positional servo, not an ESC:
# one end is fully closed, the other fully open. Tune these to your gripper.
GRIPPER_CLOSED_DEG = 0
GRIPPER_OPEN_DEG = 180

ARM_SECONDS = 3  # how long to hold neutral before an ESC will accept throttle


def _throttle_to_position(throttle: float) -> float:
    """Map a throttle of -1.0..+1.0 onto a 0..180 position for the HAT.

    -1.0 -> 0    (full reverse)
     0.0 -> 90   (stop)
    +1.0 -> 180  (full forward)
    """
    throttle = max(-1.0, min(1.0, throttle))
    return (throttle + 1.0) * (SWING / 2.0)


def _pulse_ms_to_position(ms: float) -> float:
    """Map a raw pulse width in ms onto a 0..180 position for the HAT.

    Clamped to the ESC's MIN_PULSE_MS..MAX_PULSE_MS range for safety.
    """
    ms = max(MIN_PULSE_MS, min(MAX_PULSE_MS, ms))
    return (ms - MIN_PULSE_MS) / (MAX_PULSE_MS - MIN_PULSE_MS) * SWING


class ThrusterRig:
    """Controls the three thrusters plus the gripper as a single unit."""

    def __init__(self, i2c_address: int = 0x40, frequency: int = 50):
        # Create the HAT. The default I2C address of the Pi Servo HAT is 0x40.
        self._hat = pi_servo_hat.PiServoHat(address=i2c_address)
        self._hat.restart()                       # reset the chip; sets 50 Hz
        if frequency != 50:
            self._hat.set_pwm_frequency(frequency)
        # Match the library's pulse range to what the ESCs expect.
        self._hat.set_pulse_time(MIN_PULSE_MS, MAX_PULSE_MS)
        self._armed = False
        # Gripper state: the last angle we commanded, and whether it's latched
        # (held) so it keeps that position without the trigger being held.
        self._gripper_amount = 0.0
        self._gripper_held = False

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
        self.set_gripper(0.0)                      # start with the gripper closed
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

    # -- Per-channel helpers, used by the test CLI --------------------------

    def set_channel_throttle(self, channel: int, throttle: float):
        """Set ONE thruster channel to a throttle of -1.0..+1.0 (for testing)."""
        self._check_armed()
        self._set_throttle(channel, self._clamp(throttle))

    def set_channel_pulse_ms(self, channel: int, ms: float):
        """Set ONE thruster channel to a raw pulse width in ms (for testing).

        The value is clamped to the ESC's safe MIN_PULSE_MS..MAX_PULSE_MS range.
        """
        self._check_armed()
        self._hat.move_servo_position(channel, _pulse_ms_to_position(ms), SWING)

    # -- Gripper ------------------------------------------------------------

    def set_gripper(self, amount: float):
        """Open/close the gripper. amount 0.0 = closed, 1.0 = fully open.

        The gripper is a normal positional servo (not an ESC), so we command
        it by angle between GRIPPER_CLOSED_DEG and GRIPPER_OPEN_DEG. Setting a
        new amount clears any hold (you're actively commanding it now).
        """
        amount = max(0.0, min(1.0, amount))
        self._gripper_amount = amount
        self._gripper_held = False
        self._write_gripper(amount)

    def _write_gripper(self, amount: float):
        angle = GRIPPER_CLOSED_DEG + amount * (GRIPPER_OPEN_DEG - GRIPPER_CLOSED_DEG)
        self._hat.move_servo_position(CHANNEL_GRIPPER, angle, SWING)

    def hold_gripper(self):
        """Latch the gripper at its current position so it keeps holding
        without the trigger being pressed. A clamped servo keeps clamping until
        you release_gripper(). Returns the held amount (0..1)."""
        self._gripper_held = True
        self._write_gripper(self._gripper_amount)
        return self._gripper_amount

    def release_gripper(self):
        """Release a held gripper: open it and clear the hold."""
        self._gripper_held = False
        self.set_gripper(1.0)  # open to let go of whatever was held

    def gripper_is_held(self) -> bool:
        return self._gripper_held

    def apply_gripper_command(self, trigger_amount: float):
        """Drive the gripper from a live trigger value, respecting a hold.

        While held, the trigger is ignored and the latched position is kept, so
        the ROV can carry something without a finger on the trigger. Call
        hold_gripper()/release_gripper() to toggle the latch.
        """
        if self._gripper_held:
            self._write_gripper(self._gripper_amount)
        else:
            self.set_gripper(trigger_amount)

    # -- Stop / cleanup -----------------------------------------------------

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
        ("forward, half speed", lambda: rig.drive(0.5, 0.0, 0.0)),
        ("turn right in place", lambda: rig.drive(0.0, 0.5, 0.0)),
        ("rise", lambda: rig.drive(0.0, 0.0, 0.5)),
        ("stop", lambda: rig.drive(0.0, 0.0, 0.0)),
        ("open gripper", lambda: rig.set_gripper(1.0)),
        ("close gripper", lambda: rig.set_gripper(0.0)),
    ]
    for label, action in steps:
        print(label)
        action()
        time.sleep(2)


@click.command()
@click.option(
    "--address", default="0x40", show_default=True,
    help="Pi Servo HAT I2C address (e.g. 0x40).",
)
def main(address):
    """Run a short wiring-check demo of the thrusters and gripper."""
    rig = ThrusterRig(i2c_address=int(address, 0))
    try:
        rig.arm()
        demo(rig)
    finally:
        # Runs even on Ctrl+C, so the thrusters always get a stop command
        # before the program exits.
        rig.close()


if __name__ == "__main__":
    main()
