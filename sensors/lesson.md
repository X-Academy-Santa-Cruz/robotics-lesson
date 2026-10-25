# Lesson: I2C Temperature Sensor

This stretch lesson reads a temperature sensor over **I2C** and plots the
temperature live. It's a great way to learn how a microcontroller talks to a
sensor chip, and it gives your ROV a real measurement to log.

The sensor is a **SparkFun STTS22H** on a Qwiic board. It plugs into the Qwiic
connector on the SparkFun Pi Servo HAT, so it shares the Pi's I2C bus with the
HAT — no extra wiring beyond the Qwiic cable.

## What you'll build

A Python program that reads the temperature from the STTS22H and draws a live
graph of it with matplotlib. There are two versions in this folder:

| File | For | What it is |
|---|---|---|
| [`temperature.py`](temperature.py) | Normal use | The **library version**. Uses the `stts22h` driver, so you just read `sensor.temperature`. Start here. |
| [`temperature_smbus2.py`](temperature_smbus2.py) | Learning how I2C works | The **register-level version**. Uses only `smbus2` — it reads the sensor's registers by number, no sensor library. |

## What is I2C?

**I2C** is a simple two-wire bus for talking to sensor chips. Two signals are
shared by every device on the bus:

- **SDA** — data
- **SCL** — clock

Each device has a 7-bit **address** so the Pi can talk to the right chip. The
STTS22H's address is **0x3C**. The Qwiic connector is just a tidy 4-pin plug
that carries SDA, SCL, 3.3 V, and ground, so you don't have to wire those by
hand.

## Check the sensor is on the bus

The setup script already enabled I2C. With the sensor plugged into the Servo
HAT's Qwiic connector, confirm the Pi can see it:

```bash
i2cdetect -y 1
```

You should see `3c` in the grid (that's the STTS22H) — and `40`, which is the
Servo HAT itself. If `3c` is missing, re-seat the Qwiic cable and check the HAT
is powered.

## Options for reading the sensor

There's more than one way to get a number out of an I2C sensor in Python:

- **A sensor library** (what `temperature.py` uses). The `stts22h`
  CircuitPython driver knows this chip's registers, so your code is short:
  create the sensor, read `sensor.temperature`. Easiest to use; the trade-off
  is an extra dependency (it runs on Adafruit's Blinka layer on the Pi).
- **Register-level with `smbus2`** (what `temperature_smbus2.py` uses). You
  talk to the chip directly: write its control register to start it, then read
  its temperature registers and do the math yourself. Almost no dependencies,
  and you see exactly what I2C is doing — the best way to *understand* the bus.
- **SparkFun's own Python package** — note there isn't one for the STTS22H
  (SparkFun ships an Arduino library for this sensor, not a Python/Qwiic one),
  which is why the library version uses the `stts22h` CircuitPython driver.

Both versions below print the same temperatures and draw the same graph.

## The library version: `temperature.py`

Everything this needs is already installed: `setup.sh` (run once at the start of
the course) put the `stts22h` CircuitPython driver, Blinka, and the Pi 5 GPIO
backend (`adafruit-lgpio`) into the shared course virtual environment, along with
matplotlib. You don't install anything here — just use that venv.

> **Run it inside the venv.** `import board` only works with the venv active —
> your prompt should show `(.venv)`. If you run `python3 temperature.py`
> without activating first, it uses the system Python (which doesn't have these
> drivers) and you'll get import errors.

The whole read is three lines:

```python
import board, stts22h
i2c = board.I2C()                 # the Pi's I2C pins (SCL/SDA)
sensor = stts22h.STTS22H(i2c)     # default address 0x3C
print(sensor.temperature)         # degrees Celsius
```

Run it on the Pi (with the venv active):

```bash
source ~/robotics-lesson/.venv/bin/activate
cd ~/robotics-lesson/sensors
python3 temperature.py            # live graph
python3 temperature.py --no-plot  # just print readings (good over SSH)
```

Press `Ctrl+C` to stop.

> **Heads up:** the `stts22h` driver is community-maintained and marked
> deprecated upstream, but it still installs and works. If it ever stops
> working, the register-level version below has no such dependency and will
> keep running.

## The register-level alternative: `temperature_smbus2.py`

This version uses only `smbus2` and talks to the STTS22H's registers directly.
`smbus2` is already in the shared venv (`setup.sh` installed it), so there's
nothing to install.

### How it reads the chip

Every I2C sensor has a set of numbered **registers** — little memory slots you
read from or write to. The STTS22H's are:

| Register | Address | What it's for |
|---|---|---|
| WHO_AM_I | `0x01` | Identity — always reads `0xA0` on an STTS22H, so you can confirm you're talking to the right chip |
| CTRL | `0x04` | Control — turn on continuous reading and set the data rate |
| STATUS | `0x05` | Busy/limit flags |
| TEMP_L | `0x06` | Temperature, low byte |
| TEMP_H | `0x07` | Temperature, high byte |

Reading the temperature is: read the two temperature bytes, combine them into a
16-bit number, handle the sign, and divide by 100 (the sensor reports
hundredths of a degree):

```python
from smbus2 import SMBus

ADDR = 0x3C
with SMBus(1) as bus:                         # bus 1 = /dev/i2c-1
    lo = bus.read_byte_data(ADDR, 0x06)
    hi = bus.read_byte_data(ADDR, 0x07)
    raw = (hi << 8) | lo
    if raw >= 32768:                          # top bit set -> negative
        raw -= 65536
    celsius = raw / 100.0                     # 1 count = 0.01 C
    print(celsius)
```

The full file adds a WHO_AM_I check, starts continuous mode by writing CTRL,
and plots the readings. Run it the same way:

```bash
source ~/robotics-lesson/.venv/bin/activate
cd ~/robotics-lesson/sensors
python3 temperature_smbus2.py
python3 temperature_smbus2.py --no-plot
```

## The graph is empty when run from PyCharm

A common one: the live plot opens an **empty, frozen window** from PyCharm, but
plots fine when you run the same script from a terminal. The fix depends on
where PyCharm is running the code.

### If PyCharm is running on the Pi itself

This is the usual setup. PyCharm tries to capture plots into its own **Plots**
tool window (SciView), which only shows a *static* figure — it can't drive our
live `plt.ion()` / `plt.pause()` loop, so the window stays blank.

**The scripts already handle this for you.** They force matplotlib's `TkAgg`
backend before plotting, which opens a normal, animating window from PyCharm
just like the terminal. The Tk backend itself is installed by `setup.sh`, so on
an up-to-date copy of the code it should simply work — just make sure you have
the latest code.

If you're writing your own plotting script, do the same at the top, **before**
`import matplotlib.pyplot`:

```python
import matplotlib
matplotlib.use("TkAgg")
import matplotlib.pyplot as plt
```

A couple more things that help:

- **Use Run, not the Python Console** — the Console also captures plots. Run
  the file with the green ▶ Run button.
- You can also turn off PyCharm's plot capture in **Settings**, under the
  Python plots / scientific settings (the exact name moves between PyCharm
  versions — search Settings for "plot"). With the `TkAgg` line above you
  shouldn't need to.

### If PyCharm is running on the Pi over SSH (remote interpreter)

Then the script runs on the Pi in a session with **no display**, so matplotlib
opens a window that never draws. (The scripts notice this and print a short
message instead of leaving a dead window.) Pick one:

- **Print instead of plot** — usually all you want over SSH. Add `--no-plot`
  (in PyCharm, put it in the run configuration's *Parameters* box):
  ```bash
  python3 temperature.py --no-plot
  ```
- **Run it on the Pi's own screen** — a terminal on the Pi's desktop, not SSH.
- **X11 forwarding** so the window opens on your laptop: install an X server
  (macOS **XQuartz**, Windows **VcXsrv**), connect with `ssh -X xacademy@<pi-ip>`
  and check `echo $DISPLAY` is set, then enable **X11 forwarding** on the SSH
  interpreter's connection in PyCharm.

## If it doesn't work

| Problem | Likely cause and fix |
|---|---|
| `i2cdetect` doesn't show `3c` | Re-seat the Qwiic cable; confirm the Servo HAT is seated and powered. |
| `ModuleNotFoundError: No module named 'lgpio'` (from `import board`) | You're not using the shared venv (or `setup.sh` didn't finish). Select the `~/robotics-lesson/.venv` interpreter in PyCharm, or `source ~/robotics-lesson/.venv/bin/activate`; if it's still missing, re-run `setup.sh`. |
| `No module named 'board'` / `'stts22h'` | You're running the system Python, not the venv. Activate it first: `source ~/robotics-lesson/.venv/bin/activate` (prompt shows `(.venv)`). |
| `RuntimeError` / WHO_AM_I mismatch | Wrong chip or address, or a loose cable — re-check `i2cdetect -y 1`. |
| `Permission denied` on `/dev/i2c-1` | Add your user to the i2c group: `sudo usermod -aG i2c $USER`, then log out and back in (the setup script does this). |
| Graph window is empty / never appears (esp. from PyCharm) | See "The graph is empty when run from PyCharm" above. On the Pi: turn off PyCharm's "Show plots in tool window." Over SSH: use `--no-plot`, run on the Pi's screen, or enable X11 forwarding. |

## Exercises

1. Run both `temperature.py` and `temperature_smbus2.py` and confirm they
   report the same temperature.
2. Warm the sensor by holding it between your fingers and watch the graph rise,
   then let go and watch it fall.
3. In `temperature_smbus2.py`, add a Fahrenheit line to the printout.
4. Change `--period` to read faster (e.g. `--period 0.2`) and notice the graph
   update more smoothly.
5. Log the readings to a file (temperature and a timestamp) so you can plot a
   whole dive afterward.

## Reference: the Python modules used here

- **circuitpython-stts22h** — the sensor driver (`temperature.py`):
  <https://pypi.org/project/circuitpython-stts22h/>
- **Adafruit Blinka** — runs CircuitPython libraries on a Raspberry Pi:
  <https://pypi.org/project/Adafruit-Blinka/>
- **adafruit-lgpio** — the GPIO backend Blinka uses on the Pi 5:
  <https://pypi.org/project/adafruit-lgpio/>
- **smbus2** — register-level I2C (`temperature_smbus2.py`):
  <https://pypi.org/project/smbus2/>
- **matplotlib / pyplot** — the live graph:
  <https://matplotlib.org/stable/api/pyplot_summary.html>
- **STTS22H datasheet** (register details): search "STTS22H datasheet ST".

<!-- course-flow-nav -->
---

### Where this lesson fits

Step 9 of 12 in the course. ← Previous: **Thruster Control** (`../thrusters/lesson.md`) &nbsp;&nbsp;|&nbsp;&nbsp; Next: **Networked Control (Piloting)** (`../control/lesson.md`) →
