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
    LEFT TRIGGER (cruise)  -> squeeze once to TOGGLE cruise ON: lock all three
                              thruster speeds (forward, turn, vertical)
                              hands-free. Squeeze again to toggle cruise OFF.
                              Moving ANY stick also cancels cruise.

Specific controls per controller (axis/button indices are what pygame reports;
see the profiles below and use --calibrate to confirm on yours):
    Logitech F310 (XInput, X/D switch on X): grip = right trigger (RT, axis 5);
        RELEASE = A button (0); cruise TOGGLE = left trigger (LT, axis 2).
    Logitech Extreme 3D Pro: grip = the stick trigger (button 0);
        RELEASE = button 2; cruise toggle = button 3 (no left trigger, so a
        button toggles it instead).

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
CRUISE_CANCEL_PUSH = 0.5   # a FRESH stick push past this cancels cruise control
CRUISE_NEUTRAL = 0.2       # sticks within this of center count as "let go"
CRUISE_ENGAGE_SQUEEZE = 0.5  # squeeze the cruise trigger (LT) past this to engage


class ControllerProfile:
    """Describes how to read one kind of controller.

    axis_* are axis indices. invert_* flip an axis so that "push up / push
    forward" gives a positive command. gripper_button is a button index used
    as the trigger; gripper_axis is an analog trigger axis used instead when
    gripper_button is None. release_button opens the gripper to let go.
    Cruise control is TOGGLED by squeezing cruise_axis (an analog trigger, e.g.
    the left trigger) - or, if a pad has no spare trigger, by cruise_button -
    and is also cancelled by moving any stick. (None = that control isn't
    present on this pad.)
    """

    def __init__(self, name, axis_forward, axis_turn, axis_vertical,
                 invert_forward=True, invert_turn=False, invert_vertical=True,
                 gripper_button=None, gripper_axis=None, gripper_axis_rest=-1.0,
                 release_button=None, cruise_button=None,
                 cruise_axis=None, cruise_axis_rest=-1.0):
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
        self.cruise_axis = cruise_axis            # analog trigger that engages cruise
        self.cruise_axis_rest = cruise_axis_rest


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
#   left  trigger (LT) = analog axis 2, resting at -1.0, +1.0 fully squeezed
#   right trigger (RT) = analog axis 5, resting at -1.0, +1.0 fully squeezed
# Control layout: LEFT stick Y -> vertical, RIGHT stick Y -> forward,
# RIGHT stick X -> turn. The right trigger (RT) grips; the A button (0) opens
# the gripper to release. The LEFT trigger (LT) TOGGLES cruise control on/off
# (locking all three thruster speeds); moving any stick also cancels it.
PROFILE_F310 = ControllerProfile(
    name="Logitech Gamepad F310",
    axis_forward=4, axis_turn=3, axis_vertical=1,
    invert_forward=True, invert_turn=False, invert_vertical=True,
    gripper_axis=5, gripper_axis_rest=-1.0,
    release_button=0, cruise_button=1,
    cruise_axis=2, cruise_axis_rest=-1.0,
)

# A safe fallback used when the controller name isn't recognized. Assumes a
# dual-stick layout: left stick Y (axis 1) = vertical, right stick Y (axis 4)
# = forward, right stick X (axis 3) = turn.
PROFILE_DEFAULT = ControllerProfile(
    name="Generic",
    axis_forward=4, axis_turn=3, axis_vertical=1,
    gripper_button=0, release_button=1, cruise_button=2,
    cruise_axis=2, cruise_axis_rest=-1.0,
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
    """Return 0.0 (not squeezing) .. 1.0 (fully squeezed = grip) from the trigger."""
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


def read_trigger(joystick, axis, rest):
    """Read an analog trigger as 0.0 (resting) .. 1.0 (fully squeezed)."""
    if axis is None or axis >= joystick.get_numaxes():
        return 0.0
    raw = joystick.get_axis(axis)
    return max(0.0, min(1.0, (raw - rest) / 2.0))


def pressed_edge(joystick, button, previous_states):
    """True only on the frame a button goes from up to down (one press)."""
    if button is None or button >= joystick.get_numbuttons():
        return False
    now = bool(joystick.get_button(button))
    was = previous_states.get(button, False)
    previous_states[button] = now
    return now and not was


def squeezed_edge(amount, key, previous_states):
    """True only on the frame an analog trigger crosses the engage threshold."""
    now = amount >= CRUISE_ENGAGE_SQUEEZE
    was = previous_states.get(key, False)
    previous_states[key] = now
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
               "Right trigger grips (it holds); release button opens it. "
               "Left trigger toggles cruise (locks all 3 speeds); move a stick to cancel.")

    def read_axis(index, invert):
        if index >= joystick.get_numaxes():
            return 0.0
        value = apply_deadzone(joystick.get_axis(index))
        return -value if invert else value

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    target = (pi_address, port)
    interval = 1.0 / SEND_RATE_HZ

    buttons = {}            # last-seen state per button/trigger, for edge detection
    cruise_locked = None    # (forward, turn, vertical) being held, or None when off
    cruise_cancel_armed = False  # True once sticks are centered, so a push cancels

    try:
        while True:
            pygame.event.pump()

            stick_forward = read_axis(profile.axis_forward, profile.invert_forward)
            stick_turn = read_axis(profile.axis_turn, profile.invert_turn)
            stick_vertical = read_axis(profile.axis_vertical, profile.invert_vertical)
            gripper = read_gripper(joystick, profile)  # squeeze trigger = grip
            cruise_trigger = read_trigger(joystick, profile.cruise_axis,
                                          profile.cruise_axis_rest)

            # --- gripper release: squeezing the trigger grips and HOLDS the
            # grip on its own (the Pi keeps it closed when you let go). This
            # button opens the gripper to let the object go. --------------
            gripper_release = pressed_edge(joystick, profile.release_button, buttons)
            if gripper_release:
                click.echo("Gripper opened (released object)")

            # --- cruise control -------------------------------------------
            # The LEFT TRIGGER (LT) TOGGLES cruise: push the sticks where you
            # want, squeeze LT once to lock ALL THREE thruster speeds (forward,
            # turn, vertical), then LET GO of the sticks - cruise keeps holding.
            # Squeeze LT again to turn cruise off. A FRESH stick push also
            # cancels it, but only after the sticks have first returned to
            # center, so releasing them when you engage does NOT cancel. (A pad
            # with no spare trigger, like the flight stick, toggles with its
            # cruise button instead.)
            if profile.cruise_axis is not None:
                cruise_toggle = squeezed_edge(cruise_trigger, "cruise_axis", buttons)
            else:
                cruise_toggle = pressed_edge(joystick, profile.cruise_button, buttons)

            sticks_at_neutral = max(abs(stick_forward), abs(stick_turn),
                                    abs(stick_vertical)) < CRUISE_NEUTRAL
            sticks_pushed = max(abs(stick_forward), abs(stick_turn),
                                abs(stick_vertical)) > CRUISE_CANCEL_PUSH

            if cruise_locked is None:
                if cruise_toggle:
                    cruise_locked = (stick_forward, stick_turn, stick_vertical)
                    # Don't let the sticks returning to center from THIS engage
                    # position count as a cancel: arm the manual-override cancel
                    # only once the sticks have gone back to neutral.
                    cruise_cancel_armed = sticks_at_neutral
                    click.echo(
                        "Cruise ON - locked forward={:+.2f} turn={:+.2f} "
                        "vertical={:+.2f}".format(*cruise_locked)
                    )
            else:
                if sticks_at_neutral:
                    cruise_cancel_armed = True   # you've let go; a new push can cancel
                if cruise_toggle:
                    cruise_locked = None
                    click.echo("Cruise OFF (trigger)")
                elif cruise_cancel_armed and sticks_pushed:
                    cruise_locked = None
                    click.echo("Cruise cancelled (manual control)")

            cruise_on = cruise_locked is not None
            if cruise_on:
                forward, turn, vertical = cruise_locked
            else:
                forward, turn, vertical = stick_forward, stick_turn, stick_vertical

            # 6th field: cruise_on, so the server (and the dashboard) can show it.
            message = (f"{forward},{turn},{vertical},{gripper},"
                       f"{int(gripper_release)},{int(cruise_on)}")
            sock.sendto(message.encode("utf-8"), target)
            time.sleep(interval)
    except KeyboardInterrupt:
        sock.sendto(b"0,0,0,0,0,0", target)  # explicit stop on the way out
    finally:
        sock.close()


if __name__ == "__main__":
    main()
