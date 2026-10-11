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

| Device | Hat channel |
|---|---|
| Gripper | 0 |
| Left thruster | 1 |
| Right thruster | 2 |
| Vertical thruster | 3 |

(The gripper is driven in the networked-control lesson; the thruster code in
this lesson uses channels 1-3.)

Plug each ESC's signal and ground wires into the matching channel's signal
and ground pins. **Leave the channel's power pin disconnected** unless
your specific ESC's documentation says otherwise — the ESC's motor power
comes from the main battery directly, not from the Hat, and some ESCs
output their own voltage on that pin (via a BEC) which you don't want
feeding backward into the Hat and the Pi. If you're not sure what your
ESC's three wires expect, check with your instructor before connecting
power.

## 3. Enabling I2C on the Pi

> **Shortcut:** the repository includes a top-level setup script that does
> everything in sections 3 and 4 for you — updates packages, installs the
> libraries (including the SparkFun **pi-servo-hat** library), enables I2C,
> and adds you to the `i2c` group. From the top of the repo, run:
>
> ```bash
> bash setup.sh
> ```
>
> Then reboot (and log out/in) as the script tells you, and confirm the Hat
> appears with `i2cdetect -y 1`. If you'd rather understand each step, do
> them by hand below.

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

## 4. Install the Python library

The thruster code uses the SparkFun **pi-servo-hat** library, which drives
the PCA9685 chip on the Servo HAT. The top-level `setup.sh` already installs
it, so if you ran that you can skip ahead. To install just this library by
hand:

```bash
pip3 install pi-servo-hat
```

(On newer Ubuntu/Debian, pip outside a virtual environment needs
`pip3 install --break-system-packages pi-servo-hat`, or make a venv first.)

This one library is all the thruster code needs — it talks to the Servo HAT
over I2C and does the pulse-width math for us.

## 5. Reading the code: `thruster_control.py`

### Talking to the Servo HAT

```python
self._hat = pi_servo_hat.PiServoHat(address=i2c_address)
self._hat.restart()                    # reset the chip; sets 50 Hz
self._hat.set_pulse_time(MIN_PULSE_MS, MAX_PULSE_MS)
```

`PiServoHat` opens the I2C connection to the HAT (default address `0x40`).
`restart()` resets the chip and sets the PWM frequency to 50 Hz — the
standard rate ESCs expect (one pulse every 20 milliseconds).
`set_pulse_time()` tells the library the min and max pulse widths our ESCs
use, 1.1 ms and 1.9 ms, so the position commands below land on the right
pulses.

### From throttle to position

```python
def _throttle_to_position(throttle):
    throttle = max(-1.0, min(1.0, throttle))
    return (throttle + 1.0) * (SWING / 2.0)   # SWING = 180
```

The library commands a servo by **position in degrees**, from 0 up to the
servo's swing (we use `SWING = 180`). With the pulse range set above, the
library maps position 0 to the minimum pulse, the midpoint to neutral, and
the maximum position to the maximum pulse. So we convert a throttle of
`-1.0 … +1.0` into a position of `0 … 180`:

- throttle `-1.0` → position `0` → 1.1 ms → full reverse
- throttle `0.0` → position `90` → 1.5 ms → stop (neutral)
- throttle `+1.0` → position `180` → 1.9 ms → full forward

`move_servo_position(channel, position, SWING)` then sends it to the HAT.
We're not driving an actual servo motor — a continuous-rotation ESC uses the
exact same pulse convention, so the Servo HAT library does precisely the
pulse-width math we need.

### Arming

```python
def arm(self):
    self._set_throttle(CHANNEL_LEFT, 0.0)
    self._set_throttle(CHANNEL_RIGHT, 0.0)
    self._set_throttle(CHANNEL_VERTICAL, 0.0)
    time.sleep(ARM_SECONDS)
    self._armed = True
```

Real ESCs refuse to spin the motor until they've seen a steady neutral
(stop) signal first — it's a built-in safety behavior so a motor can't jump
to full speed the instant power is connected. `arm()` does exactly that
(position 90 on every channel), and `drive()`/`stop()` both refuse to run
before `arm()` has been called (see `_check_armed`), so the code itself
enforces arming before any throttle command.

### Differential steering

```python
def drive(self, forward, turn, vertical):
    self._set_throttle(CHANNEL_LEFT, self._clamp(forward + turn))
    self._set_throttle(CHANNEL_RIGHT, self._clamp(forward - turn))
    self._set_throttle(CHANNEL_VERTICAL, self._clamp(vertical))
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

`close()` sends a stop command, then calls the HAT's `sleep()` to cut PWM
output so the ESCs see no signal once we're done. Because this is in a
`finally` block, it runs even if you stop the program with `Ctrl+C` — the
thrusters don't keep running after your program exits.

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
