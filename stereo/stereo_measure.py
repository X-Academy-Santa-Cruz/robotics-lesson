#!/usr/bin/env python3
"""
stereo_measure.py - Measure distance and size with two USB webcams

Runs on a Mac (Apple silicon or Intel) or a Raspberry Pi 5. Any two matching
UVC webcams work; the lesson uses two Logitech C920/C922.

Three modes:
  list       - show which camera indexes exist and what resolution they give
  calibrate  - capture checkerboard pairs, run stereo calibration, save stereo_calib.npz
  measure    - live stereo view: click one point for distance, two points for size

Usage:
  python3 stereo_measure.py list
  python3 stereo_measure.py calibrate              # left = 0, right = 1
  python3 stereo_measure.py measure --left 1 --right 2   # override if needed

Setup on a Mac:
  python3 -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  The first run asks for camera permission for Terminal (or PyCharm). Allow it in
  System Settings -> Privacy & Security -> Camera, then run again.
  Defaults are left = 0, right = 1. On a Mac with a built-in camera, index 0 may
  be the FaceTime camera and the webcams 1 and 2; run `list` to check and pass
  --left/--right if so.
  macOS does not let OpenCV lock a webcam's focus. Lock it once with Logitech's
  app (G HUB / Logi Tune) or `brew install uvc-util` then
  `uvc-util -I 1 -s auto-focus=0 -s focus-abs=0`, and leave it alone afterwards.

Setup on the Raspberry Pi 5 (Pi OS Bookworm):
  sudo apt install -y python3-opencv python3-numpy v4l-utils
  v4l2-ctl --list-devices            # indexes are the N in /dev/videoN
  Plug each camera into a different USB port.
  Lock focus if OpenCV can't:
    v4l2-ctl -d /dev/video0 -c focus_automatic_continuous=0 -c focus_absolute=0

Checkerboard: 9x6 INNER corners, 25 mm squares (change CB_* below). Glue it to
something flat. Calibrate in the same medium you will measure in: on the bench
for the bench project, in the water for the ROV.
"""

import argparse
import os
import platform
import sys
import time

# Must be set before cv2 is imported: hides the warning OpenCV prints for every
# camera index that doesn't exist when `list` probes them.
os.environ.setdefault("OPENCV_LOG_LEVEL", "ERROR")
os.environ.setdefault("OPENCV_VIDEOIO_DEBUG", "0")

import cv2  # noqa: E402
import numpy as np  # noqa: E402

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
FRAME_W, FRAME_H = 1280, 720     # 720p keeps stereo matching fast enough on a Pi
CB_COLS, CB_ROWS = 9, 6          # inner corners of the checkerboard
CB_SQUARE_MM = 25.0              # size of one square in millimetres
CALIB_FILE = "stereo_calib.npz"
MIN_PAIRS = 15                   # minimum good checkerboard pairs before calibrating

IS_MAC = platform.system() == "Darwin"
IS_LINUX = platform.system() == "Linux"


# ---------------------------------------------------------------------------
# Camera helpers
# ---------------------------------------------------------------------------
def camera_backend():
    """Pick the OpenCV capture backend that matches the operating system."""
    if IS_MAC:
        return cv2.CAP_AVFOUNDATION
    if IS_LINUX:
        return cv2.CAP_V4L2
    return cv2.CAP_ANY          # Windows and anything else


def open_camera(index):
    """Open a UVC webcam (Logitech C920/C922/C270 and similar).

    MJPEG gives full frame rate over USB. On Linux the focus and exposure are
    locked here; on a Mac, AVFoundation ignores those properties, so lock the
    focus with the vendor app or uvc-util (see the module docstring).
    """
    cap = cv2.VideoCapture(index, camera_backend())
    if not cap.isOpened():
        sys.exit(f"Could not open camera {index}. Run `{sys.argv[0]} list` to see "
                 "which indexes exist" + (" and check camera permission in "
                 "System Settings -> Privacy & Security." if IS_MAC else "."))

    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_W)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_H)
    cap.set(cv2.CAP_PROP_FPS, 30)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)        # low latency

    if IS_LINUX:
        # If the lens refocuses, the focal length changes and the calibration
        # is no longer valid. Fixed-focus cameras ignore these.
        cap.set(cv2.CAP_PROP_AUTOFOCUS, 0)
        cap.set(cv2.CAP_PROP_FOCUS, 0)         # 0 = infinity; raise for close work
        cap.set(cv2.CAP_PROP_AUTO_EXPOSURE, 1) # 1 = manual on V4L2
        cap.set(cv2.CAP_PROP_EXPOSURE, 150)

    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if (actual_w, actual_h) != (FRAME_W, FRAME_H):
        print(f"camera {index}: asked for {FRAME_W}x{FRAME_H}, got {actual_w}x{actual_h}")
    return cap


def grab_pair(cap_l, cap_r):
    """Grab both frames as close together in time as possible."""
    cap_l.grab()
    cap_r.grab()
    ok_l, frame_l = cap_l.retrieve()
    ok_r, frame_r = cap_r.retrieve()
    if not (ok_l and ok_r):
        return None, None
    # Both frames must be the same size for hstack and for stereo matching
    if frame_l.shape != frame_r.shape:
        frame_r = cv2.resize(frame_r, (frame_l.shape[1], frame_l.shape[0]))
    return frame_l, frame_r


def list_cameras(max_index=6):
    """Try each index and report which ones open. Mac: 0 is usually the built-in camera."""
    print(f"Backend: {'AVFoundation' if IS_MAC else 'V4L2' if IS_LINUX else 'default'}")
    found = 0
    for i in range(max_index):
        cap = cv2.VideoCapture(i, camera_backend())
        if cap.isOpened():
            ok, frame = cap.read()
            if ok:
                h, w = frame.shape[:2]
                note = "  (built-in camera on most Macs)" if IS_MAC and i == 0 else ""
                print(f"  index {i}: {w}x{h}{note}")
                found += 1
            cap.release()
    if found == 0:
        print("  no cameras found" + (" - check camera permission for Terminal/PyCharm"
                                       if IS_MAC else ""))
    elif IS_LINUX:
        print("On Linux each camera usually takes two indexes (video and metadata); "
              "use the ones that printed a size. `v4l2-ctl --list-devices` shows which is which.")


# ---------------------------------------------------------------------------
# Mode: calibrate
# ---------------------------------------------------------------------------
def calibrate(left_idx, right_idx):
    cap_l, cap_r = open_camera(left_idx), open_camera(right_idx)

    # 3D coordinates of the checkerboard corners (z = 0 plane), in millimetres
    objp = np.zeros((CB_ROWS * CB_COLS, 3), np.float32)
    objp[:, :2] = np.mgrid[0:CB_COLS, 0:CB_ROWS].T.reshape(-1, 2) * CB_SQUARE_MM

    obj_points, img_points_l, img_points_r = [], [], []
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.001)
    flags = cv2.CALIB_CB_ADAPTIVE_THRESH | cv2.CALIB_CB_NORMALIZE_IMAGE

    print("Hold the checkerboard so BOTH cameras see it.")
    print("Press SPACE to capture a pair, C to calibrate, Q to quit.")
    cv2.namedWindow("calibrate  (L | R)")

    gray_l = None
    while True:
        frame_l, frame_r = grab_pair(cap_l, cap_r)
        if frame_l is None:
            continue
        gray_l = cv2.cvtColor(frame_l, cv2.COLOR_BGR2GRAY)
        gray_r = cv2.cvtColor(frame_r, cv2.COLOR_BGR2GRAY)

        found_l, corners_l = cv2.findChessboardCorners(gray_l, (CB_COLS, CB_ROWS), flags)
        found_r, corners_r = cv2.findChessboardCorners(gray_r, (CB_COLS, CB_ROWS), flags)

        show_l, show_r = frame_l.copy(), frame_r.copy()
        if found_l:
            cv2.drawChessboardCorners(show_l, (CB_COLS, CB_ROWS), corners_l, found_l)
        if found_r:
            cv2.drawChessboardCorners(show_r, (CB_COLS, CB_ROWS), corners_r, found_r)

        both = np.hstack((show_l, show_r))
        both = cv2.resize(both, None, fx=0.5, fy=0.5)
        cv2.putText(both, f"pairs: {len(obj_points)}  (need {MIN_PAIRS})", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        cv2.imshow("calibrate  (L | R)", both)

        key = cv2.waitKey(1) & 0xFF
        if key == ord(" ") and found_l and found_r:
            corners_l = cv2.cornerSubPix(gray_l, corners_l, (11, 11), (-1, -1), criteria)
            corners_r = cv2.cornerSubPix(gray_r, corners_r, (11, 11), (-1, -1), criteria)
            obj_points.append(objp)
            img_points_l.append(corners_l)
            img_points_r.append(corners_r)
            print(f"captured pair {len(obj_points)}")
            time.sleep(0.3)
        elif key in (ord("c"), ord("C")) and len(obj_points) >= MIN_PAIRS:
            break
        elif key in (ord("q"), ord("Q"), 27):          # 27 = Esc
            cap_l.release(); cap_r.release(); cv2.destroyAllWindows()
            return

    cap_l.release(); cap_r.release(); cv2.destroyAllWindows()
    img_size = (gray_l.shape[1], gray_l.shape[0])

    print("Calibrating each camera...")
    rms_l, K_l, D_l, _, _ = cv2.calibrateCamera(obj_points, img_points_l, img_size, None, None)
    rms_r, K_r, D_r, _, _ = cv2.calibrateCamera(obj_points, img_points_r, img_size, None, None)
    print(f"  left RMS error:  {rms_l:.3f} px")
    print(f"  right RMS error: {rms_r:.3f} px")

    print("Stereo calibrating...")
    rms_s, K_l, D_l, K_r, D_r, R, T, E, F = cv2.stereoCalibrate(
        obj_points, img_points_l, img_points_r, K_l, D_l, K_r, D_r, img_size,
        criteria=criteria, flags=cv2.CALIB_FIX_INTRINSIC)
    print(f"  stereo RMS error: {rms_s:.3f} px   (under 1.0 is good)")
    print(f"  baseline: {np.linalg.norm(T):.1f} mm   (compare with your tape measure)")
    print(f"  focal length: {K_l[0, 0]:.1f} px")

    R1, R2, P1, P2, Q, _, _ = cv2.stereoRectify(K_l, D_l, K_r, D_r, img_size, R, T, alpha=0)

    np.savez(CALIB_FILE, K_l=K_l, D_l=D_l, K_r=K_r, D_r=D_r, R=R, T=T,
             R1=R1, R2=R2, P1=P1, P2=P2, Q=Q, img_size=img_size)
    print(f"Saved {CALIB_FILE}")


# ---------------------------------------------------------------------------
# Mode: measure
# ---------------------------------------------------------------------------
class Measurer:
    """Holds click state for the measure window."""

    def __init__(self):
        self.points = []     # clicked (x, y) in rectified left-image pixels
        self.points_3d = []  # matching (X, Y, Z) in millimetres

    def clear(self):
        self.points, self.points_3d = [], []

    def on_mouse(self, event, x, y, flags, param):
        # Display is drawn at half size, so convert back to full-frame pixels
        x, y = x * 2, y * 2
        if event == cv2.EVENT_LBUTTONDOWN:
            if x >= FRAME_W:              # click landed on the disparity panel
                return
            if len(self.points) >= 2:
                self.clear()
            self.points.append((x, y))
        elif event == cv2.EVENT_RBUTTONDOWN:   # right-click, or ctrl-click on a Mac trackpad
            self.clear()


def measure(left_idx, right_idx):
    try:
        calib = np.load(CALIB_FILE)
    except FileNotFoundError:
        sys.exit(f"{CALIB_FILE} not found - run calibrate mode first")

    img_size = tuple(int(v) for v in calib["img_size"])
    map_lx, map_ly = cv2.initUndistortRectifyMap(
        calib["K_l"], calib["D_l"], calib["R1"], calib["P1"], img_size, cv2.CV_16SC2)
    map_rx, map_ry = cv2.initUndistortRectifyMap(
        calib["K_r"], calib["D_r"], calib["R2"], calib["P2"], img_size, cv2.CV_16SC2)
    Q = calib["Q"]

    # Semi-global block matching. numDisparities: bigger sees closer objects but
    # costs more CPU. Must be a multiple of 16.
    block = 7
    stereo = cv2.StereoSGBM_create(
        minDisparity=0, numDisparities=128, blockSize=block,
        P1=8 * 3 * block ** 2, P2=32 * 3 * block ** 2,
        disp12MaxDiff=1, uniquenessRatio=10, speckleWindowSize=100, speckleRange=2,
        mode=cv2.STEREO_SGBM_MODE_SGBM_3WAY)

    cap_l, cap_r = open_camera(left_idx), open_camera(right_idx)
    meas = Measurer()
    cv2.namedWindow("measure")
    cv2.setMouseCallback("measure", meas.on_mouse)
    print("Left click: 1 point = distance, 2 points = size.")
    print("Right click (ctrl-click on a Mac) or C: clear.  Q or Esc: quit.")

    while True:
        frame_l, frame_r = grab_pair(cap_l, cap_r)
        if frame_l is None:
            continue
        if (frame_l.shape[1], frame_l.shape[0]) != img_size:
            frame_l = cv2.resize(frame_l, img_size)
            frame_r = cv2.resize(frame_r, img_size)

        rect_l = cv2.remap(frame_l, map_lx, map_ly, cv2.INTER_LINEAR)
        rect_r = cv2.remap(frame_r, map_rx, map_ry, cv2.INTER_LINEAR)

        gray_l = cv2.cvtColor(rect_l, cv2.COLOR_BGR2GRAY)
        gray_r = cv2.cvtColor(rect_r, cv2.COLOR_BGR2GRAY)
        disparity = stereo.compute(gray_l, gray_r).astype(np.float32) / 16.0

        # Convert disparity to XYZ (mm) using the Q matrix from stereoRectify
        xyz = cv2.reprojectImageTo3D(disparity, Q)

        display = rect_l.copy()
        meas.points_3d = []
        for (x, y) in meas.points:
            # Median of a small patch so one bad pixel doesn't ruin the reading
            patch = xyz[max(0, y - 2):y + 3, max(0, x - 2):x + 3].reshape(-1, 3)
            patch_d = disparity[max(0, y - 2):y + 3, max(0, x - 2):x + 3].reshape(-1)
            good = patch[patch_d > 0]
            if len(good) == 0:
                cv2.circle(display, (x, y), 6, (0, 0, 255), 2)
                cv2.putText(display, "no match", (x + 10, y), cv2.FONT_HERSHEY_SIMPLEX,
                            0.6, (0, 0, 255), 2)
                continue
            p = np.median(good, axis=0)
            meas.points_3d.append(p)
            cv2.circle(display, (x, y), 6, (0, 255, 0), 2)
            cv2.putText(display, f"{p[2] / 10:.1f} cm", (x + 10, y),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        if len(meas.points_3d) == 2:
            size_mm = np.linalg.norm(meas.points_3d[0] - meas.points_3d[1])
            cv2.line(display, meas.points[0], meas.points[1], (255, 200, 0), 2)
            cv2.putText(display, f"size: {size_mm / 10:.1f} cm", (10, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 200, 0), 2)

        # Colour disparity map for the side panel
        disp_vis = cv2.normalize(disparity, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        disp_vis = cv2.applyColorMap(disp_vis, cv2.COLORMAP_JET)

        both = np.hstack((display, disp_vis))
        both = cv2.resize(both, None, fx=0.5, fy=0.5)
        cv2.imshow("measure", both)

        key = cv2.waitKey(1) & 0xFF
        if key in (ord("q"), ord("Q"), 27):
            break
        if key in (ord("c"), ord("C")):
            meas.clear()

    cap_l.release(); cap_r.release(); cv2.destroyAllWindows()


# ---------------------------------------------------------------------------
def main():
    default_left, default_right = 0, 1
    ap = argparse.ArgumentParser(description="Stereo measurement with two USB webcams")
    ap.add_argument("mode", choices=["list", "calibrate", "measure"])
    ap.add_argument("--left", type=int, default=default_left,
                    help=f"left camera index (default {default_left})")
    ap.add_argument("--right", type=int, default=default_right,
                    help=f"right camera index (default {default_right})")
    args = ap.parse_args()
    if args.mode == "list":
        list_cameras()
    elif args.mode == "calibrate":
        calibrate(args.left, args.right)
    else:
        measure(args.left, args.right)


if __name__ == "__main__":
    main()
