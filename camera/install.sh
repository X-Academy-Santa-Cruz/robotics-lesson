#!/usr/bin/env bash
#
# install.sh -- install everything the camera lesson programs need.
#
# Run it on the Raspberry Pi (or any Ubuntu machine) from the camera folder:
#
#     bash install.sh
#
# It updates the package lists, then installs pip3 and the Python modules the
# two camera programs use: OpenCV (both), Flask (camera_simple.py), and
# click (stream_server.py).

set -e   # stop immediately if any command fails

echo ">>> Updating package lists..."
sudo apt-get update

echo ">>> Installing pip3 and the camera Python modules..."
sudo apt-get install -y \
    python3-pip \
    python3-opencv \
    python3-flask \
    python3-click

echo
echo ">>> Done. Installed:"
echo "      python3-pip     (pip3 -- Python's package installer)"
echo "      python3-opencv  (OpenCV -- reads the camera, makes JPEGs)"
echo "      python3-flask   (Flask -- web server for camera_simple.py)"
echo "      python3-click   (click -- command-line options for stream_server.py)"
echo
echo "Now run a camera program, for example:"
echo "      python3 camera_simple.py"
