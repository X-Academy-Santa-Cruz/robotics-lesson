# Lesson 3: Networked Control (Piloting the ROV)

This is the capstone lesson: you'll pilot the ROV with a game controller
from your laptop, while watching its live camera feed, with both the video
and the control commands traveling over the network between your laptop
and the Pi. This lesson reuses code from both previous lessons rather than
rewriting it — `ThrusterRig` from the [thrusters lesson](../thrusters/lesson.md)
drives the motors, and `stream_server.py` from the
[camera lesson](../camera/lesson.md) is the video feed, unchanged.

Read the safety section of the thrusters lesson again before doing any of
this with propellers attached or power connected.

## 1. The system you're building

Three programs run at once, on two machines:

```
Laptop                              Pi
------                              --
pilot.py  ----(UDP, port 5005)---->  rov_server.py  ---->  thrusters
browser   <---(HTTP, port 8000)----  stream_server.py <--  camera
```

Video and control are **two completely independent connections**. This is
deliberate, and matches how real ROVs are built: losing the control link
doesn't necessarily mean you lose the camera, and a congested video stream
doesn't delay your control commands queued up behind it.

## 2. Why UDP for control (and not the HTTP you already know)

The camera lesson used HTTP, which is built on **TCP**: every byte is
guaranteed to arrive, in order, and the connection notices if something's
missing and resends it. That's exactly what you want for a JPEG image —
losing or scrambling part of a picture isn't acceptable.

Control commands are the opposite. You are sending "here's where the
sticks are right now" roughly 20 times a second. If one of those packets
gets lost, the fix is trivial: **the next one, a fraction of a second
later, has the current stick position anyway.** Waiting around to
guarantee delivery of a stale, already-outdated command would only add
delay to something that needs to feel instant. This is why real-time
control systems (robotics, games, voice/video calls) use **UDP**: send a
packet and move on, no handshake, no waiting, no automatic resending.

The tradeoff is that UDP guarantees nothing — packets can arrive out of
order, duplicated, or not at all, and nothing in the protocol will tell you
when that happens. `rov_server.py`'s failsafe (below) exists specifically
because UDP can't promise you'll ever hear from the pilot again.

## 3. Reading `rov_server.py` (runs on the Pi)

### Reusing `ThrusterRig`

```python
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "thrusters"))
from thruster_control import ThrusterRig
```

`thruster_control.py` lives in a different folder and isn't an installed
package, so Python doesn't know to look there by default. This line adds
that folder to Python's **module search path** at runtime, so the normal
`import` statement on the next line can find it. The payoff: none of the
arming, differential-steering, or safe-shutdown logic gets rewritten — it's
the exact same tested code from the thrusters lesson.

### The failsafe

```python
sock.settimeout(FAILSAFE_SECONDS)
...
try:
    data, _addr = sock.recvfrom(1024)
except socket.timeout:
    rig.stop()
    continue
```

`recvfrom` normally blocks forever waiting for the next packet. Giving the
socket a timeout means it instead raises an exception if nothing arrives
within `FAILSAFE_SECONDS` (half a second) — which we treat as "the pilot's
connection is gone," and respond by stopping the thrusters. Without this,
losing Wi-Fi for a few seconds while a thruster was mid-throttle would
leave it running at that speed indefinitely.

### The wire format

```python
parts = [float(v) for v in data.decode("utf-8").split(",")]
forward, turn, vertical = parts[0], parts[1], parts[2]
gripper = parts[3] if len(parts) > 3 else 0.0
```

Each packet is just a UTF-8 string like `"0.5,-0.2,0.0,1.0"` — four
comma-separated numbers: forward, turn, vertical, and the gripper
(`0.0` = closed, `1.0` = open). There's no library or framework involved;
this is a format we made up because it's the simplest thing that works and
is easy to read if you ever print one. An older three-number packet still
works (the gripper just defaults to closed), and a malformed packet gets
skipped (`except (ValueError, IndexError): continue`) rather than crashing
the server. The server then calls both `rig.drive(...)` and
`rig.set_gripper(gripper)`.

## 4. Reading `pilot.py` (runs on the laptop)

### Two controllers are supported

`pilot.py` knows two controllers and picks the right one automatically from
its name:

| Controller | forward | turn | vertical | gripper (trigger) |
|---|---|---|---|---|
| Logitech Extreme 3D Pro ("3D Extreme") | stick pitch | stick twist | throttle slider | trigger button — hold to open |
| Logitech F310 gamepad | left stick Y | left stick X | right stick Y | right trigger (RT) — squeeze to open |

Each controller is described by a small `ControllerProfile` near the top of
`pilot.py` (`PROFILE_EXTREME_3D` and `PROFILE_F310`). A profile just lists
which axis is forward/turn/vertical, which ones to invert so "push up" is
positive, and where the gripper trigger is — a **button** on the 3D Extreme,
an analog **axis** (RT) on the F310.

### Finding your controller's numbers

Axis and button numbering isn't standardized — it depends on the controller
and your operating system (the F310 also has an X/D switch that changes its
layout; use **X**). If a control does the wrong thing, run:

```bash
python3 pilot.py <pi-ip-address> --calibrate
```

Move each stick, slider, and trigger one at a time and watch which number
changes. Then adjust the matching `ControllerProfile` to match what you see.

### The control loop

```python
forward = read_axis(profile.axis_forward, profile.invert_forward)
turn = read_axis(profile.axis_turn, profile.invert_turn)
vertical = read_axis(profile.axis_vertical, profile.invert_vertical)
gripper = read_gripper(joystick, profile)   # 0.0 closed .. 1.0 open

message = f"{forward},{turn},{vertical},{gripper}".encode("utf-8")
sock.sendto(message, target)

time.sleep(interval)
```

Every iteration: read the controls through the active profile, build the
`"forward,turn,vertical,gripper"` string `rov_server.py` expects, and send
it — at a steady 20 times a second (`SEND_RATE_HZ`), **whether or not
anything changed**. Sending continuously (instead of only when the sticks
move) is what makes the Pi's failsafe meaningful: as long as `pilot.py` is
running and connected, the Pi keeps getting fresh "still here" packets, and
the instant that stops, the failsafe notices within half a second.

### The deadzone

```python
def apply_deadzone(value: float) -> float:
    return 0.0 if abs(value) < DEADZONE else value
```

Analog sticks rarely rest at *exactly* zero — there's always a little
drift. Without this, a stick sitting still could send a tiny nonzero
throttle forever. Any reading smaller than `DEADZONE` (0.15) gets forced
to exactly `0.0`.

### Stopping cleanly

```python
except KeyboardInterrupt:
    sock.sendto(b"0,0,0", target)
```

When you press `Ctrl+C` to quit piloting, `pilot.py` sends one explicit
stop command before closing. This isn't strictly necessary — the Pi's
failsafe would catch the silence within half a second anyway — but there's
no reason to wait even that long when you already know you're stopping.

## 5. Running the full system

You'll need **three** terminals/processes going at once. If you've set up
the SSH remote interpreter from the [PyCharm lesson](../pycharm/lesson.md),
you can run both Pi-side scripts as separate Run configurations instead of
juggling SSH windows.

1. **On the Pi** — start the camera stream (from the camera lesson):
   ```bash
   cd robotics-lesson/camera && source venv/bin/activate
   python3 stream_server.py
   ```
2. **On the Pi, in a second session** — start the control listener, using
   the same virtual environment you set up for the thrusters lesson (it
   already has everything `rov_server.py` needs):
   ```bash
   cd robotics-lesson/thrusters && source venv/bin/activate
   python3 ../control/rov_server.py
   ```
3. **On your laptop** — open the camera stream in a browser
   (`http://<pi-ip-address>:8000/`), then in a terminal:
   ```bash
   cd robotics-lesson/control
   python3 -m venv venv && source venv/bin/activate
   pip install -r requirements.txt
   python3 pilot.py <pi-ip-address> --calibrate   # find your axis numbers first
   python3 pilot.py <pi-ip-address>                # then actually fly
   ```

With propellers off (or the thruster submerged and everyone's hands clear),
confirm each stick moves the expected thruster, then try disconnecting
your laptop from the network entirely and watch the Pi's terminal print
the failsafe message and stop the thrusters on its own.

### If it doesn't work

| Problem | Likely cause |
|---|---|
| `No game controller detected` | Controller isn't connected/paired, or your OS needs a driver — check it shows up in your OS's controller/Bluetooth settings first |
| Sticks move a thruster, but the wrong one, or the wrong direction | Re-run `--calibrate` and fix the axis numbers / invert flags in the matching `ControllerProfile` |
| `rov_server.py` never prints anything, thrusters never move | Confirm you're sending to the right `<pi-ip-address>` and that `--port` matches on both ends (default 5005) |
| Everything works, then the thrusters stop on their own and "failsafe" prints repeatedly | This is expected if `pilot.py` isn't running or your network dropped — it's the safety behavior working correctly, not a bug |

## Exercises

1. Run the full three-process system with propellers off and confirm you
   can drive, turn, and control the vertical thruster with the controller.
2. Unplug your laptop's network connection while piloting and confirm the
   Pi's failsafe stops the thrusters within about half a second.
3. Change `SEND_RATE_HZ` to something very low, like `2`, and notice how
   sluggish/jerky control feels — this is latency you're introducing
   yourself, on top of whatever the network adds.
4. The wire format already carries a gripper value driven by the trigger.
   Add a *fifth* value — a "turbo" flag from another button — and have
   `rov_server.py` use it to scale the `drive()` call.
5. (Advanced) Add a sequence number to each packet and have
   `rov_server.py` ignore any packet that arrives with a lower sequence
   number than one it's already processed — this protects against a
   late/reordered UDP packet momentarily overriding a newer command.
