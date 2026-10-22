#!/usr/bin/env bash
#
# start_rov.sh - start the ROV stack on ONE computer and open the dashboard.
# Works on the Raspberry Pi (the full ROV) AND on an x86 laptop (where there's
# no Servo HAT, thrusters or joystick - those parts simply don't start, and the
# camera + dashboard run on their own). Everything talks over localhost:
#
#   stream_server.py  (camera)         -> http://localhost:8000/video
#   rov_server.py     (thrusters)      <- UDP :5005 from pilot
#                                       -> UDP :5006 telemetry to dashboard
#   pilot.py          (joystick)       -> UDP :5005 to rov_server (localhost)
#   dashboard.py      (web dashboard)  -> http://localhost:8080/
#
# It kills any previous copies first, then starts fresh ones in the background,
# skipping anything that can't start, then opens the dashboard page.
#
# Usage (from anywhere; the shared venv is used automatically):
#   ./start_rov.sh              # start everything that can run + open dashboard
#   ./start_rov.sh stop         # just stop the running ROV programs
#   CAMERA_ONLY=1 ./start_rov.sh  # start only the camera + dashboard
#
# On a laptop, the thruster server and pilot will try to start but fail without
# the Servo HAT / a joystick; that's expected - the script reports it and keeps
# going. Set NO_THRUSTERS=1 to not even try them.
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

# Toggles (default off). CAMERA_ONLY=1 runs just camera + dashboard;
# NO_THRUSTERS=1 skips the thruster server and pilot (useful on a laptop).
CAMERA_ONLY="${CAMERA_ONLY:-0}"
NO_THRUSTERS="${NO_THRUSTERS:-0}"

# ---------------------------------------------------------------------------
# Kill any previous copies of our programs (match on the script path).
# ---------------------------------------------------------------------------
stop_all() {
    echo "Stopping any running ROV programs..."
    for target in "$CAMERA" "$ROV_SERVER" "$PILOT" "$DASHBOARD"; do
        if pkill -f "$target" 2>/dev/null; then
            echo "  stopped $(basename "$(dirname "$target")")/$(basename "$target")"
        fi
    done
    sleep 1   # let them release the camera device and UDP ports
}

# Start one program in the background, logging to its own file. Returns 0 if it
# launched and was still alive a moment later, 1 otherwise - so a missing file
# or an immediate crash (e.g. no Servo HAT on a laptop) is reported, not fatal.
# $1 = human name, $2 = script path, rest = arguments.
start_bg() {
    local name="$1" script="$2"; shift 2
    if [[ ! -f "$script" ]]; then
        echo "  skip $name: $script not found"
        return 1
    fi
    echo "  starting $name ..."
    setsid "$PY" "$script" "$@" >"${LOG_DIR}/${name}.log" 2>&1 &
    local pid=$!
    # Give it a moment; if it died immediately, say so but don't stop the script.
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
        echo "    pid $pid (log: ${LOG_DIR}/${name}.log)"
        return 0
    else
        echo "    $name exited right away (see ${LOG_DIR}/${name}.log) - skipping."
        return 1
    fi
}

# Open a URL in the default browser, if we have a display.
open_browser() {
    local url="$1"
    if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
        echo "No display detected; open $url in a browser yourself."
        return
    fi
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url" >/dev/null 2>&1 &
    elif command -v google-chrome >/dev/null 2>&1; then
        google-chrome "$url" >/dev/null 2>&1 &
    elif command -v chromium-browser >/dev/null 2>&1; then
        chromium-browser "$url" >/dev/null 2>&1 &
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
start_bg camera "$CAMERA" || true
sleep 3   # give the camera time to open the device and serve on :8000

# 2. Thruster server + pilot: only on the real ROV. On a laptop these have no
#    Servo HAT / joystick, so skip them if asked; otherwise try, and the
#    start_bg check above will just report and move on if they can't run.
if [[ "$CAMERA_ONLY" == "1" || "$NO_THRUSTERS" == "1" ]]; then
    echo "  (skipping the thruster server and pilot)"
else
    start_bg rov_server "$ROV_SERVER" --telemetry-host 127.0.0.1 || true
fi

# 3. Dashboard: listens for telemetry (if any) and serves the page. It works
#    with or without the thruster server - it just shows no telemetry then.
start_bg dashboard "$DASHBOARD" || true

# 4. Pilot: reads the joystick plugged into THIS computer. Skipped on a laptop
#    / camera-only run; on the Pi it sends commands to the local rov_server.
if [[ "$CAMERA_ONLY" == "1" || "$NO_THRUSTERS" == "1" ]]; then
    :
else
    start_bg pilot "$PILOT" 127.0.0.1 || true
fi

# Give the dashboard's web server a moment to come up before opening it.
sleep 2
echo "Opening the dashboard at $DASHBOARD_URL"
open_browser "$DASHBOARD_URL"

echo
echo "All started (anything that couldn't run was skipped above)."
echo "Watch a program's output:  tail -f ${LOG_DIR}/<name>.log"
echo "Stop everything:           ${BASH_SOURCE[0]} stop"
