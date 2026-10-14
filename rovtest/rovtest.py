"""
rovtest - a command-line tool to check out the ROV's hardware, one piece at a
time. Use it to confirm a new build is wired and working before you try to
pilot it.

It reuses the same ThrusterRig and sensor code as the lessons, so if a test
passes here, the real programs will see the same hardware.

Examples:
    python3 rovtest.py scan-i2c                 # what's on the I2C bus?
    python3 rovtest.py arm                      # arm the thrusters (safety test)
    python3 rovtest.py thruster left --percent 30 --seconds 2
    python3 rovtest.py thruster vertical --pulse 1.6 --seconds 2
    python3 rovtest.py temperature             # read the temp sensor
    python3 rovtest.py camera                  # is a camera available?
    python3 rovtest.py all                     # run every non-moving check

SAFETY: any command that spins a thruster needs props removed, or the ROV
fully submerged and clear of hands. Every thruster test arms first, runs for a
fixed number of seconds, then stops - it never leaves a thruster running.
"""

import subprocess
import sys
import time
from pathlib import Path

import click

# Reuse the lesson code: ThrusterRig (thrusters/) and the smbus2 sensor helpers
# (sensors/). Add both sibling folders to the import path.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "thrusters"))
sys.path.insert(0, str(ROOT / "sensors"))

from thruster_control import (  # noqa: E402
    ThrusterRig, THRUSTER_CHANNELS, MIN_PULSE_MS, MAX_PULSE_MS,
)

OK = click.style("[ OK ]", fg="green")
FAIL = click.style("[FAIL]", fg="red")


@click.group(help=__doc__)
@click.option("--address", default="0x40", show_default=True,
              help="Pi Servo HAT I2C address (e.g. 0x40).")
@click.option("--bus", default=1, show_default=True, help="I2C bus number.")
@click.pass_context
def cli(ctx, address, bus):
    ctx.ensure_object(dict)
    ctx.obj["address"] = int(address, 0)
    ctx.obj["bus"] = bus


# ---------------------------------------------------------------------------
# Thrusters
# ---------------------------------------------------------------------------

@cli.command()
@click.pass_context
def arm(ctx):
    """Arm the thrusters (sends neutral, then confirms), and stop."""
    rig = ThrusterRig(i2c_address=ctx.obj["address"])
    try:
        rig.arm()
        click.echo(f"{OK} thrusters armed")
    finally:
        rig.close()


@cli.command()
@click.argument("which", type=click.Choice(sorted(THRUSTER_CHANNELS)))
@click.option("--percent", type=click.FloatRange(-100, 100),
              help="Power as a percent, -100..100 (negative = reverse).")
@click.option("--pulse", type=click.FloatRange(MIN_PULSE_MS, MAX_PULSE_MS),
              help=f"Raw pulse width in ms, {MIN_PULSE_MS}..{MAX_PULSE_MS}.")
@click.option("--seconds", default=2.0, show_default=True,
              help="How long to run the thruster before stopping.")
@click.pass_context
def thruster(ctx, which, percent, pulse, seconds):
    """Spin ONE thruster (left/right/vertical) by percent OR raw pulse.

    Give exactly one of --percent or --pulse. The thruster arms, runs for
    --seconds, then stops. PROPS OFF or ROV SUBMERGED AND CLEAR.
    """
    if (percent is None) == (pulse is None):
        raise click.UsageError("Give exactly one of --percent or --pulse.")

    channel = THRUSTER_CHANNELS[which]
    rig = ThrusterRig(i2c_address=ctx.obj["address"])
    try:
        rig.arm()
        if percent is not None:
            click.echo(f"{which} thruster: {percent:+.0f}% for {seconds:.1f}s "
                       "(keep clear of props)")
            rig.set_channel_throttle(channel, percent / 100.0)
        else:
            click.echo(f"{which} thruster: {pulse:.3f} ms pulse for {seconds:.1f}s "
                       "(keep clear of props)")
            rig.set_channel_pulse_ms(channel, pulse)
        time.sleep(seconds)
    finally:
        rig.close()  # always stops and cuts the signal
        click.echo(f"{OK} {which} thruster stopped")


# ---------------------------------------------------------------------------
# Gripper
# ---------------------------------------------------------------------------

@cli.command()
@click.option("--open", "action", flag_value="open", help="Open the gripper.")
@click.option("--close", "action", flag_value="close", default=True,
              help="Close the gripper (default).")
@click.pass_context
def gripper(ctx, action):
    """Open or close the gripper once, to check it moves."""
    rig = ThrusterRig(i2c_address=ctx.obj["address"])
    try:
        rig.arm()
        # set_gripper: 0.0 = open, 1.0 = closed
        rig.set_gripper(0.0 if action == "open" else 1.0)
        time.sleep(1.5)
        click.echo(f"{OK} gripper {action}")
    finally:
        rig.close()


# ---------------------------------------------------------------------------
# I2C
# ---------------------------------------------------------------------------

def _i2c_present(bus_num, addr):
    """True if a device answers at addr on the given I2C bus."""
    try:
        from smbus2 import SMBus
        with SMBus(bus_num) as bus:
            bus.read_byte(addr)
        return True
    except Exception:
        return False


@cli.command("scan-i2c")
@click.pass_context
def scan_i2c(ctx):
    """List the I2C devices on the bus and check the ones the ROV expects."""
    bus_num = ctx.obj["bus"]

    # Show the full bus with i2cdetect if it's installed (nice for students).
    try:
        out = subprocess.run(
            ["i2cdetect", "-y", str(bus_num)],
            capture_output=True, text=True, timeout=10,
        )
        if out.returncode == 0:
            click.echo(out.stdout.rstrip())
    except (FileNotFoundError, subprocess.SubprocessError):
        click.echo("(i2cdetect not available; checking expected addresses only)")

    # Check the two devices the ROV uses by name.
    expected = {
        "Servo HAT (PCA9685)": ctx.obj["address"],
        "Temp sensor (STTS22H)": 0x3C,
    }
    click.echo()
    all_ok = True
    for label, addr in expected.items():
        if _i2c_present(bus_num, addr):
            click.echo(f"{OK} {label} at 0x{addr:02X}")
        else:
            click.echo(f"{FAIL} {label} NOT found at 0x{addr:02X}")
            all_ok = False
    if not all_ok:
        raise SystemExit(1)


# ---------------------------------------------------------------------------
# Temperature sensor
# ---------------------------------------------------------------------------

@cli.command()
@click.option("--samples", default=3, show_default=True, help="How many reads.")
@click.pass_context
def temperature(ctx, samples):
    """Read the STTS22H temperature sensor a few times."""
    try:
        from smbus2 import SMBus
        import temperature_smbus2 as temp  # the lesson's helpers
    except Exception as exc:  # noqa: BLE001
        click.echo(f"{FAIL} can't load the sensor code: {exc}")
        raise SystemExit(1)

    try:
        with SMBus(ctx.obj["bus"]) as bus:
            temp.setup_sensor(bus)            # checks WHO_AM_I, starts the sensor
            for _ in range(samples):
                c = temp.read_temperature_c(bus)
                click.echo(f"{OK} temperature: {c:.2f} C")
                time.sleep(0.3)
    except Exception as exc:  # noqa: BLE001
        click.echo(f"{FAIL} could not read the sensor: {exc}")
        raise SystemExit(1)


# ---------------------------------------------------------------------------
# Camera
# ---------------------------------------------------------------------------

@cli.command()
@click.option("--index", default=0, show_default=True,
              help="Camera index (/dev/videoN); 0 is the first USB camera.")
@click.pass_context
def camera(ctx, index):
    """Check a camera is available and can grab a frame."""
    try:
        import cv2
    except Exception as exc:  # noqa: BLE001
        click.echo(f"{FAIL} OpenCV (cv2) isn't installed: {exc}")
        raise SystemExit(1)

    cap = cv2.VideoCapture(index)
    try:
        if not cap.isOpened():
            click.echo(f"{FAIL} no camera at index {index} (/dev/video{index})")
            raise SystemExit(1)
        ok, frame = cap.read()
        if not ok or frame is None:
            click.echo(f"{FAIL} camera opened but returned no frame")
            raise SystemExit(1)
        h, w = frame.shape[:2]
        click.echo(f"{OK} camera {index} works - grabbed a {w}x{h} frame")
    finally:
        cap.release()


# ---------------------------------------------------------------------------
# Everything that doesn't move a thruster
# ---------------------------------------------------------------------------

@cli.command("all")
@click.pass_context
def run_all(ctx):
    """Run every non-moving check: I2C scan, temperature, camera."""
    failed = False
    for name in ("scan-i2c", "temperature", "camera"):
        click.echo(click.style(f"\n== {name} ==", bold=True))
        try:
            ctx.invoke(cli.get_command(ctx, name))
        except SystemExit as exc:
            if exc.code:
                failed = True
    if failed:
        click.echo(click.style("\nSome checks failed.", fg="red"))
        raise SystemExit(1)
    click.echo(click.style("\nAll checks passed.", fg="green"))


if __name__ == "__main__":
    cli()
