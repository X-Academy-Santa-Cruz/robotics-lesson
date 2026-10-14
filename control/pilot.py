"""
Runs on the laptop. Reads a game controller and sends forward/turn/vertical,
gripper, and gripper-release commands to rov_server.py on the Pi over UDP,
continuously, at a fixed rate.

Control layout (dual-stick gamepad, e.g. the F310):
    LEFT stick  (up/down)  -> vertical  (dive / surface)
    RIGHT stick (up/down)  -> forward / reverse
    RIGHT stick (left/right)-> turn
    TRIGGER                -> squeeze to GRIP. The gripper KEEPS holding when
                              you let go of the trigger, so you can carry an
                              object hands-free.
    RELEASE button         -> open the gripper to let the object go
                              (F310: A button; Extreme 3D: button 2)
    CRUISE button          -> hold the current forward speed hands-free; press
                              again, or push the forward stick, to cancel
                              (F310: B button; Extreme 3D: button 3)

Specific buttons per controller (indices are the button numbers pygame
reports; see the profiles below and use --calibrate to confirm on yours):
    Logitech F310 (XInput, X/D switch on X): trigger = right trigger (RT);
        RELEASE = A button (0); CRUISE = B button (1).
    Logitech Extreme 3D Pro: trigger = the stick trigger, button 0;
        RELEASE = button 2; CRUISE = button 3.

On the Logitech Extreme 3D Pro flight stick there is only one stick plus a
throttle slider, so that single stick drives forward/turn and the throttle
slider drives vertical (there is no separate "left stick" to use for depth).

If your controller isn't recognized, or the axes come out wrong, run with
--calibrate and move each control to find the right numbers, then adjust the
matching profile below.
"""

import socket
import time

import click
import pygame

SEND_RATE_HZ = 20
DEADZONE = 0.15
CRUISE_CANCEL_PUSH = 0.5  # pushing forward this far cancels cruise control


class ControllerProfile:
    """Describes how to read one kind of controller.

    axis_* are axis indices. invert_* flip an axis so that "push up / push
    forward" gives a positive command. gripper_button is a button index used
    as the trigger; gripper_axis is an analog trigger axis used instead when
    gripper_button is None. release_button opens the gripper to let go;
    cruise_button toggles cruise control (None = no button for that on this pad).
    """

    def __init__(self, name, axis_forward, axis_turn, axis_vertical,
                 invert_forward=True, invert_turn=False, invert_vertical=True,
                 gripper_button=None, gripper_axis=None, gripper_axis_rest=-1.0,
                 release_button=None, cruise_button=None):
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
        self.release_button = release_button
        self.cruise_button = cruise_button


# Logitech Extreme 3D Pro: pitch (axis 1), twist/yaw (axis 2), throttle
# slider (axis 3). The trigger is button 0. The single stick drives
# forward/turn; the throttle slider drives vertical. The trigger (button 0)
# grips; button 2 opens the gripper to release; button 3 toggles cruise.
PROFILE_EXTREME_3D = ControllerProfile(
    name="Logitech Extreme 3D Pro",
    axis_forward=1, axis_turn=2, axis_vertical=3,
    invert_forward=True, invert_turn=False, invert_vertical=True,
    gripper_button=0, release_button=2, cruise_button=3,
)

# Logitech F310 (XInput mode, the X/D switch set to X):
#   left stick  X/Y = axes 0 / 1
#   right stick X/Y = axes 3 / 4
#   right trigger (RT) = analog axis 5, resting at -1.0, +1.0 fully squeezed
# Control layout: LEFT stick Y -> vertical, RIGHT stick Y -> forward,
# RIGHT stick X -> turn. The right trigger (RT) grips; the A button (0) opens
# the gripper to release; the B button (1) toggles cruise control.
PROFILE_F310 = ControllerProfile(
    name="Logitech Gamepad F310",
    axis_forward=4, axis_turn=3, axis_vertical=1,
    invert_forward=True, invert_turn=False, invert_vertical=True,
    gripper_axis=5, gripper_axis_rest=-1.0,
    release_button=0, cruise_button=1,
)

# A safe fallback used when the controller name isn't recognized. Assumes a
# dual-stick layout: left stick Y (axis 1) = vertical, right stick Y (axis 4)
# = forward, right stick X (axis 3) = turn.
PROFILE_DEFAULT = ControllerProfile(
    name="Generic",
    axis_forward=4, axis_turn=3, axis_vertical=1,
    gripper_button=0, release_button=1, cruise_button=2,
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
        if profile.gripper_button < joystick.get_numbuttons():
            return 1.0 if joystick.get_button(profile.gripper_button) else 0.0
        return 0.0
    if profile.gripper_axis is not None:
        if profile.gripper_axis < joystick.get_numaxes():
            raw = joystick.get_axis(profile.gripper_axis)
            return max(0.0, min(1.0, (raw - profile.gripper_axis_rest) / 2.0))
        return 0.0
    return 0.0


def pressed_edge(joystick, button, previous_states):
    """True only on the frame a button goes from up to down (one press)."""
    if button is None or button >= joystick.get_numbuttons():
        return False
    now = bool(joystick.get_button(button))
    was = previous_states.get(button, False)
    previous_states[button] = now
    return now and not was


def calibrate(joystick):
    click.echo("Move each control and watch which number changes. Ctrl+C to stop.")
    click.echo("(axes first, then buttons)")
    while True:
        pygame.event.pump()
        axes = [round(joystick.get_axis(i), 2) for i in range(joystick.get_numaxes())]
        buttons = [joystick.get_button(i) for i in range(joystick.get_numbuttons())]
        click.echo(f"axes={axes}  buttons={buttons}")
        time.sleep(0.2)


@click.command()
@click.argument("pi_address")
@click.option("--port", default=5005, show_default=True, help="UDP port on the Pi.")
@click.option(
    "--calibrate", "do_calibrate", is_flag=True,
    help="Print raw axis/button values instead of sending commands.",
)
def main(pi_address, port, do_calibrate):
    """Pilot the ROV: read the controller and send commands to PI_ADDRESS."""
    pygame.init()
    pygame.joystick.init()
    if pygame.joystick.get_count() == 0:
        raise click.ClickException("No game controller detected - plug one in and try again.")
    joystick = pygame.joystick.Joystick(0)
    joystick.init()
    name = joystick.get_name()
    click.echo(f"Using controller: {name}")

    if do_calibrate:
        calibrate(joystick)
        return

    profile = pick_profile(name)
    click.echo(f"Matched profile: {profile.name}")
    click.echo("Left stick = vertical, right stick = forward/turn. "
               "Squeeze trigger to grip (it holds); release button opens it; "
               "cruise button holds speed.")

    def read_axis(index, invert):
        if index >= joystick.get_numaxes():
            return 0.0
        value = apply_deadzone(joystick.get_axis(index))
        return -value if invert else value

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    target = (pi_address, port)
    interval = 1.0 / SEND_RATE_HZ

    buttons = {}            # last-seen state per button, for edge detection
    cruise_speed = None     # forward speed being held, or None when cruise off

    try:
        while True:
            pygame.event.pump()

            stick_forward = read_axis(profile.axis_forward, profile.invert_forward)
            turn = read_axis(profile.axis_turn, profile.invert_turn)
            vertical = read_axis(profile.axis_vertical, profile.invert_vertical)
            gripper = read_gripper(joystick, profile)  # squeeze trigger = grip

            # --- gripper release: squeezing the trigger grips and HOLDS the
            # grip on its own (the Pi keeps it closed when you let go). This
            # button opens the gripper to let the object go. --------------
            gripper_release = pressed_edge(joystick, profile.release_button, buttons)
            if gripper_release:
                click.echo("Gripper opened (released object)")

            # --- cruise control: a button press toggles holding forward -----
            if pressed_edge(joystick, profile.cruise_button, buttons):
                if cruise_speed is None:
                    cruise_speed = stick_forward
                    click.echo(f"Cruise ON at forward={cruise_speed:+.2f}")
                else:
                    cruise_speed = None
                    click.echo("Cruise OFF")
            # Pushing the forward stick hard cancels cruise (manual override).
            if cruise_speed is not None and abs(stick_forward) > CRUISE_CANCEL_PUSH:
                cruise_speed = None
                click.echo("Cruise cancelled (manual throttle)")

            forward = cruise_speed if cruise_speed is not None else stick_forward

            message = f"{forward},{turn},{vertical},{gripper},{int(gripper_release)}"
            sock.sendto(message.encode("utf-8"), target)
            time.sleep(interval)
    except KeyboardInterrupt:
        sock.sendto(b"0,0,0,0,0", target)  # explicit stop on the way out
    finally:
        sock.close()


if __name__ == "__main__":
    main()
