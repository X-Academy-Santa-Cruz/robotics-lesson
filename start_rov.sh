#!/usr/bin/env bash
#
# start_rov.sh - start the whole ROV stack on ONE computer (the Pi) and open
# the dashboard in a browser. Everything talks over localhost:
#
#   stream_server.py  (camera)         -> http://localhost:8000/video
#   rov_server.py     (thrusters)      <- UDP :5005 from pilot
#                                       -> UDP :5006 telemetry to dashboard
#   pilot.py          (joystick)       -> UDP :5005 to rov_server (localhost)
#   dashboard.py      (web dashboard)  -> http://localhost:8080/
#
# It kills any previous copies of these programs first, then starts fresh ones
# in the background, then opens the dashboard page in the default browser.
#
# Usage (from anywhere; the shared venv is used automatically):
#   ./start_rov.sh          # start everything + open the dashboard
#   ./start_rov.sh stop     # just kill the running ROV programs
#
# Logs for each program go in ~/robotics-lesson/logs/.

set -u

# --- where things live -----------------------------------------------------
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PY="${REPO_DIR}/.venv/bin/python3"
LOG_DIR="${REPO_DIR}/logs"

# Use the shared venv's Python if it exists, otherwise fall back to python3.
if [[ -x "$VENV_PY" ]]; then
    PY="$VENV_PY"
else
    PY="$(command -v python3)"
    echo "Note: ${REPO_DIR}/.venv not found; using system python3 ($PY)."
fi

# Each program, by the script path we start it with. The path is also the
# unique string we match on to find and kill old copies.
CAMERA="${REPO_DIR}/camera/stream_server.py"
ROV_SERVER="${REPO_DIR}/control/rov_server.py"
PILOT="${REPO_DIR}/control/pilot.py"
DASHBOARD="${REPO_DIR}/dashboard/dashboard.py"

DASHBOARD_URL="http://localhost:8080/"

# ---------------------------------------------------------------------------
# Kill any previous copies of our four programs (match on the script path).
# ---------------------------------------------------------------------------
stop_all() {
    echo "Stopping any running ROV programs..."
    for target in "$CAMERA" "$ROV_SERVER" "$PILOT" "$DASHBOARD"; do
        # pkill -f matches the full command line; -x isn't used so the venv
        # python prefix doesn't matter.
        if pkill -f "$target" 2>/dev/null; then
            echo "  stopped $(basename "$(dirname "$target")")/$(basename "$target")"
        fi
    done
    # Give them a moment to release the camera device and UDP ports.
    sleep 1
}

# Start one program in the background, logging to its own file.
# $1 = human name, $2 = script path, rest = arguments.
start_bg() {
    local name="$1" script="$2"; shift 2
    echo "  starting $name ..."
    # setsid detaches it so it keeps running after this script exits.
    setsid "$PY" "$script" "$@" >"${LOG_DIR}/${name}.log" 2>&1 &
    echo "    pid $! (log: ${LOG_DIR}/${name}.log)"
}

# Open a URL in the Pi's default browser, if we have a display.
open_browser() {
    local url="$1"
    if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
        echo "No display detected; open $url in a browser yourself."
        return
    fi
    # xdg-open is the standard "open in the default app" command on Linux.
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url" >/dev/null 2>&1 &
    elif command -v chromium-browser >/dev/null 2>&1; then
        chromium-browser "$url" >/dev/null 2>&1 &
    elif command -v google-chrome >/dev/null 2>&1; then
        google-chrome "$url" >/dev/null 2>&1 &
    else
        echo "Couldn't find a browser to open; go to $url yourself."
    fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

# "stop" just tears everything down and exits.
if [[ "${1:-}" == "stop" ]]; then
    stop_all
    echo "Done."
    exit 0
fi

mkdir -p "$LOG_DIR"

stop_all

echo "Starting the ROV stack (all on localhost)..."

# 1. Camera stream first, so the dashboard's video has something to show.
start_bg camera "$CAMERA"

# Give the camera a moment to open the device and start serving on :8000
# before anything tries to display its stream.
sleep 3

# 2. Thruster server: listens for pilot commands, streams telemetry to the
#    dashboard. Both stay on this machine, so localhost.
start_bg rov_server "$ROV_SERVER" --telemetry-host 127.0.0.1

# 3. Dashboard: it listens for telemetry and serves the page. The page builds
#    the camera URL from whatever host the browser used to reach the dashboard
#    (same Pi), so no --camera-url is needed here.
start_bg dashboard "$DASHBOARD"

# 4. Pilot: reads the joystick/controller plugged into THIS computer and sends
#    commands to the local rov_server. (If your controller is on the surface
#    laptop instead, run pilot.py there and skip it here.)
start_bg pilot "$PILOT" 127.0.0.1

# Give the dashboard's web server a moment to come up before opening it.
sleep 2
echo "Opening the dashboard at $DASHBOARD_URL"
open_browser "$DASHBOARD_URL"

echo
echo "All started. To watch a program's output:  tail -f ${LOG_DIR}/<name>.log"
echo "To stop everything:  ${BASH_SOURCE[0]} stop"
