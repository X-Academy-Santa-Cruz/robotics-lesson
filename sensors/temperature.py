# temperature.py
# Reads the SparkFun STTS22H temperature sensor over I2C and plots the
# temperature live with matplotlib (pyplot).
#
# This is the "library" version: it uses the stts22h CircuitPython library,
# which hides the register details - you just read sensor.temperature. For a
# version that talks to the sensor's registers directly (no sensor library),
# see temperature_smbus2.py.
#
# The STTS22H is on the Qwiic connector of the SparkFun Pi Servo HAT, so it
# shares the Pi's I2C bus.
#
# Run it on the Pi:
#     cd robotics-lesson/sensors
#     python3 temperature.py
# Press Ctrl+C to stop. Add --no-plot to just print readings (e.g. over SSH
# with no screen).

import argparse
import time

import board
import stts22h


def c_to_f(celsius):
    return celsius * 9.0 / 5.0 + 32.0


def make_sensor():
    """Open the I2C bus and create the STTS22H sensor object."""
    i2c = board.I2C()              # uses the Pi's I2C pins (SCL/SDA)
    sensor = stts22h.STTS22H(i2c)  # default address 0x3C; raises if not found
    return sensor


def print_loop(sensor, period):
    """Just print the temperature once per 'period' seconds (no graph)."""
    try:
        while True:
            c = sensor.temperature          # degrees Celsius
            print(f"{c:6.2f} C   ({c_to_f(c):6.2f} F)")
            time.sleep(period)
    except KeyboardInterrupt:
        pass


def plot_loop(sensor, period, window):
    """Plot the temperature live. 'window' is how many seconds to show."""
    import os
    import matplotlib

    # A live window needs a display. Over SSH or PyCharm's remote interpreter
    # there is no display on the Pi, so the window opens but never draws.
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

    plt.ion()
    fig, ax = plt.subplots()
    (line,) = ax.plot([], [])
    ax.set_xlabel("seconds")
    ax.set_ylabel("temperature (C)")
    ax.set_title("STTS22H temperature")

    try:
        while True:
            now = time.time() - start
            temps.append(sensor.temperature)
            times.append(now)

            while times and times[0] < now - window:   # keep last 'window' seconds
                times.pop(0); temps.pop(0)

            line.set_data(times, temps)
            ax.relim(); ax.autoscale_view()
            plt.pause(period)
    except KeyboardInterrupt:
        pass


def main():
    ap = argparse.ArgumentParser(description="Read and plot the STTS22H temperature sensor (library version).")
    ap.add_argument("--period", type=float, default=1.0, help="seconds between readings")
    ap.add_argument("--window", type=float, default=60.0, help="seconds of history to plot")
    ap.add_argument("--no-plot", action="store_true", help="print readings instead of plotting")
    args = ap.parse_args()

    sensor = make_sensor()
    print("Reading STTS22H... press Ctrl+C to stop.")
    if args.no_plot:
        print_loop(sensor, args.period)
    else:
        plot_loop(sensor, args.period, args.window)


if __name__ == "__main__":
    main()
