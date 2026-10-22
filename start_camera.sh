#!/usr/bin/env bash
#
# start_camera.sh - start just the camera stream on this computer (laptop or Pi)
# and open it in a browser. The stream serves MJPEG over HTTP:
#
#   stream_server.py  ->  http://localhost:8000/video   (raw stream)
#                         http://localhost:8000/        (viewer page)
#
# Usage (from anywhere; the shared venv is used automatically):
#   ./start_camera.sh                 # defaults: camera 0, 640x480, port 8000
#   ./start_camera.sh --camera 1      # pass any stream_server.py options through
#   ./start_camera.sh --width 320 --height 240
#   ./start_camera.sh stop            # stop a running camera stream
#
# Any option you pass is handed straight to stream_server.py (run
# 'python3 camera/stream_server.py --help' to see them all).
#
# The log goes to ~/robotics-lesson/logs/camera.log.

set -u

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PY="${REPO_DIR}/.venv/bin/python3"
LOG_DIR="${REPO_DIR}/logs"
CAMERA="${REPO_DIR}/camera/stream_server.py"
PORT=8000
URL="http://localhost:${PORT}/"

# Use the venv's Python if present, otherwise the system one.
if [[ -x "$VENV_PY" ]]; then PY="$VENV_PY"; else PY="$(command -v python3)"; fi

# "stop" just kills a running stream and exits.
if [[ "${1:-}" == "stop" ]]; then
    if pkill -f "$CAMERA" 2>/dev/null; then echo "Stopped the camera stream."
    else echo "No camera stream was running."; fi
    exit 0
fi

mkdir -p "$LOG_DIR"

# Don't stack two servers on the same port: stop any old copy first.
pkill -f "$CAMERA" 2>/dev/null && { echo "Stopped a previous camera stream."; sleep 1; }

echo "Starting the camera stream ..."
# setsid detaches it so it keeps running after this script exits. Any args to
# this script (e.g. --camera 1) pass straight through to stream_server.py.
setsid "$PY" "$CAMERA" "$@" >"${LOG_DIR}/camera.log" 2>&1 &
echo "  pid $! (log: ${LOG_DIR}/camera.log)"

# Give it a moment to open the camera and bind the port.
sleep 3

# Open the viewer page if we have a desktop; otherwise just print the URL.
if [[ -n "${DISPLAY:-}" || -n "${WAYLAND_DISPLAY:-}" ]] && command -v xdg-open >/dev/null 2>&1; then
    echo "Opening $URL"
    xdg-open "$URL" >/dev/null 2>&1 &
else
    echo "Open $URL in a browser to watch the stream."
fi

echo
echo "Watch its output:  tail -f ${LOG_DIR}/camera.log"
echo "Stop it:           ${BASH_SOURCE[0]} stop"
