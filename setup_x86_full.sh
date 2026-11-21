#!/usr/bin/env bash
#
# setup_x86_full.sh - X Academy Robotics: full x86 (PC / laptop) development setup
#
# This is the x86 version of setup.sh. It sets up a topside computer the
# same way as the Raspberry Pi, plus the GitHub CLI, the tools for logging and
# dashboards (InfluxDB + Grafana) and NDI video.
#
# setup_x86.sh is the lighter laptop script (the repo .venv, CadQuery for the
# CAD lessons, CUDA OpenCV hint). This script does not replace it; run both if
# you need both.
#
# What it does:
#   1. Updates all installed packages
#   2. Installs emacs, git and openssh-server (and turns SSH on)
#   3. Installs pip3 and the Python modules the lessons use:
#        OpenCV, Flask, click, pygame, matplotlib
#   4. Installs the GitHub CLI (gh) from GitHub's apt repository
#   5. Installs Google Chrome
#   6. Installs PyCharm (latest release from JetBrains) into /opt/pycharm
#   7. Installs Grafana OSS (dashboards, http://localhost:3000)
#   8. Installs InfluxDB 3 Core (time-series database, http://localhost:8181)
#   9. Installs the NDI SDK for Linux into /opt/ndi-sdk:
#        libndi (into /usr/local/lib) and the NDI command-line tools
#      NOTE: NDI does not publish "NDI Tools" (Studio Monitor, Test Patterns,
#      etc.) for Linux, only for Windows and Mac. The SDK is the Linux
#      equivalent. Installing it accepts the NDI SDK license for you.
#
# Requirements:
#   - 64-bit x86 PC (amd64) running Ubuntu 24.04 or newer, or Debian 12 or newer
#   - Internet connection
#   - About 10 GB of free disk space
#
# Usage:
#   chmod +x setup_x86_full.sh
#   sudo ./setup_x86_full.sh
#
# The script is safe to run more than once. Anything already installed is
# skipped. To reinstall PyCharm or the NDI SDK (for example to get a newer
# version):
#   sudo FORCE_PYCHARM=1 FORCE_NDI=1 ./setup_x86_full.sh

set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

CHROME_DEB_URL="https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb"
PYCHARM_API_URL="https://data.services.jetbrains.com/products/releases?code=PCP&latest=true&type=release"
PYCHARM_DIR="/opt/pycharm"

GH_KEY_URL="https://cli.github.com/packages/githubcli-archive-keyring.gpg"
# SHA256 of the keyring file, as published in GitHub's install_linux.md.
GH_KEY_SHA256="6084d5d7bd8e288441e0e94fc6275570895da18e6751f70f057485dc2d1a811b"

GRAFANA_KEY_URL="https://apt.grafana.com/gpg-full.key"
INFLUX_KEY_URL="https://repos.influxdata.com/influxdata-archive.key"
INFLUX_KEY_FINGERPRINT="24C975CBA61A024EE1B631787C3D57159FC2F927"

NDI_SDK_NAME="Install_NDI_SDK_v6_Linux"
NDI_SDK_URL="https://downloads.ndi.tv/SDK/NDI_SDK_Linux/${NDI_SDK_NAME}.tar.gz"
NDI_DIR="/opt/ndi-sdk"

FORCE_PYCHARM="${FORCE_PYCHARM:-0}"
FORCE_NDI="${FORCE_NDI:-0}"
MIN_FREE_GB=10

FAILED_STEPS=()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '\033[1;33mWARNING: %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

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

# Print "[ OK ] name version" or "[FAIL] name" for an apt package.
check_pkg() {
    local pkg="$1"
    if dpkg -s "$pkg" >/dev/null 2>&1; then
        info "[ OK ] $pkg $(dpkg-query -W -f='${Version}' "$pkg")"
    else
        info "[FAIL] $pkg is not installed"
    fi
}

# ---------------------------------------------------------------------------
# Checks before we start
# ---------------------------------------------------------------------------

preflight() {
    [[ $EUID -eq 0 ]] || die "Please run with sudo:  sudo ./setup_x86_full.sh"

    command -v apt-get >/dev/null || die "apt-get not found. This script is for Ubuntu / Debian."

    local arch
    arch="$(dpkg --print-architecture)"
    if [[ "$arch" != "amd64" ]]; then
        die "This computer is running a '$arch' OS. This script is for 64-bit x86 (amd64). On a Raspberry Pi, use setup.sh."
    fi

    local free_gb
    free_gb="$(df --output=avail -BG / | tail -n 1 | tr -dc '0-9')"
    if (( free_gb < MIN_FREE_GB )); then
        die "Only ${free_gb} GB free on the disk. At least ${MIN_FREE_GB} GB is needed."
    fi

    local mem_mb
    mem_mb="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
    if (( mem_mb < 7500 )); then
        warn "This computer has ${mem_mb} MB of RAM. PyCharm, Grafana and InfluxDB together run best with 8 GB or more."
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
    # curl, ca-certificates and gnupg are needed by the later download steps.
    apt-get -y install emacs git openssh-server curl ca-certificates gnupg

    # Start the SSH server now and on every boot. Newer Ubuntu releases start
    # SSH through ssh.socket (sshd starts on the first connection).
    if systemctl cat ssh.socket >/dev/null 2>&1; then
        systemctl enable --now ssh.socket
    else
        systemctl enable --now ssh
    fi
}

install_python_modules() {
    # Python modules for the lesson programs:
    #   python3-pip         pip3 -- Python's package installer
    #   python3-opencv      OpenCV -- reads the camera, makes JPEGs
    #   python3-flask       Flask -- web server for camera_simple.py
    #   python3-click       click -- command-line options for stream_server.py
    #   python3-pygame      pygame -- reads the Logitech joystick
    #   python3-matplotlib  matplotlib -- plots and graphs
    apt-get -y install python3-pip python3-opencv python3-flask python3-click \
                       python3-pygame python3-matplotlib
}

install_chrome() {
    if dpkg -s google-chrome-stable >/dev/null 2>&1; then
        info "Google Chrome is already installed. Skipping."
        return 0
    fi

    local deb="$WORK_DIR/google-chrome-stable_current_amd64.deb"
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
print(release["version"], release["downloads"]["linux"]["link"])
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

    # Entry in the desktop menu (under Programming / Development)
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

install_gh() {
    # GitHub's own apt repository, so gh updates with everything else.
    # The signing key is checked against GitHub's published checksum first.
    local key="$WORK_DIR/githubcli-archive-keyring.gpg"
    curl -fsSL --retry 3 "$GH_KEY_URL" -o "$key"
    if [[ "$(sha256sum "$key" | awk '{print $1}')" != "$GH_KEY_SHA256" ]]; then
        echo "GitHub CLI signing key does not match the published checksum." >&2
        echo "(If GitHub has rotated its key, update GH_KEY_SHA256 from" >&2
        echo " https://github.com/cli/cli/blob/trunk/docs/install_linux.md )" >&2
        return 1
    fi
    install -d -m 755 /etc/apt/keyrings
    install -m 644 "$key" /etc/apt/keyrings/githubcli-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list

    apt-get update
    apt-get -y install gh
}

install_grafana() {
    # Grafana Labs' apt repository, so Grafana updates with everything else.
    install -d -m 755 /etc/apt/keyrings
    curl -fsSL --retry 3 "$GRAFANA_KEY_URL" -o /etc/apt/keyrings/grafana.asc
    chmod 644 /etc/apt/keyrings/grafana.asc
    echo "deb [signed-by=/etc/apt/keyrings/grafana.asc] https://apt.grafana.com stable main" \
        > /etc/apt/sources.list.d/grafana.list

    apt-get update
    apt-get -y install grafana

    # Start Grafana now and on every boot.
    systemctl daemon-reload
    systemctl enable --now grafana-server
}

install_influxdb() {
    # InfluxData's apt repository. The signing key is checked against
    # InfluxData's published fingerprint before it is trusted.
    local key="$WORK_DIR/influxdata-archive.key"
    curl -fsSL --retry 3 "$INFLUX_KEY_URL" -o "$key"
    if ! gpg --show-keys --with-fingerprint --with-colons "$key" 2>/dev/null \
         | grep -q "^fpr:*${INFLUX_KEY_FINGERPRINT}:\$"; then
        echo "InfluxData signing key does not match the expected fingerprint." >&2
        return 1
    fi
    gpg --dearmor < "$key" > /usr/share/keyrings/influxdata-archive.gpg
    chmod 644 /usr/share/keyrings/influxdata-archive.gpg
    echo "deb [signed-by=/usr/share/keyrings/influxdata-archive.gpg] https://repos.influxdata.com/debian stable main" \
        > /etc/apt/sources.list.d/influxdata.list

    apt-get update
    apt-get -y install influxdb3-core

    # The package enables the service but does not start it.
    systemctl enable --now influxdb3-core
}

install_ndi() {
    if ls /usr/local/lib/libndi.so* >/dev/null 2>&1 && [[ "$FORCE_NDI" != "1" ]]; then
        info "libndi is already installed in /usr/local/lib. Skipping."
        info "(Run with FORCE_NDI=1 to reinstall the latest NDI SDK.)"
        return 0
    fi

    # Avahi (mDNS) is how NDI senders and receivers find each other.
    apt-get -y install avahi-daemon
    systemctl enable --now avahi-daemon

    local ndi_tmp="$WORK_DIR/ndi"
    mkdir -p "$ndi_tmp"

    info "Downloading the NDI SDK for Linux ..."
    curl -fL --retry 3 --retry-delay 5 -o "$ndi_tmp/${NDI_SDK_NAME}.tar.gz" "$NDI_SDK_URL"
    tar -xzf "$ndi_tmp/${NDI_SDK_NAME}.tar.gz" -C "$ndi_tmp"

    # The SDK installer shows the NDI license and asks to accept it.
    # 'yes' accepts it, and it unpacks into "NDI SDK for Linux".
    info "Unpacking the NDI SDK (accepting the NDI SDK license) ..."
    # ('|| true' because 'yes' is stopped by a broken pipe when the installer ends.)
    ( cd "$ndi_tmp" && { yes || true; } | PAGER="cat" sh "./${NDI_SDK_NAME}.sh" >/dev/null )

    local sdk="$ndi_tmp/NDI SDK for Linux"
    [[ -d "$sdk/lib/x86_64-linux-gnu" ]] || { echo "NDI SDK did not unpack as expected." >&2; return 1; }

    # Keep the full SDK (headers, examples, docs, tools) in /opt/ndi-sdk.
    rm -rf "$NDI_DIR"
    mv "$sdk" "$NDI_DIR"

    # libndi into the system library path.
    cp -P "$NDI_DIR/lib/x86_64-linux-gnu/"libndi* /usr/local/lib/
    ldconfig

    # Put the NDI command-line tools on the PATH.
    local tool_dir="$NDI_DIR/bin/x86_64-linux-gnu" tool
    if [[ -d "$tool_dir" ]]; then
        for tool in "$tool_dir"/*; do
            [[ -f "$tool" && -x "$tool" ]] || continue
            ln -sf "$tool" "/usr/local/bin/$(basename "$tool")"
            info "Added NDI tool: $(basename "$tool")"
        done
    fi

    # Let users build against the SDK without root.
    chmod -R a+rX "$NDI_DIR"
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

print_summary() {
    log "Summary"

    local pkg
    for pkg in emacs git openssh-server \
               python3-pip python3-opencv python3-flask python3-click \
               python3-pygame python3-matplotlib \
               gh google-chrome-stable grafana influxdb3-core; do
        check_pkg "$pkg"
    done

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

    local ndi_lib
    ndi_lib="$(ldconfig -p | awk '/libndi\.so/ {print $NF; exit}' || true)"
    if [[ -n "$ndi_lib" ]]; then
        info "[ OK ] libndi ($ndi_lib)"
    else
        info "[FAIL] libndi is not installed"
    fi

    echo
    if systemctl is-active --quiet ssh || systemctl is-active --quiet ssh.socket; then
        info "[ OK ] SSH server is on. Connect with:  ssh $(logname 2>/dev/null || echo USER)@$(hostname -I | awk '{print $1}')"
    else
        info "[FAIL] SSH server is not running"
    fi
    if systemctl is-active --quiet grafana-server; then
        info "[ OK ] Grafana is running:  http://localhost:3000  (first login admin / admin)"
    else
        info "[FAIL] Grafana is not running"
    fi
    if systemctl is-active --quiet influxdb3-core; then
        info "[ OK ] InfluxDB 3 is running:  http://localhost:8181"
        info "       Create an admin token with:  influxdb3 create token --admin"
    else
        info "[FAIL] InfluxDB 3 is not running"
    fi

    if (( ${#FAILED_STEPS[@]} > 0 )); then
        echo
        warn "These steps failed: ${FAILED_STEPS[*]}"
        warn "Check your internet connection and run the script again."
        return 1
    fi

    echo
    info "All done. A reboot is recommended:  sudo reboot"
    info "Sign in to GitHub (as yourself, not with sudo):  gh auth login"
    info "Then run a camera program from the camera folder, for example:"
    info "    python3 camera_simple.py"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

preflight

# Downloads go in /var/tmp, not /tmp. On some systems /tmp lives in RAM and
# is too small for the PyCharm download.
WORK_DIR="$(mktemp -d /var/tmp/setup_x86_full.XXXXXX)"
chmod 755 "$WORK_DIR"
trap 'rm -rf "$WORK_DIR"' EXIT

run_step "Updating packages"                          update_packages
run_step "Installing emacs, git and openssh-server"   install_apt_packages
run_step "Installing pip3 and Python modules"         install_python_modules
run_step "Installing GitHub CLI (gh)"                 install_gh
run_step "Installing Google Chrome"                   install_chrome
run_step "Installing PyCharm"                         install_pycharm
run_step "Installing Grafana"                         install_grafana
run_step "Installing InfluxDB 3 Core"                 install_influxdb
run_step "Installing NDI SDK (libndi + NDI tools)"    install_ndi

print_summary
