#!/usr/bin/env bash
#
# build_opencv_cuda.sh - compile OpenCV from source WITH CUDA on an x86_64
# Ubuntu laptop with an NVIDIA GPU (e.g. the Alienware with an RTX 4070), and
# install its Python module into the project's virtual environment.
#
# Why this is a separate script: there is NO reliable prebuilt CUDA OpenCV --
# Ubuntu's apt package and the PyPI wheels (opencv-python, etc.) are all
# CPU-only, and 'opencv-python-cuda' does not exist. The only way to get
# cv2.cuda.* working is to compile OpenCV yourself. That takes 30-60 minutes
# and a lot of disk, so it is kept out of the normal setup_x86.sh.
#
# Run setup_x86.sh FIRST (it makes the venv and installs the CPU OpenCV + the
# other libs). Then run this to replace the CPU OpenCV with a CUDA build.
#
# Prerequisites (this script checks them and stops early if they're missing):
#   * The NVIDIA driver working      -> nvidia-smi shows the GPU
#       install with: sudo ubuntu-drivers autoinstall   (then reboot)
#   * ~15 GB free disk near the repo (CUDA build objects are large)
#   * The CUDA toolkit (nvcc). If it's missing this installs apt's version;
#     for best RTX 40-series support, install CUDA 12.x from NVIDIA's repo
#     first and re-run.
#
# Usage:
#   chmod +x build_opencv_cuda.sh
#   ./build_opencv_cuda.sh
#
# Tunables (environment variables):
#   OPENCV_VERSION=4.11.0     which OpenCV release to build
#   CUDA_ARCH_BIN=8.9         GPU compute capability (8.9 = RTX 40-series/Ada)
#   BUILD_DIR=<path>          where to clone + build (default: repo/.opencv-cuda-build)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${REPO_DIR}/.venv"
VENV_PY="${VENV_DIR}/bin/python"

OPENCV_VERSION="${OPENCV_VERSION:-4.11.0}"
CUDA_ARCH_BIN="${CUDA_ARCH_BIN:-8.9}"     # RTX 4070 (Ada Lovelace)
BUILD_DIR="${BUILD_DIR:-${REPO_DIR}/.opencv-cuda-build}"

info() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
note() { printf '    %s\n' "$*"; }
die()  { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

SUDO=""; [[ $EUID -ne 0 ]] && SUDO="sudo"

# ---------------------------------------------------------------------------
# Prerequisite checks - stop early rather than grind for an hour then fail.
# ---------------------------------------------------------------------------
info "Checking prerequisites"

[[ "$(uname -m)" == "x86_64" ]] || die "This is for an x86_64 laptop with an NVIDIA GPU."

if [[ ! -x "$VENV_PY" ]]; then
    die "No venv at $VENV_DIR. Run ./setup_x86.sh first."
fi

if ! command -v nvidia-smi >/dev/null 2>&1 || ! nvidia-smi >/dev/null 2>&1; then
    die "The NVIDIA driver isn't working (nvidia-smi fails). Install it first:
      sudo ubuntu-drivers autoinstall     # then reboot
    and run this script again."
fi
note "GPU: $(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)"

# Free disk near the repo (the source + build tree needs ~15 GB).
avail_gb="$(df -BG --output=avail "$REPO_DIR" 2>/dev/null | tail -1 | tr -dc '0-9')"
if [[ -n "$avail_gb" ]] && (( avail_gb < 15 )); then
    die "Only ${avail_gb} GB free near $REPO_DIR; the CUDA build needs ~15 GB.
    Free up space, or set BUILD_DIR=/path/on/a/bigger/disk and re-run."
fi
note "Free disk near repo: ${avail_gb:-?} GB"

# ---------------------------------------------------------------------------
# CUDA toolkit
# ---------------------------------------------------------------------------
info "CUDA toolkit"
if ! command -v nvcc >/dev/null 2>&1; then
    note "nvcc not found; installing apt's nvidia-cuda-toolkit (older 11.x)."
    note "For best RTX 40-series support, install CUDA 12.x from NVIDIA's repo"
    note "and re-run instead."
    $SUDO apt-get update
    $SUDO apt-get -y install nvidia-cuda-toolkit || die "Could not install the CUDA toolkit."
fi
note "Using $(nvcc --version | sed -n 's/.*release //p' | head -1)"

# ---------------------------------------------------------------------------
# Build dependencies
# ---------------------------------------------------------------------------
info "Installing build dependencies"
$SUDO apt-get update
$SUDO apt-get -y install \
    build-essential cmake pkg-config git \
    libgtk-3-dev libavcodec-dev libavformat-dev libswscale-dev \
    libv4l-dev libjpeg-dev libpng-dev libtiff-dev \
    libtbb-dev libeigen3-dev python3-dev

# ---------------------------------------------------------------------------
# Get matching opencv + opencv_contrib sources
# ---------------------------------------------------------------------------
info "Fetching OpenCV $OPENCV_VERSION sources into $BUILD_DIR"
mkdir -p "$BUILD_DIR"; cd "$BUILD_DIR"
[[ -d opencv ]]         || git clone --depth 1 -b "$OPENCV_VERSION" https://github.com/opencv/opencv.git
[[ -d opencv_contrib ]] || git clone --depth 1 -b "$OPENCV_VERSION" https://github.com/opencv/opencv_contrib.git

# ---------------------------------------------------------------------------
# Configure + build
# --------------------------------------------------------------------------
info "Configuring the CUDA build (arch $CUDA_ARCH_BIN)"
# Install the python module straight into the project's venv.
PYPKG="$("$VENV_PY" -c 'import site;print(site.getsitepackages()[0])')"
rm -rf opencv/build; mkdir -p opencv/build; cd opencv/build
cmake -D CMAKE_BUILD_TYPE=Release \
      -D CMAKE_INSTALL_PREFIX=/usr/local \
      -D OPENCV_EXTRA_MODULES_PATH="${BUILD_DIR}/opencv_contrib/modules" \
      -D WITH_CUDA=ON -D WITH_CUDNN=ON -D OPENCV_DNN_CUDA=ON \
      -D CUDA_ARCH_BIN="${CUDA_ARCH_BIN}" \
      -D WITH_CUBLAS=ON -D ENABLE_FAST_MATH=ON -D CUDA_FAST_MATH=ON \
      -D WITH_GTK=ON -D WITH_V4L=ON -D WITH_FFMPEG=ON \
      -D BUILD_opencv_python3=ON \
      -D PYTHON3_EXECUTABLE="$VENV_PY" \
      -D OPENCV_PYTHON3_INSTALL_PATH="$PYPKG" \
      -D BUILD_EXAMPLES=OFF -D BUILD_TESTS=OFF -D BUILD_PERF_TESTS=OFF \
      ..

info "Compiling OpenCV with CUDA (this takes 30-60 minutes) ..."
make -j"$(nproc)"
$SUDO make install
$SUDO ldconfig

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
info "Verifying"
ncuda="$("$VENV_PY" -c 'import cv2;print(cv2.cuda.getCudaEnabledDeviceCount())' 2>/dev/null || echo 0)"
ver="$("$VENV_PY" -c 'import cv2;print(cv2.__version__)' 2>/dev/null || echo '?')"
if [[ "$ncuda" =~ ^[0-9]+$ ]] && (( ncuda > 0 )); then
    note "Success: OpenCV $ver sees $ncuda CUDA device(s)."
    note "Test it:  source ${VENV_DIR}/bin/activate"
    note "          python3 -c 'import cv2; print(cv2.cuda.getCudaEnabledDeviceCount())'"
    note ""
    note "To free the build tree now that it's installed:"
    note "    rm -rf \"$BUILD_DIR\""
else
    die "Built and installed, but the venv reports 0 CUDA devices. Check the
    cmake output above for 'NVIDIA CUDA: YES' and that the venv python
    ($VENV_PY) picked up the new cv2 (import cv2; cv2.__file__)."
fi
