# temperature_smbus2.py  (ALTERNATIVE version)
# Reads the SparkFun STTS22H temperature sensor over I2C and plots the
# temperature live with matplotlib (pyplot).
#
# This is the register-level alternative to temperature.py. It uses NO sensor
# library - just smbus2 - so you can see exactly how an I2C sensor works:
# write and read a few registers by number.
#
# The STTS22H is on the Qwiic connector of the SparkFun Pi Servo HAT, so it
# shares the Pi's I2C bus (bus 1). We talk to it directly with smbus2 - no
# special sensor library needed - so you can see exactly how an I2C sensor
# works: write/read a few registers by number.
#
# Run it on the Pi:
#     cd robotics-lesson/sensors
#     python3 temperature_smbus2.py
# Press Ctrl+C to stop. Add --no-plot to just print readings (e.g. over SSH
# with no screen).

import argparse
import time

from smbus2 import SMBus

# ---- STTS22H registers (from the ST datasheet) ----
STTS22H_ADDR = 0x3C      # default I2C address on the Qwiic breakout
REG_WHOAMI   = 0x01      # identity register; should read 0xA0
REG_CTRL     = 0x04      # control register (mode + output data rate)
REG_STATUS   = 0x05      # status (bit 0 = conversion busy)
REG_TEMP_L   = 0x06      # temperature low byte
REG_TEMP_H   = 0x07      # temperature high byte

WHOAMI_VALUE = 0xA0      # what REG_WHOAMI returns on an STTS22H

# CTRL bits: set free-run (continuous) mode at 25 Hz.
#   bit 2 (FREERUN) = 1  -> keep converting on its own
#   bits 4-5 (ODR)  = 00 -> 25 Hz
CTRL_FREERUN_25HZ = 0b0000_0100


def read_temperature_c(bus):
    """Read one temperature in degrees Celsius from the STTS22H."""
    lo = bus.read_byte_data(STTS22H_ADDR, REG_TEMP_L)
    hi = bus.read_byte_data(STTS22H_ADDR, REG_TEMP_H)
    raw = (hi << 8) | lo                 # combine into a 16-bit number
    if raw >= 32768:                     # top bit set -> negative (two's complement)
        raw -= 65536
    return raw / 100.0                   # STTS22H: 1 count = 0.01 degrees C


def c_to_f(celsius):
    return celsius * 9.0 / 5.0 + 32.0


def setup_sensor(bus):
    """Check we're talking to the right chip, then start continuous reading."""
    who = bus.read_byte_data(STTS22H_ADDR, REG_WHOAMI)
    if who != WHOAMI_VALUE:
        raise RuntimeError(
            f"WHO_AM_I was 0x{who:02X}, expected 0x{WHOAMI_VALUE:02X}. "
            f"Is the STTS22H connected? Check 'i2cdetect -y 1' shows 3c."
        )
    bus.write_byte_data(STTS22H_ADDR, REG_CTRL, CTRL_FREERUN_25HZ)
    time.sleep(0.1)                      # give it a moment to take a reading


def print_loop(bus, period):
    """Just print the temperature once per 'period' seconds (no graph)."""
    try:
        while True:
            c = read_temperature_c(bus)
            print(f"{c:6.2f} C   ({c_to_f(c):6.2f} F)")
            time.sleep(period)
    except KeyboardInterrupt:
        pass


def plot_loop(bus, period, window):
    """Plot the temperature live. 'window' is how many seconds to show."""
    import os
    import matplotlib                    # imported here so --no-plot needs no display

    # A live window needs a display. Running from PyCharm's SSH remote
    # interpreter (or any plain SSH session) there is NO display on the Pi, so
    # a GUI window opens but never draws. Catch that and explain it, instead of
    # leaving a frozen empty window.
    if os.environ.get("DISPLAY", "") == "" and os.environ.get("WAYLAND_DISPLAY", "") == "":
        raise SystemExit(
            "No display found, so the live graph can't be drawn.\n"
            "You're probably running over SSH or from PyCharm's remote "
            "interpreter.\n"
            "Fix it one of these ways:\n"
            "  - run it in a terminal ON the Pi's own desktop, or\n"
            "  - add --no-plot to just print the readings, or\n"
            "  - turn on X11 forwarding so the window opens on your laptop\n"
            "    (see the lesson: 'The graph is empty when run from PyCharm')."
        )

    # Open the live plot in a normal window. PyCharm would otherwise capture it
    # into its "Plots" tool window, which can't update a live animation, so you
    # get an empty box. Forcing the TkAgg backend (from python3-tk) before
    # importing pyplot makes the window animate, from PyCharm or the terminal.
    # Must be set BEFORE "import matplotlib.pyplot".
    try:
        matplotlib.use("TkAgg")
    except Exception:
        pass  # fall back to whatever backend is available

    import matplotlib.pyplot as plt

    times, temps = [], []
    start = time.time()

    plt.ion()                            # interactive mode: update as we go
    fig, ax = plt.subplots()
    (line,) = ax.plot([], [])
    ax.set_xlabel("seconds")
    ax.set_ylabel("temperature (C)")
    ax.set_title("STTS22H temperature")

    try:
        while True:
            now = time.time() - start
            c = read_temperature_c(bus)
            times.append(now)
            temps.append(c)

            # keep only the most recent 'window' seconds
            while times and times[0] < now - window:
                times.pop(0); temps.pop(0)

            line.set_data(times, temps)
            ax.relim(); ax.autoscale_view()
            plt.pause(period)            # draws the graph and waits
    except KeyboardInterrupt:
        pass


def main():
    ap = argparse.ArgumentParser(description="Read and plot the STTS22H temperature sensor.")
    ap.add_argument("--bus", type=int, default=1, help="I2C bus number (default 1)")
    ap.add_argument("--period", type=float, default=1.0, help="seconds between readings")
    ap.add_argument("--window", type=float, default=60.0, help="seconds of history to plot")
    ap.add_argument("--no-plot", action="store_true", help="print readings instead of plotting")
    args = ap.parse_args()

    with SMBus(args.bus) as bus:
        setup_sensor(bus)
        print("Reading STTS22H... press Ctrl+C to stop.")
        if args.no_plot:
            print_loop(bus, args.period)
        else:
            plot_loop(bus, args.period, args.window)


if __name__ == "__main__":
    main()
