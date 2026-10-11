"""
Runs on the Pi. Listens for UDP control packets from pilot.py and drives
the thrusters accordingly, stopping automatically if commands stop arriving
(e.g. the network connection drops).

Reuses the ThrusterRig built in the thrusters lesson instead of rewriting
thruster control from scratch.
"""

import argparse
import socket
import sys
from pathlib import Path

# thruster_control.py lives in a sibling folder, not an installed package -
# add it to Python's module search path so we can import ThrusterRig from it.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "thrusters"))
from thruster_control import ThrusterRig  # noqa: E402

FAILSAFE_SECONDS = 0.5  # stop the thrusters if no packet arrives for this long


def parse_packet(data: bytes):
    # Packets are "forward,turn,vertical,gripper". Older packets without a
    # gripper value still work - the gripper just defaults to closed (0.0).
    parts = [float(v) for v in data.decode("utf-8").split(",")]
    forward, turn, vertical = parts[0], parts[1], parts[2]
    gripper = parts[3] if len(parts) > 3 else 0.0
    return forward, turn, vertical, gripper


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5005)
    parser.add_argument(
        "--address", type=lambda s: int(s, 0), default=0x40,
        help="Pi Servo HAT I2C address (default 0x40)",
    )
    args = parser.parse_args()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("0.0.0.0", args.port))
    sock.settimeout(FAILSAFE_SECONDS)

    rig = ThrusterRig(i2c_address=args.address)
    try:
        rig.arm()
        print(f"Listening for pilot commands on UDP port {args.port}...")
        while True:
            try:
                data, _addr = sock.recvfrom(1024)
            except socket.timeout:
                rig.stop()
                print("No command received - stopping thrusters (failsafe)")
                continue
            try:
                forward, turn, vertical, gripper = parse_packet(data)
            except (ValueError, IndexError):
                continue  # ignore a malformed packet, just wait for the next one
            rig.drive(forward, turn, vertical)
            rig.set_gripper(gripper)
    except KeyboardInterrupt:
        pass
    finally:
        rig.close()
        sock.close()


if __name__ == "__main__":
    main()
