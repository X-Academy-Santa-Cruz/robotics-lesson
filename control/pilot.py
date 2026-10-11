"""
Runs on the laptop. Reads a game controller and sends forward/turn/vertical
and gripper commands to rov_server.py on the Pi over UDP, continuously, at a
fixed rate.

Two controllers are supported out of the box:

  * Logitech Extreme 3D Pro flight stick (the "3D Extreme")
      forward  = stick pitch (push forward/back)
      turn     = stick twist (yaw)
      vertical = throttle slider
      gripper  = TRIGGER (button 0): hold to open
  * Logitech F310 gamepad
      forward  = left stick Y
      turn     = left stick X
      vertical = right stick Y
      gripper  = TRIGGER (right trigger, RT): squeeze to open

The controller is detected by name. If yours isn't recognized, or the axes
come out wrong, run with --calibrate and move each control to find the right
numbers, then adjust the matching profile below.
"""

import argparse
import socket
import time

import pygame

SEND_RATE_HZ = 20
DEADZONE = 0.15


class ControllerProfile:
    """Describes how to read one kind of controller.

    axis_* are axis indices. invert_* flip an axis so that "push up / push
    forward" gives a positive command. gripper_button is a button index used
    as the trigger; gripper_axis is an analog trigger axis used instead when
    gripper_button is None.
    """

    def __init__(self, name, axis_forward, axis_turn, axis_vertical,
                 invert_forward=True, invert_turn=False, invert_vertical=True,
                 gripper_button=None, gripper_axis=None, gripper_axis_rest=-1.0):
        self.name = name
        self.axis_forward = axis_forward
        self.axis_turn = axis_turn
        self.axis_vertical = axis_vertical
        self.invert_forward = invert_forward
        self.invert_turn = invert_turn
        self.invert_vertical = invert_vertical
        self.gripper_button = gripper_button
        self.gripper_axis = gripper_axis
        self.gripper_axis_rest = gripper_axis_rest


# Logitech Extreme 3D Pro: pitch (axis 1), twist/yaw (axis 2), throttle
# slider (axis 3). The trigger is button 0.
PROFILE_EXTREME_3D = ControllerProfile(
    name="Logitech Extreme 3D Pro",
    axis_forward=1, axis_turn=2, axis_vertical=3,
    invert_forward=True, invert_turn=False, invert_vertical=True,
    gripper_button=0,
)

# Logitech F310 (XInput mode, the X/D switch set to X): left stick X/Y are
# axes 0/1, right stick Y is axis 4. The right trigger (RT) is analog axis 5,
# resting at -1.0 and going to +1.0 when fully squeezed.
PROFILE_F310 = ControllerProfile(
    name="Logitech Gamepad F310",
    axis_forward=1, axis_turn=0, axis_vertical=4,
    invert_forward=True, invert_turn=False, invert_vertical=True,
    gripper_axis=5, gripper_axis_rest=-1.0,
)

# A safe fallback used when the controller name isn't recognized.
PROFILE_DEFAULT = ControllerProfile(
    name="Generic",
    axis_forward=1, axis_turn=0, axis_vertical=3,
    gripper_button=0,
)


def pick_profile(controller_name: str) -> ControllerProfile:
    lowered = controller_name.lower()
    if "extreme 3d" in lowered or "extreme 3d pro" in lowered:
        return PROFILE_EXTREME_3D
    if "f310" in lowered or "gamepad" in lowered:
        return PROFILE_F310
    return PROFILE_DEFAULT


def apply_deadzone(value: float) -> float:
    """Treat small stick drift near center as exactly zero."""
    return 0.0 if abs(value) < DEADZONE else value


def read_gripper(joystick, profile: ControllerProfile) -> float:
    """Return 0.0 (closed) .. 1.0 (open) from whichever trigger the profile uses."""
    if profile.gripper_button is not None:
        # A plain button: pressed = fully open, released = fully closed.
        if profile.gripper_button < joystick.get_numbuttons():
            return 1.0 if joystick.get_button(profile.gripper_button) else 0.0
        return 0.0
    if profile.gripper_axis is not None:
        if profile.gripper_axis < joystick.get_numaxes():
            raw = joystick.get_axis(profile.gripper_axis)
            # Map the trigger's resting..pressed range onto 0..1.
            return max(0.0, min(1.0, (raw - profile.gripper_axis_rest) / 2.0))
        return 0.0
    return 0.0


def calibrate(joystick):
    print("Move each control and watch which number changes. Ctrl+C to stop.")
    print("(axes first, then buttons)")
    while True:
        pygame.event.pump()
        axes = [round(joystick.get_axis(i), 2) for i in range(joystick.get_numaxes())]
        buttons = [joystick.get_button(i) for i in range(joystick.get_numbuttons())]
        print(f"axes={axes}  buttons={buttons}")
        time.sleep(0.2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pi_address", help="IP address of the Pi, e.g. 192.168.1.42")
    parser.add_argument("--port", type=int, default=5005)
    parser.add_argument(
        "--calibrate", action="store_true",
        help="print raw axis/button values instead of sending commands",
    )
    args = parser.parse_args()

    pygame.init()
    pygame.joystick.init()
    if pygame.joystick.get_count() == 0:
        raise RuntimeError("No game controller detected - plug one in and try again.")
    joystick = pygame.joystick.Joystick(0)
    joystick.init()
    name = joystick.get_name()
    print(f"Using controller: {name}")

    if args.calibrate:
        calibrate(joystick)
        return

    profile = pick_profile(name)
    print(f"Matched profile: {profile.name}")

    def read_axis(index, invert):
        if index >= joystick.get_numaxes():
            return 0.0
        value = apply_deadzone(joystick.get_axis(index))
        return -value if invert else value

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    target = (args.pi_address, args.port)
    interval = 1.0 / SEND_RATE_HZ

    try:
        while True:
            pygame.event.pump()
            forward = read_axis(profile.axis_forward, profile.invert_forward)
            turn = read_axis(profile.axis_turn, profile.invert_turn)
            vertical = read_axis(profile.axis_vertical, profile.invert_vertical)
            gripper = read_gripper(joystick, profile)

            message = f"{forward},{turn},{vertical},{gripper}".encode("utf-8")
            sock.sendto(message, target)

            time.sleep(interval)
    except KeyboardInterrupt:
        sock.sendto(b"0,0,0,0", target)  # explicit stop on the way out
    finally:
        sock.close()


if __name__ == "__main__":
    main()
