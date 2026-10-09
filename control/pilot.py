"""
Runs on the laptop. Reads a game controller and sends forward/turn/vertical
commands to rov_server.py on the Pi over UDP, continuously, at a fixed rate.
"""

import argparse
import socket
import time

import pygame

SEND_RATE_HZ = 20
DEADZONE = 0.15

# Axis indices and signs vary by controller and OS - run with --calibrate
# and wiggle each stick to find the right numbers for your specific gamepad.
AXIS_FORWARD = 1   # left stick vertical (often inverted: up = -1.0)
AXIS_TURN = 0      # left stick horizontal
AXIS_VERTICAL = 3  # right stick vertical


def apply_deadzone(value: float) -> float:
    """Treat small stick drift near center as exactly zero."""
    return 0.0 if abs(value) < DEADZONE else value


def calibrate(joystick):
    print("Move each stick and watch which number changes. Ctrl+C to stop.")
    while True:
        pygame.event.pump()
        values = [round(joystick.get_axis(i), 2) for i in range(joystick.get_numaxes())]
        print(values)
        time.sleep(0.2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pi_address", help="IP address of the Pi, e.g. 192.168.1.42")
    parser.add_argument("--port", type=int, default=5005)
    parser.add_argument(
        "--calibrate", action="store_true",
        help="print raw axis values instead of sending commands",
    )
    args = parser.parse_args()

    pygame.init()
    pygame.joystick.init()
    if pygame.joystick.get_count() == 0:
        raise RuntimeError("No game controller detected - plug one in and try again.")
    joystick = pygame.joystick.Joystick(0)
    joystick.init()
    print(f"Using controller: {joystick.get_name()}")

    if args.calibrate:
        calibrate(joystick)
        return

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    target = (args.pi_address, args.port)
    interval = 1.0 / SEND_RATE_HZ

    try:
        while True:
            pygame.event.pump()
            forward = -apply_deadzone(joystick.get_axis(AXIS_FORWARD))
            turn = apply_deadzone(joystick.get_axis(AXIS_TURN))
            vertical = -apply_deadzone(joystick.get_axis(AXIS_VERTICAL))

            message = f"{forward},{turn},{vertical}".encode("utf-8")
            sock.sendto(message, target)

            time.sleep(interval)
    except KeyboardInterrupt:
        sock.sendto(b"0,0,0", target)  # explicit stop on the way out
    finally:
        sock.close()


if __name__ == "__main__":
    main()
