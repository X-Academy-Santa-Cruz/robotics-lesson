#!/usr/bin/env bash
#
# setup_x86.sh - set up the X Academy ROV software on an x86_64 Ubuntu laptop
# (e.g. the Alienware), NOT the Raspberry Pi.
#
# Use this to run the camera, the dashboard, and the stereo / camera-mount (CAD)
# work on a Linux laptop. It installs ONLY what those need and deliberately
# skips everything that requires Pi hardware (SparkFun Servo HAT, I2C, thrusters,
# joystick pilot, temperature sensor). For the Pi, use setup.sh instead.
#
# OpenCV is installed FROM APT (python3-opencv). That build is CPU-only --
# Ubuntu does not ship a CUDA build of OpenCV, and there is no reliable prebuilt
# CUDA wheel on PyPI. The camera and stereo programs in this repo run fine on
# the CPU build. To get a GPU-accelerated OpenCV for the RTX 4070, run the
# separate build_opencv_cuda.sh script (it compiles OpenCV from source).
#
# What it installs into one virtual environment at the repo root
# (~/robotics-lesson/.venv, created with --system-site-packages so it can see
# the apt-installed OpenCV):
#     Camera    : OpenCV (apt), flask, click   (stream_server.py, camera_simple.py)
#     Dashboard : flask, click                 (dashboard.py)
#     Stereo    : OpenCV (apt), numpy          (stereo/stereo_measure.py)
#     CAD       : cadquery (pip)               (cad/*.py -> STEP/STL)
#
# Usage:
#   chmod +x setup_x86.sh
#   ./setup_x86.sh
#
# Safe to re-run. Each step is best-effort: a failure is warned about and the
# script keeps going, then prints a summary so you can see what worked.

set -u

# ---------------------------------------------------------------------------
# Where things live
# ---------------------------------------------------------------------------
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${REPO_DIR}/.venv"
VENV_PY="${VENV_DIR}/bin/python"

FAILED_STEPS=()

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '\033[1;33mWARNING: %s\033[0m\n' "$*" >&2; }

SUDO=""; [[ $EUID -ne 0 ]] && SUDO="sudo"

run_step() {
    local name="$1" func="$2" rc
    log "$name"
    ( set -e; "$func" ); rc=$?
    if (( rc != 0 )); then
        warn "'$name' failed (exit $rc). Continuing."
        FAILED_STEPS+=("$name")
    fi
}

# ---------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------

check_platform() {
    local arch; arch="$(uname -m)"
    [[ "$arch" == "x86_64" ]] || warn "Meant for x86_64; this machine is '$arch'. On a Pi use setup.sh."
    command -v apt-get >/dev/null 2>&1 || warn "apt-get not found; system package steps will be skipped."
    if command -v nvidia-smi >/dev/null 2>&1; then
        info "NVIDIA GPU: $(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)"
        info "(For GPU-accelerated OpenCV, run ./build_opencv_cuda.sh after this.)"
    fi
}

install_apt_packages() {
    command -v apt-get >/dev/null 2>&1 || return 0
    $SUDO apt-get update
    # Python tooling, OpenCV (CPU build) + numpy from apt, the GUI/video libs
    # OpenCV needs for cv2.imshow and USB cameras, and v4l-utils for listing and
    # locking webcams. flask/click come from pip into the venv below.
    $SUDO apt-get -y install \
        python3 python3-venv python3-pip python3-dev \
        python3-opencv python3-numpy \
        libgl1 libglib2.0-0 libgtk-3-0 \
        v4l-utils git
}

create_venv() {
    # --system-site-packages so the venv can see apt's OpenCV/numpy (and a
    # CUDA OpenCV, if build_opencv_cuda.sh installs one system-wide later).
    if [[ ! -d "$VENV_DIR" ]]; then
        info "Creating the virtual environment in $VENV_DIR ..."
        python3 -m venv --system-site-packages "$VENV_DIR"
    else
        info "Virtual environment already exists in $VENV_DIR."
    fi
    if ! "$VENV_PY" -m pip --version >/dev/null 2>&1; then
        "$VENV_PY" -m ensurepip --upgrade >/dev/null 2>&1 || true
    fi
    "$VENV_PY" -m pip install --upgrade pip setuptools wheel || \
        warn "Could not upgrade pip/setuptools/wheel (continuing)."
}

install_python_libs() {
    # flask + click for the camera web server and the dashboard. OpenCV and
    # numpy come from apt (visible via --system-site-packages), so they are not
    # pip-installed here -- that keeps a single OpenCV on the machine and lets a
    # CUDA build (if you make one) be the one the programs use.
    "$VENV_PY" -m pip install --retries 5 --timeout 60 flask click
}

install_cad_libs() {
    # CadQuery (+ its OpenCASCADE backend) builds the camera/stereo mounts into
    # STEP/STL. Large first-time download; that's expected. It goes in the venv
    # only, so it never competes with the system OpenCV.
    "$VENV_PY" -m pip install --retries 5 --timeout 120 cadquery
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print_summary() {
    log "Summary"
    local mod
    for mod in cv2 numpy flask click cadquery; do
        if "$VENV_PY" -c "import $mod" >/dev/null 2>&1; then
            local extra=""
            [[ "$mod" == cv2 ]] && extra=" ($("$VENV_PY" -c 'import cv2;print(cv2.__version__)' 2>/dev/null))"
            info "[ OK ] $mod$extra"
        else
            info "[FAIL] $mod is not importable from the venv"
        fi
    done
    # Report whether OpenCV sees the GPU (it won't until you build the CUDA one).
    local ncuda
    ncuda="$("$VENV_PY" -c 'import cv2;print(cv2.cuda.getCudaEnabledDeviceCount())' 2>/dev/null)"
    if [[ -n "$ncuda" && "$ncuda" != "0" ]]; then
        info "[ OK ] OpenCV CUDA devices: $ncuda"
    else
        info "[info] OpenCV is CPU-only. For GPU support, run ./build_opencv_cuda.sh"
    fi

    if (( ${#FAILED_STEPS[@]} > 0 )); then
        echo; warn "These steps failed: ${FAILED_STEPS[*]}"
        warn "Check your network and run again."
    fi

    echo
    info "Done. Activate the venv before running anything:"
    info "    source ${VENV_DIR}/bin/activate"
    echo
    info "Then, for example:"
    info "    ./start_camera.sh                      # camera stream at http://localhost:8000/"
    info "    ./start_stereo.sh                      # generate the stereo mount STEP/STL"
    info "    python3 stereo/stereo_measure.py list  # stereo measurement tool"
    info "    ./start_rov.sh                         # dashboard + whatever runs on a laptop"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
check_platform
run_step "Installing system packages + OpenCV (apt)" install_apt_packages
run_step "Creating the virtual environment"          create_venv
run_step "Installing flask/click (pip)"              install_python_libs
run_step "Installing CadQuery (CAD)"                 install_cad_libs
print_summary
