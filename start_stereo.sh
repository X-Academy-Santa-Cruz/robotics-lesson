#!/usr/bin/env bash
#
# start_stereo.sh - generate the 3D-printable camera-mount models from the
# CadQuery scripts in cad/. Each script writes a .step (for editing in CAD) and
# a .stl (for slicing / printing) next to itself.
#
#   cad/camera-mount.py        ->  cad/c270_mount.step        + .stl   (single camera)
#   cad/c270_stereo_mount.py   ->  cad/c270_stereo_mount.step + .stl   (two cameras)
#
# Usage (from anywhere; the shared venv is used automatically):
#   ./start_stereo.sh            # regenerate both mounts
#   ./start_stereo.sh single     # just the single-camera mount
#   ./start_stereo.sh stereo     # just the stereo (two-camera) mount
#
# Needs CadQuery in the venv (setup_x86.sh installs it). Edit the parameters at
# the top of the cad/*.py files (e.g. CAMERA_SPACING in c270_stereo_mount.py),
# then re-run this to rebuild.

set -u

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PY="${REPO_DIR}/.venv/bin/python3"
CAD_DIR="${REPO_DIR}/cad"

SINGLE="${CAD_DIR}/camera-mount.py"
STEREO="${CAD_DIR}/c270_stereo_mount.py"

# Use the venv's Python if present, otherwise the system one.
if [[ -x "$VENV_PY" ]]; then
    PY="$VENV_PY"
else
    PY="$(command -v python3)"
    echo "Note: ${REPO_DIR}/.venv not found; using system python3 ($PY)."
fi

# Make sure CadQuery is actually available before we try.
if ! "$PY" -c "import cadquery" >/dev/null 2>&1; then
    echo "ERROR: CadQuery isn't installed in the venv." >&2
    echo "Run ./setup_x86.sh first (it installs cadquery), then try again." >&2
    exit 1
fi

# Build one model: $1 = human name, $2 = script path.
generate() {
    local name="$1" script="$2"
    if [[ ! -f "$script" ]]; then
        echo "  skip $name: $script not found"; return
    fi
    echo "Generating the $name mount from $(basename "$script") ..."
    # CadQuery scripts export relative to their own folder, so run from cad/.
    ( cd "$CAD_DIR" && "$PY" "$script" )
}

case "${1:-both}" in
    single) generate "single-camera" "$SINGLE" ;;
    stereo) generate "stereo"        "$STEREO" ;;
    both|"")
        generate "single-camera" "$SINGLE"
        echo
        generate "stereo"        "$STEREO"
        ;;
    *)
        echo "Usage: $0 [single|stereo|both]" >&2; exit 2 ;;
esac

echo
echo "Done. The .step and .stl files are in: $CAD_DIR"
ls -1 "$CAD_DIR"/*.step "$CAD_DIR"/*.stl 2>/dev/null | sed 's#^#  #'
