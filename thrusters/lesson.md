# Lesson 2: Thruster Control

Your ROV moves using three brushless thrusters (BlueRobotics-style, e.g.
T100/T200): one on the **left**, one on the **right**, and one **vertical**
thruster for rising and sinking. This lesson covers how the Pi commands
them, and introduces a piece of hardware you haven't used yet: the
**SparkFun Pi Servo Hat**, which plugs directly onto the Pi's 40-pin header.

## Safety first — read this before touching any hardware

Thrusters have real spinning propellers, run from a battery that can
deliver a lot of current, and are usually tested somewhere near water. Treat
this hardware with the same respect as any power tool.

- **Keep fingers, hair, and loose clothing away from propellers** any time
  the battery is connected — even if you don't expect them to spin.
- Whenever possible, **test with propellers removed**, or with the thruster
  fully submerged in a test tank and everyone's hands clear of the water.
- **Connect the battery last**, after all your code and wiring is already
  in place, and disconnect it first before changing any wiring.
- Never test a LiPo/battery-powered thruster in air pointed at yourself or
  anyone else, even at low throttle.
- If anything smells hot, smokes, or looks damaged, disconnect the battery
  immediately and tell your instructor.
- An adult/instructor should supervise the first time you connect battery
  power to a new wiring setup.

## 1. How a brushless thruster is actually controlled

A brushless motor can't be driven by just applying voltage like a simple DC
motor — it needs an **ESC (Electronic Speed Controller)**, a small circuit
board wired between the battery, the motor, and the Pi. The ESC does the
hard part (switching power to the motor's coils in the right pattern); your
job is just to tell it *how fast and which direction*.

The ESC listens for the same kind of signal used in RC cars and planes for
decades: a repeating electrical pulse, 50 times per second, where the
**width of the pulse** (how long it stays "on" each time, measured in
microseconds) says the throttle:

| Pulse width | Meaning |
|---|---|
| 1100 µs | full reverse |
| 1500 µs | stop (neutral) |
| 1900 µs | full forward |

Anything in between is a proportional speed. This is called a **PWM**
signal (Pulse Width Modulation) — the information is encoded entirely in
how wide each pulse is, not in voltage level.

## 2. Why we need the Servo Hat at all

You might expect the Pi to generate these pulses directly from its own GPIO
pins. The problem: Linux isn't a real-time operating system, and Python
even less so — if the Pi got briefly busy doing something else, a
pulse could come out late or the wrong width, and an ESC seeing a corrupted
signal can behave unpredictably. The Pi also only has one or two pins
capable of precise hardware PWM, and we need three.

The SparkFun Pi Servo Hat is built around a **PCA9685** chip, whose entire
job is generating up to 16 independent, rock-steady PWM signals,
continuously, in hardware — once you tell it what each channel's pulse
width should be, it keeps generating it correctly without the Pi's
involvement. Because it's a HAT ("Hardware Attached on Top"), it plugs
straight onto the Pi's 40-pin GPIO header — no loose wires for power or
I2C to get wrong. The Pi talks to the PCA9685 chip over **I2C**, a simple
two-wire protocol (`SDA` for data, `SCL` for a shared clock) that the HAT
connector carries for you automatically.

So the signal path is:

```
Pi (Python) --I2C, over the GPIO header--> PCA9685 chip on the Hat
    --one PWM wire per channel--> ESC --> thruster
```

Each of the Hat's 16 channels breaks out to a standard 3-pin hobby-servo
header: **signal, power, ground**. In this lesson:

| Thruster | Hat channel |
|---|---|
| Left | 0 |
| Right | 1 |
| Vertical | 2 |

Plug each ESC's signal and ground wires into the matching channel's signal
and ground pins. **Leave the channel's power pin disconnected** unless
your specific ESC's documentation says otherwise — the ESC's motor power
comes from the main battery directly, not from the Hat, and some ESCs
output their own voltage on that pin (via a BEC) which you don't want
feeding backward into the Hat and the Pi. If you're not sure what your
ESC's three wires expect, check with your instructor before connecting
power.

## 3. Enabling I2C on the Pi

Ubuntu on the Pi doesn't have I2C turned on by default.

```bash
sudo apt update
sudo apt install -y i2c-tools python3-smbus
```

Enable the I2C interface by editing the boot config:

```bash
sudo nano /boot/firmware/config.txt
```

Add this line (if it's not already there), save, and exit:

```
dtparam=i2c_arm=on
```

Add yourself to the `i2c` group so you don't need `sudo` to use it, then
reboot for both changes to take effect:

```bash
sudo usermod -aG i2c $USER
sudo reboot
```

After rebooting, with the Servo Hat seated on the Pi's GPIO header, confirm
the Pi can see it:

```bash
i2cdetect -y 1
```

You should see `40` appear in the grid — that's the PCA9685 chip on the
Hat, at its default address, `0x40`.

## 4. Install the Python libraries

```bash
cd robotics-lesson/thrusters
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

These are Adafruit's **CircuitPython** libraries — the same libraries work
across many different boards, with `adafruit-blinka` as the layer that
makes them work on a Raspberry Pi specifically. They don't care that the
chip happens to be on a SparkFun-branded board rather than an Adafruit one —
a PCA9685 is a PCA9685 no matter who sells the breakout board.

## 5. Reading the code: `thruster_control.py`

### Talking to the PCA9685

```python
i2c = busio.I2C(board.SCL, board.SDA)
self._pca = PCA9685(i2c, address=i2c_address)
self._pca.frequency = frequency
```

This opens the I2C connection and sets the PWM frequency to 50 Hz — the
standard rate ESCs expect (one pulse every 20 milliseconds).

### `ContinuousServo` — why we're using something named "servo"

```python
servo.ContinuousServo(
    self._pca.channels[channel],
    min_pulse=MIN_PULSE_US,
    max_pulse=MAX_PULSE_US,
)
```

A continuous-rotation hobby servo is controlled by the exact same
1100-1900 µs pulse convention as our ESCs, so this library class does
precisely the pulse-width math we need: set `.throttle` to anything from
`-1.0` to `1.0` and it computes the right pulse width automatically. We're
not actually using a servo motor — we're reusing a library built for one
because the signal format is identical.

### Arming

```python
def arm(self):
    self._left.throttle = 0.0
    self._right.throttle = 0.0
    self._vertical.throttle = 0.0
    time.sleep(ARM_SECONDS)
    self._armed = True
```

Real ESCs refuse to spin the motor until they've seen a steady neutral
(stop) signal first — it's a built-in safety behavior so a motor can't jump
to full speed the instant power is connected. `arm()` does exactly that,
and `drive()`/`stop()` both refuse to run before `arm()` has been called
(see `_check_armed`), so the code itself enforces arming before any
throttle command.

### Differential steering

```python
def drive(self, forward: float, turn: float, vertical: float):
    self._left.throttle = self._clamp(forward + turn)
    self._right.throttle = self._clamp(forward - turn)
    self._vertical.throttle = self._clamp(vertical)
```

Three simple axes become three thruster commands:

- **forward** alone: both thrusters get the same value — straight line
- **turn** alone: left and right get opposite adjustments — the ROV spins
  in place
- **forward + turn** together: one side speeds up, the other slows down —
  the ROV curves
- **vertical**: independent of the other two, controls only the vertical
  thruster

### Shutting down safely

```python
finally:
    rig.close()
```

`close()` sends a stop command before releasing the PCA9685. Because this is
in a `finally` block, it runs even if you stop the program with `Ctrl+C` —
the thrusters don't keep running after your program exits.

## 6. Running it

With the thrusters wired, propellers removed or safely submerged, and the
safety steps from the top of this lesson followed:

```bash
cd robotics-lesson/thrusters
source venv/bin/activate
python3 thruster_control.py
```

You should see:

```
Arming thrusters - keep clear of propellers...
Armed.
forward, half speed
turn right in place
rise
stop
```

Each thruster should visibly respond during its step, and come to a full
stop at the end. If a thruster spins the wrong direction, see below.

### If it doesn't work

| Problem | Likely cause |
|---|---|
| `i2cdetect` doesn't show `40` | Confirm the Servo Hat is fully and firmly seated on the Pi's 40-pin GPIO header, with all pins aligned |
| `ValueError: No I2C device at address 0x40` | Same as above, or a different address — pass `--address` if you've changed the Hat's address jumpers |
| A thruster spins backwards from what you expect | Swap that ESC's two motor-to-thruster wires (not the signal wire), or negate that channel's throttle in code |
| Nothing moves, no errors | ESC isn't armed/powered, or the battery isn't connected — check battery connections with everyone's hands clear first |
| One thruster is much weaker/stronger than you expect at the same throttle | Thrusters and ESCs can have slightly different calibration; this is normal and something you'll tune for later, not a bug |

## Exercises

1. Run the demo sequence with propellers off and confirm each thruster
   responds in the expected direction for forward, turn, and vertical.
2. If a thruster spins the "wrong" way for your wiring, fix it in code by
   negating that axis for that thruster, rather than re-wiring it.
3. `drive()` clamps `forward + turn` independently per side, so
   `forward=1.0, turn=1.0` asks for `left=2.0` and silently clips to `1.0`.
   Write a version that instead *scales down* both sides proportionally
   when either would exceed 1.0, so turning at full forward speed still
   turns instead of just going straight.
4. Write your own short sequence (a list of `(label, axes)` steps like
   `demo()`) that moves in a square-ish pattern: forward, turn, forward,
   turn, stop.
