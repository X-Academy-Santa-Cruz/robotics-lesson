# Lesson: Raspberry Pi and Linux

Your ROV's "brain" is a **Raspberry Pi 5** running **Ubuntu** (a version of
Linux). This chapter gets you from a bare Pi to a set-up development machine:
what the board is, how to put Ubuntu on it, how to log in and open a terminal,
how to run the one-step setup script, and the handful of Linux commands you'll
use constantly for the rest of the course.

## 1. Meet the Raspberry Pi 5

The Raspberry Pi is a small, complete computer on a single board. The Pi 5 is
the model this course uses — it's fast enough to read a camera, drive the
thrusters, and run PyCharm.

![Raspberry Pi 5 with its main components labeled](images/raspberry-pi-5.png)

*Figure: a Raspberry Pi 5. (Add a photo of your own board at
`images/raspberry-pi-5.png`.)*

Key components to know:

| # | Component | What it's for |
|---|---|---|
| 1 | **USB-C power port** | Power in. Use the official 27 W Pi 5 supply — an underpowered charger causes random crashes. |
| 2 | **USB 3.0 ports (blue, ×2)** | Fast USB — plug the USB webcam in here. |
| 3 | **USB 2.0 ports (black, ×2)** | Keyboard, mouse, game controller. |
| 4 | **Gigabit Ethernet** | Wired network to your laptop/switch (how video gets to the surface). |
| 5 | **Micro-HDMI ports (×2)** | Monitor output (for first-time setup with a screen). |
| 6 | **40-pin GPIO header** | Where the SparkFun Pi Servo HAT plugs on, for thrusters/servos. |
| 7 | **microSD card slot** | The Pi's "hard drive" — the SD card holds Ubuntu and your code. |
| 8 | **40-pin header / I2C pins** | The Servo HAT uses the I2C pins here to talk to the Pi. |
| 9 | **Fan / power button** | The Pi 5 has a power button; a cooler/fan connector sits near the USB-C port. |

## 2. Putting Ubuntu on the SD card

The Pi boots from a microSD card, and the card has to have an operating system
written ("flashed") onto it first. We use **Ubuntu** for this course.

The easiest way is the official **Raspberry Pi Imager**:

1. On your laptop, download and install **Raspberry Pi Imager** from the
   official site: <https://www.raspberrypi.com/software/>
2. Put the microSD card in your laptop (use an adapter if needed).
3. Open Imager and choose:
   - **Device:** Raspberry Pi 5
   - **Operating System:** *Choose OS → Other general-purpose OS → Ubuntu →*
     **Ubuntu Desktop (64-bit)**
   - **Storage:** your SD card
4. Click **Next**. You can set the username, password, and Wi-Fi here in
   Imager's settings — use the X Academy defaults in the next section.
5. Write the card, then put it in the Pi's SD slot.

The Raspberry Pi Foundation has full, illustrated instructions here:
<https://www.raspberrypi.com/documentation/computers/getting-started.html#installing-the-operating-system>

## 3. X Academy default login and Wi-Fi

The team's Pis are set up with the same login and Wi-Fi so everyone can use
any Pi.

| | |
|---|---|
| **Username** | `xacademy` |
| **Password** | `Gauss5050` |

**Wi-Fi:**

| | |
|---|---|
| **Network (SSID)** | `X Academy` |
| **Password** | `Gauss5050` |

If you flash a fresh card, set these same values in Raspberry Pi Imager so the
Pi joins the Wi-Fi and uses the standard login.

## 4. Logging in and opening a terminal

For first-time setup, connect the Pi to a monitor (micro-HDMI), a keyboard,
and a mouse, then plug in power.

1. When Ubuntu boots to the login screen, pick the **xacademy** user and type
   the password **Gauss5050**.
2. The desktop appears, with a **dock** (the bar of icons) down the **left**
   side of the screen.
3. Find the **Terminal** icon in the dock and click it. A terminal window
   opens — this is where you type the commands in this course.

![The Terminal icon in the dock on the left of the screen](images/terminal-dock.png)

*Figure: the Terminal icon in the left-hand dock. (Add a screenshot at
`images/terminal-dock.png`.)*

> **Tip:** you can also open a terminal any time with the keyboard shortcut
> **Ctrl + Alt + T**.

Once your Pi is on the network, you can also reach it from your laptop without
a monitor at all, using **SSH** (covered in section 7).

## 5. Getting the code and running the setup script

With a terminal open, download the course code and run the one-step setup
script. This gets the Pi ready for **every** lesson (camera, joystick, I2C,
the Servo HAT library) and installs the tools you'll use (Chrome, PyCharm,
SSH).

```bash
# 1. Download the course code
git clone https://github.com/X-Academy-Santa-Cruz/robotics-lesson.git
cd robotics-lesson

# 2. Run the setup script (it will ask for your password)
sudo ./setup.sh
```

`git` comes with Ubuntu, so the clone works right away. The script prints what
it's doing and finishes with a summary. It:

- updates all packages, and installs emacs, git, and the SSH server
- installs **pip3** and the Python modules the lessons use: OpenCV, Flask,
  click, and pygame, plus the I2C tools
- installs the **SparkFun Pi Servo HAT** library (for the thrusters/gripper)
  and turns on the I2C bus
- installs **Google Chrome** and **PyCharm**, and pins them to the dock

When it finishes, **reboot** (see section 8). After rebooting, confirm the
Servo HAT is on the I2C bus — it should show up at address `40`:

```bash
i2cdetect -y 1
```

## 6. Linux commands you'll use constantly

Everything below works the same whether you're typing on the Pi directly or
through an SSH connection.

### Where am I? Where is everything?

| Command | What it does |
|---|---|
| `pwd` | **P**rint **w**orking **d**irectory — the folder you're in |
| `ls` | **L**i**s**t files/folders here |
| `ls -l` | List with details: permissions, size, date |
| `ls -a` | List including hidden files (names starting with `.`) |
| `cd <folder>` | **C**hange **d**irectory into `<folder>` |
| `cd ..` | Go up one level |
| `cd ~` | Jump to your home directory |

### Working with files and folders

| Command | What it does |
|---|---|
| `mkdir <name>` | Make a new directory |
| `touch <file>` | Create an empty file (or update its timestamp) |
| `cp <src> <dst>` | Copy a file |
| `mv <src> <dst>` | Move or rename a file |
| `rm <file>` | Remove a file — **no undo, no trash can** |
| `rm -r <folder>` | Remove a folder and everything in it — **be careful** |
| `cat <file>` | Print a file's whole contents |
| `less <file>` | View a file a page at a time (`q` to quit) |

`rm` is permanent — double-check the path before you press enter, especially
with `rm -r`.

### Running programs and managing processes

| Command | What it does |
|---|---|
| `python3 stream_server.py` | Run a Python script |
| `Ctrl+C` | Stop the program running in your terminal |
| `python3 stream_server.py &` | Run it in the **background**, get your prompt back |
| `jobs` | List background jobs from this terminal |
| `ps aux` | List every running process |
| `ps aux \| grep python` | List only "python" processes |
| `kill <pid>` | Stop a process by its ID (from `ps aux`) |

### Permissions (why "permission denied" happens)

`ls -l` shows something like `-rwxr-xr-x`: who can **r**ead, **w**rite, or
e**x**ecute, for the owner, the group, and everyone else. If a script won't
run, it may need the execute bit:

```bash
chmod +x setup.sh
```

USB cameras show up as device files (e.g. `/dev/video0`). If a program can't
open the camera, add your user to the `video` group, then log out and back in:

```bash
sudo usermod -aG video $USER
```

## 7. Finding your IP address and connecting over SSH

Once the Pi is on the network you can reach it from your laptop with no
monitor attached. First, on the Pi, find its address:

```bash
hostname -I
```

Write it down. Then from your laptop's terminal:

```bash
ssh xacademy@<pi-ip-address>
```

The first time, it asks if you trust the host — type `yes` — then enter the
password **Gauss5050**. You now have a terminal on the Pi over the network.

## 7a. Changing the Pi's hostname (networking)

Every Pi on the network has a **hostname** — a name you can use instead of its
IP address. If several Pis are on the same Wi-Fi, give each one a unique name
(for example `rov-1`, `rov-2`) so they don't collide and so you can tell them
apart.

Set a new hostname with `hostnamectl`:

```bash
sudo hostnamectl set-hostname rov-1
```

Then reboot (section 8) for it to fully take effect. After that, `hostname`
shows the new name, and on most networks you can reach the Pi by name instead
of IP:

```bash
ssh xacademy@rov-1.local
```

> If `rov-1.local` doesn't resolve, your network may not support mDNS; fall
> back to the IP address from `hostname -I`.

## 8. Rebooting the Pi

After the setup script (or any big change), reboot the Pi:

```bash
sudo reboot
```

The Pi disconnects, restarts, and comes back in under a minute. If you were
connected over SSH, your connection drops when it reboots — just reconnect
with `ssh` once it's back up. To shut the Pi down completely instead (before
unplugging power), use:

```bash
sudo poweroff
```

## Exercises

1. Open a terminal from the dock (and try **Ctrl + Alt + T** too).
2. Use `pwd` and `ls` to find the `robotics-lesson` folder.
3. Create a scratch folder `practice`, `cd` into it, make a file with
   `touch notes.txt`, then remove the whole folder with `rm -r practice`.
4. Run `hostname -I`, write down the Pi's IP address, and (from another
   machine if you can) `ssh xacademy@<that address>`.
5. Reboot the Pi with `sudo reboot` and log back in.
