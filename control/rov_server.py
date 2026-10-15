"""
Runs on the Pi. Listens for UDP control packets from pilot.py and drives
the thrusters accordingly, stopping automatically if commands stop arriving
(e.g. the network connection drops). It also STREAMS TELEMETRY over UDP to the
dashboard app (see the dashboard/ folder): per-channel PWM, power percent and
direction, the water temperature, and the cruise / gripper state.

Reuses the ThrusterRig built in the thrusters lesson instead of rewriting
thruster control from scratch.

Control packet in (comma-separated), from pilot.py:
    forward,turn,vertical,gripper[,gripper_release][,cruise_on][,estop]
  forward/turn/vertical : -1.0 .. +1.0 thruster commands
  gripper               : 0.0 (not squeezing) .. 1.0 (trigger squeezed = grip)
  gripper_release       : 1 = open the gripper to let go; 0 = normal.
  cruise_on             : 1 = pilot is holding speed with cruise; 0 = manual.
  estop                 : 1 = EMERGENCY STOP engaged (thrusters forced to zero).
  (trailing fields are optional, so older packets still work.)

Telemetry packet out: one JSON object per update, sent to --telemetry-host:
--telemetry-port. The dashboard reads it; nothing has to connect back.
"""

import json
import socket
import sys
import time
from pathlib import Path

import click

# thruster_control.py lives in a sibling folder, not an installed package -
# add it (and sensors/, for the temperature reader) to the import path.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "thrusters"))
sys.path.insert(0, str(ROOT / "sensors"))
from thruster_control import ThrusterRig  # noqa: E402

FAILSAFE_SECONDS = 0.5   # stop the thrusters if no packet arrives for this long
TEMP_PERIOD = 1.0        # read the (slow) I2C temperature sensor this often


def parse_packet(data: bytes):
    # forward,turn,vertical,gripper[,gripper_release][,cruise_on]
    parts = [float(v) for v in data.decode("utf-8").split(",")]
    forward, turn, vertical = parts[0], parts[1], parts[2]
    gripper = parts[3] if len(parts) > 3 else 0.0
    gripper_release = bool(parts[4]) if len(parts) > 4 else False
    cruise_on = bool(parts[5]) if len(parts) > 5 else False
    estop = bool(parts[6]) if len(parts) > 6 else False
    return forward, turn, vertical, gripper, gripper_release, cruise_on, estop


class TemperatureReader:
    """Reads the STTS22H if it's present, throttled so it doesn't slow the
    control loop. Returns None (not an error) when there's no sensor."""

    def __init__(self, bus_num=1):
        self._bus = None
        self._read = None
        self._last = None
        self._last_time = 0.0
        try:
            from smbus2 import SMBus
            import temperature_smbus2 as temp
            self._bus = SMBus(bus_num)
            temp.setup_sensor(self._bus)
            self._read = temp.read_temperature_c
        except Exception:
            self._bus = None  # no sensor / library - telemetry just omits temp

    def latest(self):
        if self._bus is None or self._read is None:
            return None
        now = time.time()
        if now - self._last_time >= TEMP_PERIOD:
            self._last_time = now
            try:
                self._last = round(self._read(self._bus), 2)
            except Exception:
                self._last = None
        return self._last


@click.command()
@click.option("--port", default=5005, show_default=True, help="UDP port to listen on.")
@click.option(
    "--address", default="0x40", show_default=True,
    help="Pi Servo HAT I2C address (e.g. 0x40).",
)
@click.option("--telemetry-host", default="127.0.0.1", show_default=True,
              help="Where to send telemetry (the dashboard's address).")
@click.option("--telemetry-port", default=5006, show_default=True,
              help="UDP port the dashboard listens on for telemetry.")
@click.option("--bus", default=1, show_default=True, help="I2C bus for the temp sensor.")
def main(port, address, telemetry_host, telemetry_port, bus):
    """Drive the thrusters from pilot commands and stream telemetry out."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("0.0.0.0", port))
    sock.settimeout(FAILSAFE_SECONDS)

    tele_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    tele_target = (telemetry_host, telemetry_port)

    rig = ThrusterRig(i2c_address=int(address, 0))
    temp_reader = TemperatureReader(bus_num=bus)
    cruise_on = False

    estopped = False

    def send_telemetry():
        snap = rig.telemetry()
        snap["cruise"] = cruise_on
        snap["estop"] = estopped
        snap["temperature_c"] = temp_reader.latest()
        snap["time"] = round(time.time(), 2)
        try:
            tele_sock.sendto(json.dumps(snap).encode("utf-8"), tele_target)
        except OSError:
            pass  # dashboard not up yet / unreachable - keep flying regardless

    try:
        rig.arm()
        click.echo(f"Listening for pilot commands on UDP port {port}...")
        click.echo(f"Streaming telemetry to {telemetry_host}:{telemetry_port}")
        while True:
            try:
                data, _addr = sock.recvfrom(1024)
            except socket.timeout:
                rig.stop()
                cruise_on = False
                click.echo("No command received - stopping thrusters (failsafe)")
                send_telemetry()
                continue
            try:
                forward, turn, vertical, gripper, release, cruise_on, estopped = parse_packet(data)
            except (ValueError, IndexError):
                continue  # ignore a malformed packet, just wait for the next one
            if estopped:
                # Pilot is holding emergency stop. The pilot already sends zeros,
                # but stop() here too as a belt-and-suspenders guarantee.
                rig.stop()
            else:
                rig.drive(forward, turn, vertical)
            # The gripper grips when the trigger is squeezed and HOLDS that grip
            # when the trigger is released; the release flag opens it to let go.
            # (The gripper stays controllable during e-stop so you can let go of
            # whatever you're holding.)
            if release:
                rig.open_gripper()
            else:
                rig.apply_gripper_command(gripper)
            send_telemetry()
    except KeyboardInterrupt:
        pass
    finally:
        rig.close()
        sock.close()
        tele_sock.close()


if __name__ == "__main__":
    main()
