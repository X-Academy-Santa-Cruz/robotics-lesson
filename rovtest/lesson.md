# Tool: `rovtest` — check the hardware before you pilot

`rovtest` is a command-line tool for bringing up a new ROV. It tests one piece
of hardware at a time — thrusters, gripper, I2C devices, temperature sensor,
camera — so when something doesn't work on the water, you already know which
part is good and which isn't.

It reuses the same code as the lessons (`ThrusterRig` from the thrusters
lesson, the smbus2 sensor helpers from the I2C lesson), so a part that passes
here will behave the same in the real programs.

Run it with the shared venv active:

```bash
source ~/robotics-lesson/.venv/bin/activate
cd ~/robotics-lesson/rovtest
python3 rovtest.py --help
```

> **Safety:** any command that spins a thruster needs **props removed, or the
> ROV fully submerged and clear of hands.** Every thruster test arms first,
> runs for a fixed number of seconds, then stops — it never leaves a thruster
> running.

## The checks

### See what's on the I2C bus

```bash
python3 rovtest.py scan-i2c
```

Prints the full `i2cdetect` grid, then confirms the two devices the ROV needs:
the Servo HAT (`0x40`) and the temperature sensor (`0x3C`). A missing one is
reported as `[FAIL]`.

### Arm the thrusters

```bash
python3 rovtest.py arm
```

Runs the same arming sequence the real programs use (steady neutral for a few
seconds) and reports success. Nothing spins — this just checks the ESCs accept
the HAT's signal.

### Test one thruster — by percent or by raw pulse

```bash
python3 rovtest.py thruster left  --percent 30 --seconds 2
python3 rovtest.py thruster right --percent -40 --seconds 2   # negative = reverse
python3 rovtest.py thruster vertical --pulse 1.6 --seconds 2  # raw pulse width (ms)
```

Pick a thruster (`left`, `right`, `vertical`) and give **either** `--percent`
(−100…100) **or** `--pulse` (1.1…1.9 ms, the ESC's safe range). It arms, runs
that one channel for `--seconds`, then stops. Use this to confirm each thruster
spins the right way and at the right speed.

### Open/close the gripper

```bash
python3 rovtest.py gripper --open
python3 rovtest.py gripper --close
```

### Read the temperature sensor

```bash
python3 rovtest.py temperature --samples 5
```

Checks the sensor's identity, starts it, and prints a few readings in °C.

### Check the camera

```bash
python3 rovtest.py camera --index 0
```

Opens the camera and grabs one frame, reporting its size. A missing camera is
reported as `[FAIL]`.

### Run every non-moving check at once

```bash
python3 rovtest.py all
```

Runs `scan-i2c`, `temperature`, and `camera` in order (the ones that don't spin
a thruster), and exits non-zero if any fail — handy as a quick "is this ROV
healthy?" at the start of a session.

## If a check fails

| `[FAIL]` on… | Look at |
|---|---|
| Servo HAT at `0x40` | HAT seated and powered; `scan-i2c` grid; a `Remote I/O error` means it isn't answering. |
| Temp sensor at `0x3C` | Qwiic cable seated into the HAT. |
| a thruster | wiring to that channel (left=1, right=2, vertical=3); ESC power; try the other direction. |
| camera | USB camera plugged into a blue USB 3.0 port; `--index 1` if you have more than one. |
| import errors | venv not active — `source ~/robotics-lesson/.venv/bin/activate`. |
