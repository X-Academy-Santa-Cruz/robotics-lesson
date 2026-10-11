# Underwater ROV Programming Curriculum

A hands-on Python curriculum for students building and programming an underwater
ROV (Remotely Operated Vehicle) controlled by a Raspberry Pi running Ubuntu.

Each topic lives in its own folder with a `lesson.md` (the lesson content) and
any example code that goes with it.

## Hardware assumed throughout this course

- Raspberry Pi running **Ubuntu** (not Raspberry Pi OS)
- USB webcam plugged into the Pi
- Three BlueRobotics-style brushless thrusters (left, right, vertical), each
  with its own ESC, wired to a **SparkFun Pi Servo Hat** (PCA9685-based)
  plugged onto the Pi's GPIO header
- A topside laptop on the same network as the Pi (connected via tether/switch
  or Wi-Fi), used to view the camera stream and send control commands
- A USB/Bluetooth game controller plugged into the laptop, for piloting
- **PyCharm Professional** installed on the topside laptop for writing,
  running, and debugging code — including code that runs on the Pi over SSH

## Setup

On the Raspberry Pi (Ubuntu), run the setup script once from the top of the
repo. It updates packages, installs everything the lessons need (camera,
joystick, I2C, and the SparkFun Pi Servo HAT library for servos/PWM), and
enables the I2C bus:

```bash
bash setup.sh
```

Reboot and log out/in if the script says to, then confirm the Servo HAT is on
the I2C bus with `i2cdetect -y 1` (it should show `40`). Each lesson folder
also has its own, narrower install notes if you prefer to set things up
lesson by lesson.

## Foundations

Skills you need before writing ROV code. Work through these first if you're
new to Linux or version control.

| Lesson | Folder |
|---|---|
| Linux Shell Basics | [`shell/`](shell/lesson.md) |
| Git Basics | [`git/`](git/lesson.md) |
| PyCharm for Remote ROV Development | [`pycharm/`](pycharm/lesson.md) |
| Debugging: print() vs PyCharm's Debugger | [`debugging/`](debugging/lesson.md) |

## ROV Lessons

| # | Lesson | Folder |
|---|---|---|
| 1 | Streaming Video from a USB Camera | [`camera/`](camera/lesson.md) |
| 2 | Thruster Control | [`thrusters/`](thrusters/lesson.md) |
| 3 | Networked Control (Piloting the ROV) | [`control/`](control/lesson.md) |
