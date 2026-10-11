#!/usr/bin/env bash
#
# setup.sh - X Academy Robotics: one-time setup for the whole robotics-lesson
# course, run on the Raspberry Pi.
#
# What it does:
#   1. Updates all installed packages
#   2. Installs emacs, git and openssh-server (and turns SSH on)
#   3. Installs pip3 and the Python modules the lessons use:
#        OpenCV  (camera: both programs)
#        Flask   (camera: camera_simple.py)
#        click   (camera: stream_server.py)
#        pygame  (thrusters / control: reads the joystick)
#      plus the I2C tools (i2c-tools, python3-smbus)
#   4. Installs the SparkFun Pi Servo HAT library from SparkFun's own source
#      (git clone + pip install) for the thrusters and gripper (servos / PWM)
#   5. Enables the I2C bus and adds you to the i2c group so the Servo HAT works
#   6. Installs Google Chrome (official ARM64 build from Google)
#   7. Installs PyCharm (latest ARM64 release from JetBrains) into /opt/pycharm
#
# Requirements:
#   - Raspberry Pi 4 or 5 running a 64-bit (arm64) OS (Raspberry Pi OS Bookworm
#     or newer, or Ubuntu for the Pi)
#   - Internet connection
#   - About 6 GB of free space on the SD card
#
# Usage:
#   chmod +x setup.sh
#   sudo ./setup.sh
#
# The script is safe to run more than once. Anything already installed is
# skipped. To reinstall PyCharm (for example to get a newer version):
#   sudo FORCE_PYCHARM=1 ./setup.sh

set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

CHROME_DEB_URL="https://dl.google.com/linux/direct/google-chrome-stable_current_arm64.deb"
PYCHARM_API_URL="https://data.services.jetbrains.com/products/releases?code=PCP&latest=true&type=release"
PYCHARM_DIR="/opt/pycharm"
FORCE_PYCHARM="${FORCE_PYCHARM:-0}"
MIN_FREE_GB=6

SERVO_HAT_REPO="https://github.com/sparkfun/PiServoHat_Py.git"

FAILED_STEPS=()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '\033[1;33mWARNING: %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# The non-root user we are setting up for (so the pip install and i2c group
# apply to the student's account, not to root).
TARGET_USER="${SUDO_USER:-$(logname 2>/dev/null || echo "$USER")}"

# Run one step in a subshell so a failure in that step is recorded and the
# remaining steps still run.
run_step() {
    local name="$1" func="$2" rc
    log "$name"
    set +e
    ( set -e; "$func" )
    rc=$?
    set -e
    if (( rc != 0 )); then
        warn "'$name' failed (exit code $rc). Continuing with the next step."
        FAILED_STEPS+=("$name")
    fi
}

# ---------------------------------------------------------------------------
# Checks before we start
# ---------------------------------------------------------------------------

preflight() {
    [[ $EUID -eq 0 ]] || die "Please run with sudo:  sudo ./setup.sh"

    command -v apt-get >/dev/null || die "apt-get not found. This script is for Raspberry Pi OS / Ubuntu / Debian."

    local arch
    arch="$(dpkg --print-architecture)"
    if [[ "$arch" != "arm64" ]]; then
        die "This Pi is running a '$arch' OS. Chrome and PyCharm need a 64-bit (arm64) OS. Re-image the SD card with the 64-bit OS."
    fi

    local free_gb
    free_gb="$(df --output=avail -BG / | tail -n 1 | tr -dc '0-9')"
    if (( free_gb < MIN_FREE_GB )); then
        die "Only ${free_gb} GB free on the SD card. At least ${MIN_FREE_GB} GB is needed."
    fi

    local mem_mb
    mem_mb="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
    if (( mem_mb < 3500 )); then
        warn "This Pi has ${mem_mb} MB of RAM. PyCharm will be slow with less than 4 GB."
    fi
}

# ---------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------

update_packages() {
    apt-get update
    apt-get -y \
        -o Dpkg::Options::="--force-confdef" \
        -o Dpkg::Options::="--force-confold" \
        full-upgrade
    apt-get -y autoremove
}

install_apt_packages() {
    # curl and ca-certificates are needed by the Chrome and PyCharm steps.
    apt-get -y install emacs git openssh-server curl ca-certificates

    # Start the SSH server now and on every boot.
    systemctl enable --now ssh
}

install_python_modules() {
    # Python modules the lesson programs use:
    #   python3-pip     pip3 -- Python's package installer
    #   python3-opencv  OpenCV -- camera (reads the camera, makes JPEGs)
    #   python3-flask   Flask -- camera (web server for camera_simple.py)
    #   python3-click   click -- camera (command-line options for stream_server.py)
    #   python3-pygame  pygame -- thrusters/control (reads the joystick)
    #   python3-smbus   SMBus -- talking to I2C devices from Python
    #   i2c-tools       i2cdetect and friends, to find devices on the I2C bus
    apt-get -y install \
        python3-pip python3-opencv python3-flask python3-click \
        python3-pygame python3-smbus i2c-tools
}

install_servo_hat() {
    # The SparkFun Pi Servo HAT library drives the PCA9685 servo/PWM controller
    # for the thrusters and the gripper. We build it from SparkFun's own source
    # so we get exactly their code; pip pulls its dependencies (qwiic_i2c,
    # qwiic_pca9685) automatically from the project's pyproject.toml.
    local dir="/home/${TARGET_USER}/PiServoHat_Py"

    if [[ -d "$dir/.git" ]]; then
        info "Updating existing clone in $dir ..."
        sudo -u "$TARGET_USER" git -C "$dir" pull --ff-only
    else
        info "Cloning $SERVO_HAT_REPO into $dir ..."
        sudo -u "$TARGET_USER" git clone "$SERVO_HAT_REPO" "$dir"
    fi

    # Install it system-wide. On newer OS releases pip outside a venv needs
    # --break-system-packages.
    if ! pip3 install "$dir" 2>/dev/null; then
        info "(retrying with --break-system-packages for newer OS versions)"
        pip3 install --break-system-packages "$dir"
    fi
}

enable_i2c() {
    # Load the I2C kernel module now, and on every boot.
    modprobe i2c-dev || true
    if ! grep -q '^i2c-dev' /etc/modules 2>/dev/null; then
        echo 'i2c-dev' >> /etc/modules
    fi

    # Turn the I2C bus on in the Pi's firmware config so it comes up at boot.
    local boot_config=""
    for f in /boot/firmware/config.txt /boot/config.txt; do
        if [[ -f "$f" ]]; then boot_config="$f"; break; fi
    done
    if [[ -n "$boot_config" ]]; then
        if ! grep -q '^dtparam=i2c_arm=on' "$boot_config"; then
            echo 'dtparam=i2c_arm=on' >> "$boot_config"
            info "Enabled I2C in $boot_config (reboot needed to take effect)."
        else
            info "I2C already enabled in $boot_config."
        fi
    else
        warn "Could not find the boot config file; if i2cdetect finds no bus, enable I2C manually (e.g. 'sudo raspi-config' -> Interface -> I2C)."
    fi

    # Let the student's user reach the I2C bus without sudo.
    if ! id -nG "$TARGET_USER" | grep -qw i2c; then
        usermod -aG i2c "$TARGET_USER"
        info "Added $TARGET_USER to the 'i2c' group (log out and back in to apply)."
    fi
}

install_chrome() {
    if dpkg -s google-chrome-stable >/dev/null 2>&1; then
        info "Google Chrome is already installed. Skipping."
        return 0
    fi

    local deb="$WORK_DIR/google-chrome-stable_current_arm64.deb"
    info "Downloading Google Chrome ..."
    curl -fL --retry 3 --retry-delay 5 -o "$deb" "$CHROME_DEB_URL"

    # Installing the .deb also adds Google's apt repository, so Chrome is
    # updated along with everything else by 'apt-get upgrade'.
    apt-get -y install "$deb"
}

install_pycharm() {
    if [[ -d "$PYCHARM_DIR/bin" && "$FORCE_PYCHARM" != "1" ]]; then
        info "PyCharm is already installed in $PYCHARM_DIR. Skipping."
        info "(Run with FORCE_PYCHARM=1 to reinstall the latest version.)"
        return 0
    fi

    info "Looking up the latest PyCharm release ..."
    local url version
    read -r version url < <(
        curl -fsSL --retry 3 "$PYCHARM_API_URL" | python3 -c '
import json, sys
release = json.load(sys.stdin)["PCP"][0]
print(release["version"], release["downloads"]["linuxARM64"]["link"])
'
    )
    [[ -n "${url:-}" ]] || { echo "Could not find the PyCharm download link." >&2; return 1; }

    local tarball="$WORK_DIR/pycharm.tar.gz"
    info "Downloading PyCharm $version (about 1.3 GB, this takes a while) ..."
    curl -fL --retry 3 --retry-delay 5 -C - -o "$tarball" "$url"

    info "Verifying the download ..."
    local expected actual
    expected="$(curl -fsSL --retry 3 "${url}.sha256" | awk '{print $1}')"
    actual="$(sha256sum "$tarball" | awk '{print $1}')"
    if [[ -z "$expected" || "$expected" != "$actual" ]]; then
        echo "PyCharm download is corrupt (checksum does not match)." >&2
        return 1
    fi

    info "Installing to $PYCHARM_DIR ..."
    rm -rf "$PYCHARM_DIR"
    mkdir -p "$PYCHARM_DIR"
    tar -xzf "$tarball" -C "$PYCHARM_DIR" --strip-components=1
    rm -f "$tarball"

    # Newer releases ship bin/pycharm, older ones bin/pycharm.sh.
    local launcher="$PYCHARM_DIR/bin/pycharm"
    [[ -x "$launcher" ]] || launcher="$PYCHARM_DIR/bin/pycharm.sh"
    [[ -x "$launcher" ]] || { echo "PyCharm launcher not found in $PYCHARM_DIR/bin." >&2; return 1; }

    # 'pycharm' command in the terminal
    ln -sf "$launcher" /usr/local/bin/pycharm

    # Entry in the desktop menu (under Programming)
    cat > /usr/share/applications/pycharm.desktop <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=PyCharm
Comment=Python IDE
Exec=$launcher %f
Icon=$PYCHARM_DIR/bin/pycharm.svg
Terminal=false
Categories=Development;IDE;
StartupWMClass=jetbrains-pycharm
StartupNotify=true
EOF
    chmod 644 /usr/share/applications/pycharm.desktop
}

# ---------------------------------------------------------------------------
# Pin PyCharm and Google Chrome to the dock / taskbar
# ---------------------------------------------------------------------------
#
# "The dock" means different things depending on the desktop:
#   * GNOME (Ubuntu Desktop)      -> the favorites bar (gsettings favorite-apps)
#   * Raspberry Pi OS (wf-panel / LXDE-pi) -> the taskbar launchers
# Favorites are a per-user setting, so this runs as $TARGET_USER, not root.

pin_to_dock() {
    local chrome_desktop="google-chrome.desktop"
    local pycharm_desktop="pycharm.desktop"

    # Only pin apps that actually installed.
    local -a wanted=()
    [[ -f "/usr/share/applications/$pycharm_desktop" ]] && wanted+=("$pycharm_desktop")
    if [[ -f "/usr/share/applications/$chrome_desktop" ]]; then
        wanted+=("$chrome_desktop")
    elif [[ -f "/usr/share/applications/google-chrome-stable.desktop" ]]; then
        chrome_desktop="google-chrome-stable.desktop"
        wanted+=("$chrome_desktop")
    fi
    if (( ${#wanted[@]} == 0 )); then
        info "Neither app is installed yet; nothing to pin."
        return 0
    fi

    local ran=0

    # --- GNOME (Ubuntu) ------------------------------------------------------
    if sudo -u "$TARGET_USER" bash -lc 'command -v gsettings >/dev/null' \
       && sudo -u "$TARGET_USER" bash -lc 'gsettings get org.gnome.shell favorite-apps >/dev/null 2>&1'; then
        info "GNOME detected; adding to the favorites dock ..."
        # DBus session address for the logged-in user, so gsettings writes to
        # the right session.
        local uid bus
        uid="$(id -u "$TARGET_USER")"
        bus="unix:path=/run/user/${uid}/bus"
        for app in "${wanted[@]}"; do
            sudo -u "$TARGET_USER" \
                DBUS_SESSION_BUS_ADDRESS="$bus" \
                python3 - "$app" <<'PYIN'
import subprocess, sys, ast
app = sys.argv[1]
cur = subprocess.check_output(
    ["gsettings", "get", "org.gnome.shell", "favorite-apps"], text=True).strip()
try:
    favs = ast.literal_eval(cur)
except Exception:
    favs = []
if app not in favs:
    favs.append(app)
    subprocess.run(
        ["gsettings", "set", "org.gnome.shell", "favorite-apps", str(favs)],
        check=True)
    print("    pinned", app)
else:
    print("   ", app, "already pinned")
PYIN
        done
        ran=1
    fi

    # --- Raspberry Pi OS (wf-panel-pi, the Wayland/labwc default) -------------
    local wf="/home/${TARGET_USER}/.config/wf-panel-pi.ini"
    if [[ -f "$wf" ]] || sudo -u "$TARGET_USER" bash -lc 'command -v wf-panel-pi >/dev/null 2>&1'; then
        info "Raspberry Pi (wf-panel) detected; adding taskbar launchers ..."
        sudo -u "$TARGET_USER" mkdir -p "$(dirname "$wf")"
        for app in "${wanted[@]}"; do
            # wf-panel pins launchers as launcher_000N=<desktop file>
            if ! grep -q "=$app\$" "$wf" 2>/dev/null; then
                # find the next free launcher index
                local n=0
                while grep -q "^launcher_$(printf '%06d' "$n")=" "$wf" 2>/dev/null; do
                    n=$((n+1))
                done
                printf 'launcher_%06d=%s\n' "$n" "$app" | sudo -u "$TARGET_USER" tee -a "$wf" >/dev/null
                info "    added $app to the taskbar"
            else
                info "    $app already on the taskbar"
            fi
        done
        ran=1
    fi

    if (( ran == 0 )); then
        warn "No supported desktop (GNOME or wf-panel) found. Pin PyCharm and Chrome by hand: open each, then right-click its dock icon and choose 'Pin to taskbar' / 'Add to Favorites'."
    fi
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

print_summary() {
    log "Summary"

    local pkg
    for pkg in emacs git openssh-server \
               python3-pip python3-opencv python3-flask python3-click \
               python3-pygame python3-smbus i2c-tools \
               google-chrome-stable; do
        if dpkg -s "$pkg" >/dev/null 2>&1; then
            info "[ OK ] $pkg $(dpkg-query -W -f='${Version}' "$pkg")"
        else
            info "[FAIL] $pkg is not installed"
        fi
    done

    if python3 -c 'import pi_servo_hat' >/dev/null 2>&1; then
        info "[ OK ] pi_servo_hat (SparkFun Pi Servo HAT library)"
    else
        info "[FAIL] pi_servo_hat is not importable"
    fi

    if [[ -d "$PYCHARM_DIR/bin" ]]; then
        local build="unknown"
        if [[ -f "$PYCHARM_DIR/product-info.json" ]]; then
            build="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' \
                "$PYCHARM_DIR/product-info.json" 2>/dev/null || echo unknown)"
        fi
        info "[ OK ] pycharm $build ($PYCHARM_DIR)"
    else
        info "[FAIL] pycharm is not installed"
    fi

    if systemctl is-active --quiet ssh; then
        info "[ OK ] SSH server is running. Connect with:  ssh ${TARGET_USER}@$(hostname -I | awk '{print $1}')"
    else
        info "[FAIL] SSH server is not running"
    fi

    echo
    info "Check the Servo HAT is on the I2C bus (it should appear at 40):"
    info "    i2cdetect -y 1"

    if (( ${#FAILED_STEPS[@]} > 0 )); then
        echo
        warn "These steps failed: ${FAILED_STEPS[*]}"
        warn "Check your internet connection and run the script again."
        return 1
    fi

    echo
    info "All done. A reboot is recommended (also applies the I2C changes and"
    info "shows the pinned PyCharm and Chrome icons on the dock/taskbar):"
    info "    sudo reboot"
    info "If you were just added to the 'i2c' group, log out and back in too."
    info "Then run a camera program from the camera folder, for example:"
    info "    python3 camera_simple.py"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

preflight

# Downloads go in /var/tmp, not /tmp. On newer Raspberry Pi OS releases /tmp
# lives in RAM and is too small for the PyCharm download.
WORK_DIR="$(mktemp -d /var/tmp/setup.XXXXXX)"
chmod 755 "$WORK_DIR"
trap 'rm -rf "$WORK_DIR"' EXIT

run_step "Updating packages"                              update_packages
run_step "Installing emacs, git and openssh-server"       install_apt_packages
run_step "Installing pip3 and Python modules"             install_python_modules
run_step "Installing the SparkFun Pi Servo HAT library"   install_servo_hat
run_step "Enabling the I2C bus"                           enable_i2c
run_step "Installing Google Chrome"                       install_chrome
run_step "Installing PyCharm"                             install_pycharm
run_step "Pinning PyCharm and Chrome to the dock"         pin_to_dock

print_summary
