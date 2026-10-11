#!/usr/bin/env bash
#
# setup.sh -- one-time setup for the whole robotics-lesson course.
#
# Run it on the Raspberry Pi (Ubuntu) from the top of the repo:
#
#     bash setup.sh
#
# It will:
#   1. Update the package lists.
#   2. Install pip3 and the system packages the lessons need
#      (camera, I2C tools, build basics).
#   3. Install the Python modules every lesson uses
#      (camera, joystick, I2C, servos / PWM via the SparkFun Pi Servo HAT).
#   4. Enable the I2C bus and add you to the i2c group so the Servo HAT works.
#
# It uses sudo, so it will ask for your password. Re-running it is safe.

set -e   # stop immediately if any command fails

echo "============================================================"
echo " robotics-lesson setup"
echo "============================================================"

# ---- 1. Update package lists -------------------------------------------------
echo ">>> [1/4] Updating package lists..."
sudo apt-get update

# ---- 2. System packages ------------------------------------------------------
echo ">>> [2/4] Installing pip3 and system packages..."
sudo apt-get install -y \
    python3-pip \
    python3-venv \
    python3-opencv \
    python3-flask \
    python3-click \
    python3-pygame \
    python3-smbus \
    i2c-tools

#   python3-pip     pip3, Python's package installer
#   python3-venv    virtual environments (optional, for the pip install path)
#   python3-opencv  OpenCV -- camera lesson (reads the camera, makes JPEGs)
#   python3-flask   Flask  -- camera lesson (web server for camera_simple.py)
#   python3-click   click  -- camera lesson (command-line options)
#   python3-pygame  pygame -- thrusters/control lessons (reads the joystick)
#   python3-smbus   SMBus  -- talking to I2C devices from Python
#   i2c-tools       i2cdetect and friends, to find devices on the I2C bus

# ---- 3. Python modules with no apt package (installed with pip3) -------------
echo ">>> [3/4] Installing the SparkFun Pi Servo HAT library (pip3)..."
# The SparkFun Pi Servo HAT library drives the PCA9685 servo/PWM controller
# for the thrusters and the gripper. It isn't packaged in apt, so use pip3.
# On newer Ubuntu/Debian, pip outside a venv needs --break-system-packages.
if ! sudo pip3 install pi-servo-hat 2>/dev/null; then
    echo "    (retrying with --break-system-packages for newer OS versions)"
    sudo pip3 install --break-system-packages pi-servo-hat
fi

# ---- 4. Enable I2C for the SparkFun Pi Servo HAT -----------------------------
echo ">>> [4/4] Enabling the I2C bus..."

# Load the I2C kernel module now, and on every boot.
sudo modprobe i2c-dev || true
if ! grep -q '^i2c-dev' /etc/modules 2>/dev/null; then
    echo 'i2c-dev' | sudo tee -a /etc/modules >/dev/null
fi

# Turn the I2C bus on in the Pi's firmware config so it comes up at boot.
# Ubuntu on the Pi keeps this file at /boot/firmware/config.txt.
BOOT_CONFIG=""
for f in /boot/firmware/config.txt /boot/config.txt; do
    if [ -f "$f" ]; then BOOT_CONFIG="$f"; break; fi
done
if [ -n "$BOOT_CONFIG" ]; then
    if ! grep -q '^dtparam=i2c_arm=on' "$BOOT_CONFIG"; then
        echo 'dtparam=i2c_arm=on' | sudo tee -a "$BOOT_CONFIG" >/dev/null
        echo "    Enabled I2C in $BOOT_CONFIG (reboot needed to take effect)."
        REBOOT_NEEDED=1
    else
        echo "    I2C already enabled in $BOOT_CONFIG."
    fi
else
    echo "    Could not find the boot config file; if i2cdetect finds no bus,"
    echo "    enable I2C manually (e.g. 'sudo raspi-config' -> Interface -> I2C)."
fi

# Let your user reach the I2C bus without sudo.
if ! id -nG "$USER" | grep -qw i2c; then
    sudo usermod -aG i2c "$USER"
    echo "    Added $USER to the 'i2c' group (log out and back in to apply)."
fi

# ---- Done --------------------------------------------------------------------
echo
echo "============================================================"
echo " Setup complete."
echo "============================================================"
echo "Check the Servo HAT is on the bus (it should appear at 40):"
echo "    i2cdetect -y 1"
echo
if [ -n "${REBOOT_NEEDED:-}" ]; then
    echo "I2C was just enabled -- REBOOT before the bus will work:  sudo reboot"
fi
echo "If you were just added to the 'i2c' group, log out and back in first."
echo
echo "Then try a lesson, for example:"
echo "    cd camera && python3 camera_simple.py"
