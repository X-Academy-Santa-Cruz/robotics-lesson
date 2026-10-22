#!/usr/bin/env bash
#
# start_stereo.sh - open the stereo camera web app for CALIBRATING the two
# webcams and MEASURING distance / object size, then open it in a browser.
#
#   stereo/stereo_web.py  ->  http://localhost:8010/
#       Calibrate tab : capture checkerboard pairs, save stereo_calib.npz
#       Measure  tab  : click the left image for distance (1 point) or size (2)
#
# This does NOT generate the CAD camera-mount models. If you need those, run:
#   python3 cad/c270_stereo_mount.py
#
# Usage (from anywhere; the shared venv is used automatically):
#   ./start_stereo.sh                     # cameras 0 and 1, port 8010, opens browser
#   ./start_stereo.sh --left 1 --right 2  # any stereo_web.py option passes through
#   ./start_stereo.sh --port 9000
#   ./start_stereo.sh stop                # stop a running stereo web app
#
# Any option you pass is handed straight to stereo_web.py
# (run 'python3 stereo/stereo_web.py --help' to see them all).
#
# The log goes to ~/robotics-lesson/logs/stereo_web.log.

set -u

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PY="${REPO_DIR}/.venv/bin/python3"
LOG_DIR="${REPO_DIR}/logs"
APP="${REPO_DIR}/stereo/stereo_web.py"

# Default port; kept in sync with stereo_web.py's default. If the user passes
# their own --port, we parse it out below so we open the right URL.
PORT=8010

# Use the venv's Python if present, otherwise the system one.
if [[ -x "$VENV_PY" ]]; then
    PY="$VENV_PY"
else
    PY="$(command -v python3)"
    echo "Note: ${REPO_DIR}/.venv not found; using system python3 ($PY)."
fi

# "stop" just kills a running app and exits.
if [[ "${1:-}" == "stop" ]]; then
    if pkill -f "$APP" 2>/dev/null; then echo "Stopped the stereo web app."
    else echo "No stereo web app was running."; fi
    exit 0
fi

if [[ ! -f "$APP" ]]; then
    echo "ERROR: $APP not found." >&2
    exit 1
fi

# Make sure OpenCV is importable before we try (setup_x86.sh / setup.sh install it).
if ! "$PY" -c "import cv2" >/dev/null 2>&1; then
    echo "ERROR: OpenCV (cv2) isn't available to $PY." >&2
    echo "Run ./setup_x86.sh (laptop) or ./setup.sh (Pi) first, then try again." >&2
    exit 1
fi

# Find --port in the passed-through args so we open the matching URL.
prev=""
for arg in "$@"; do
    if [[ "$prev" == "--port" ]]; then PORT="$arg"; fi
    if [[ "$arg" == --port=* ]]; then PORT="${arg#--port=}"; fi
    prev="$arg"
done
URL="http://localhost:${PORT}/"

mkdir -p "$LOG_DIR"

# Don't stack two servers on the same port: stop any old copy first.
pkill -f "$APP" 2>/dev/null && { echo "Stopped a previous stereo web app."; sleep 1; }

echo "Starting the stereo web app ..."
# setsid detaches it so it keeps running after this script exits. Any args to
# this script (e.g. --left 1 --right 2) pass straight through to stereo_web.py.
setsid "$PY" "$APP" "$@" >"${LOG_DIR}/stereo_web.log" 2>&1 &
PID=$!
echo "  pid $PID (log: ${LOG_DIR}/stereo_web.log)"

# Give it a moment to open the cameras and bind the port. Opening two 720p
# webcams can take a few seconds.
for i in 1 2 3 4 5 6 7 8; do
    sleep 1
    if ! kill -0 "$PID" 2>/dev/null; then
        echo "The app exited while starting up. Last lines of the log:" >&2
        tail -n 15 "${LOG_DIR}/stereo_web.log" >&2
        exit 1
    fi
done

# Open the page if we have a desktop; otherwise just print the URL.
if command -v open >/dev/null 2>&1; then                 # macOS
    echo "Opening $URL"; open "$URL" >/dev/null 2>&1 &
elif [[ -n "${DISPLAY:-}" || -n "${WAYLAND_DISPLAY:-}" ]] && command -v xdg-open >/dev/null 2>&1; then
    echo "Opening $URL"; xdg-open "$URL" >/dev/null 2>&1 &
else
    echo "Open $URL in a browser to calibrate and measure."
fi

echo
echo "Calibrate first (saves stereo_calib.npz), then switch to the Measure tab."
echo "Watch its output:  tail -f ${LOG_DIR}/stereo_web.log"
echo "Stop it:           ${BASH_SOURCE[0]} stop"
