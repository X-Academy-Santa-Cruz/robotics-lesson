"""
Runs on the Pi. Listens for UDP control packets from pilot.py and drives
the thrusters accordingly, stopping automatically if commands stop arriving
(e.g. the network connection drops).

Reuses the ThrusterRig built in the thrusters lesson instead of rewriting
thruster control from scratch.

Packet format (comma-separated):
    forward,turn,vertical,gripper[,gripper_hold]
  forward/turn/vertical : -1.0 .. +1.0 thruster commands
  gripper               : 0.0 (closed) .. 1.0 (open)
  gripper_hold          : 1 = latch the gripper at its current position and
                          keep holding without the trigger; 0 = normal.
                          Optional, so older 4-value packets still work.

Cruise control lives in the pilot: it just sends a steady forward value while
cruise is on, so the server stays a simple, stateless applier.
"""

import socket
import sys
from pathlib import Path

import click

# thruster_control.py lives in a sibling folder, not an installed package -
# add it to Python's module search path so we can import ThrusterRig from it.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "thrusters"))
from thruster_control import ThrusterRig  # noqa: E402

FAILSAFE_SECONDS = 0.5  # stop the thrusters if no packet arrives for this long


def parse_packet(data: bytes):
    # "forward,turn,vertical,gripper[,gripper_hold]". Older 4-value packets
    # still work - gripper_hold defaults to off.
    parts = [float(v) for v in data.decode("utf-8").split(",")]
    forward, turn, vertical = parts[0], parts[1], parts[2]
    gripper = parts[3] if len(parts) > 3 else 0.0
    gripper_hold = bool(parts[4]) if len(parts) > 4 else False
    return forward, turn, vertical, gripper, gripper_hold


@click.command()
@click.option("--port", default=5005, show_default=True, help="UDP port to listen on.")
@click.option(
    "--address", default="0x40", show_default=True,
    help="Pi Servo HAT I2C address (e.g. 0x40).",
)
def main(port, address):
    """Listen for pilot commands and drive the thrusters."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("0.0.0.0", port))
    sock.settimeout(FAILSAFE_SECONDS)

    rig = ThrusterRig(i2c_address=int(address, 0))
    was_holding = False
    try:
        rig.arm()
        click.echo(f"Listening for pilot commands on UDP port {port}...")
        while True:
            try:
                data, _addr = sock.recvfrom(1024)
            except socket.timeout:
                rig.stop()
                click.echo("No command received - stopping thrusters (failsafe)")
                continue
            try:
                forward, turn, vertical, gripper, hold = parse_packet(data)
            except (ValueError, IndexError):
                continue  # ignore a malformed packet, just wait for the next one
            rig.drive(forward, turn, vertical)
            # Latch or unlatch the gripper hold as the pilot requests, then let
            # the rig apply the trigger value (ignored while held).
            if hold and not was_holding:
                rig.hold_gripper()
            elif not hold and was_holding:
                rig.release_gripper()
            was_holding = hold
            rig.apply_gripper_command(gripper)
    except KeyboardInterrupt:
        pass
    finally:
        rig.close()
        sock.close()


if __name__ == "__main__":
    main()
