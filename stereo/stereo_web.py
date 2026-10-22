#!/usr/bin/env python3
"""
stereo_web.py - calibrate two USB webcams and measure distance / object size
from a web browser.

This is the browser version of stereo_measure.py. Instead of OpenCV desktop
windows it serves a web page, so you drive the whole thing - calibration and
measuring - from Chrome/Firefox on the same computer (or another computer on
the network). Open:

    http://localhost:8010/

Two tabs on that page:

  Calibrate - live view of both cameras with the detected checkerboard drawn on.
              Click "Capture pair" each time BOTH cameras see the board; when you
              have enough pairs, click "Calibrate" to compute and save
              stereo_calib.npz.

  Measure   - rectified left image beside a colour depth (disparity) map. Click
              one point on the left image for its distance; click two points for
              the size between them. Needs a saved calibration.

It reads both cameras on a background thread (like camera/stream_server.py) and
streams each view as MJPEG, so the browser just shows <img> tags and posts
clicks back - no plugins, no JavaScript libraries.

Camera settings, the checkerboard geometry and the calibration file name match
stereo_measure.py, so a stereo_calib.npz made by either program works in the
other.

Usage:
    python3 stereo_web.py                      # left = 0, right = 1, port 8010
    python3 stereo_web.py --left 1 --right 2   # override camera indexes
    python3 stereo_web.py --port 9000
    python3 stereo_web.py --list               # just list camera indexes and exit

The CAD camera-mount models are NOT built here any more - generate those with
  python3 cad/c270_stereo_mount.py
if you need them.
"""

import json
import os
import platform
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

import click

# Must be set before cv2 is imported: hides the warning OpenCV prints for every
# camera index that doesn't exist when we probe them.
os.environ.setdefault("OPENCV_LOG_LEVEL", "ERROR")
os.environ.setdefault("OPENCV_VIDEOIO_DEBUG", "0")

import cv2  # noqa: E402
import numpy as np  # noqa: E402

# ---------------------------------------------------------------------------
# Settings  (kept identical to stereo_measure.py so calibrations interchange)
# ---------------------------------------------------------------------------
FRAME_W, FRAME_H = 1280, 720     # 720p keeps stereo matching fast enough on a Pi
CB_COLS, CB_ROWS = 9, 6          # inner corners of the checkerboard
CB_SQUARE_MM = 25.0              # size of one square in millimetres
CALIB_FILE = "stereo_calib.npz"
MIN_PAIRS = 15                   # minimum good checkerboard pairs before calibrating
JPEG_QUALITY = 80                # MJPEG quality for the browser stream

IS_MAC = platform.system() == "Darwin"
IS_LINUX = platform.system() == "Linux"


# ---------------------------------------------------------------------------
# Camera helpers  (same behaviour as stereo_measure.py)
# ---------------------------------------------------------------------------
def camera_backend():
    """Pick the OpenCV capture backend that matches the operating system."""
    if IS_MAC:
        return cv2.CAP_AVFOUNDATION
    if IS_LINUX:
        return cv2.CAP_V4L2
    return cv2.CAP_ANY          # Windows and anything else


def open_camera(index):
    """Open a UVC webcam (Logitech C920/C922/C270 and similar)."""
    cap = cv2.VideoCapture(index, camera_backend())
    if not cap.isOpened():
        raise RuntimeError(
            f"Could not open camera {index}. Start with --list to see which "
            "indexes exist"
            + (", and check camera permission in System Settings -> "
               "Privacy & Security." if IS_MAC else "."))

    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_W)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_H)
    cap.set(cv2.CAP_PROP_FPS, 30)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)        # low latency

    if IS_LINUX:
        # If the lens refocuses, the focal length changes and the calibration
        # is no longer valid. Fixed-focus cameras ignore these.
        cap.set(cv2.CAP_PROP_AUTOFOCUS, 0)
        cap.set(cv2.CAP_PROP_FOCUS, 0)
        cap.set(cv2.CAP_PROP_AUTO_EXPOSURE, 1)
        cap.set(cv2.CAP_PROP_EXPOSURE, 150)

    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if (actual_w, actual_h) != (FRAME_W, FRAME_H):
        print(f"camera {index}: asked for {FRAME_W}x{FRAME_H}, got {actual_w}x{actual_h}")
    return cap


def list_cameras(max_index=6):
    """Try each index and report which ones open."""
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
# StereoRig: owns the two cameras, a capture thread, and all the OpenCV state
# for calibration and measurement. The web handlers only call its methods.
# ---------------------------------------------------------------------------
class StereoRig:
    def __init__(self, left_idx, right_idx):
        self.left_idx = left_idx
        self.right_idx = right_idx
        self.cap_l = open_camera(left_idx)
        self.cap_r = open_camera(right_idx)

        self._lock = threading.Lock()          # guards the latest frames
        self._frame_l = None
        self._frame_r = None
        self._running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

        # Checkerboard object points (z = 0 plane), in millimetres.
        self._objp = np.zeros((CB_ROWS * CB_COLS, 3), np.float32)
        self._objp[:, :2] = np.mgrid[0:CB_COLS, 0:CB_ROWS].T.reshape(-1, 2) * CB_SQUARE_MM
        self._criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.001)
        self._cb_flags = cv2.CALIB_CB_ADAPTIVE_THRESH | cv2.CALIB_CB_NORMALIZE_IMAGE

        # Calibration capture state (guarded by _calib_lock).
        self._calib_lock = threading.Lock()
        self._obj_points = []
        self._img_points_l = []
        self._img_points_r = []
        self._last_status = "Hold the checkerboard so both cameras see it."

        # Rectification maps + Q, loaded from CALIB_FILE for measuring.
        self._rect_lock = threading.Lock()
        self._maps = None          # (map_lx, map_ly, map_rx, map_ry, Q, img_size)
        self._stereo = cv2.StereoSGBM_create(
            minDisparity=0, numDisparities=128, blockSize=7,
            P1=8 * 3 * 7 ** 2, P2=32 * 3 * 7 ** 2,
            disp12MaxDiff=1, uniquenessRatio=10, speckleWindowSize=100, speckleRange=2,
            mode=cv2.STEREO_SGBM_MODE_SGBM_3WAY)
        self._load_calibration()   # ok if it isn't there yet

        # Measure click state, in full-frame rectified-left pixels.
        self._points = []          # up to 2 (x, y)

    # --- capture thread ----------------------------------------------------
    def _capture_loop(self):
        while self._running:
            self.cap_l.grab()
            self.cap_r.grab()
            ok_l, fl = self.cap_l.retrieve()
            ok_r, fr = self.cap_r.retrieve()
            if not (ok_l and ok_r):
                time.sleep(0.02)
                continue
            if fl.shape != fr.shape:
                fr = cv2.resize(fr, (fl.shape[1], fl.shape[0]))
            with self._lock:
                self._frame_l, self._frame_r = fl, fr

    def _latest(self):
        """Return copies of the newest left/right frames, waiting for the first."""
        deadline = time.monotonic() + 3.0
        while time.monotonic() < deadline:
            with self._lock:
                if self._frame_l is not None and self._frame_r is not None:
                    return self._frame_l.copy(), self._frame_r.copy()
            time.sleep(0.03)
        raise TimeoutError("No frames from the cameras yet")

    def close(self):
        self._running = False
        self._thread.join(timeout=2.0)
        self.cap_l.release()
        self.cap_r.release()

    # --- calibrate ---------------------------------------------------------
    def calib_annotated_pair(self):
        """Live side-by-side (L | R) with any detected checkerboard drawn on.

        Returns (jpeg_bytes, found_both). found_both lets the page enable the
        Capture button only when both cameras see the board.
        """
        fl, fr = self._latest()
        gray_l = cv2.cvtColor(fl, cv2.COLOR_BGR2GRAY)
        gray_r = cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY)
        found_l, corners_l = cv2.findChessboardCorners(gray_l, (CB_COLS, CB_ROWS), self._cb_flags)
        found_r, corners_r = cv2.findChessboardCorners(gray_r, (CB_COLS, CB_ROWS), self._cb_flags)

        show_l, show_r = fl.copy(), fr.copy()
        if found_l:
            cv2.drawChessboardCorners(show_l, (CB_COLS, CB_ROWS), corners_l, found_l)
        if found_r:
            cv2.drawChessboardCorners(show_r, (CB_COLS, CB_ROWS), corners_r, found_r)
        both = np.hstack((show_l, show_r))
        both = cv2.resize(both, None, fx=0.5, fy=0.5)
        with self._calib_lock:
            n = len(self._obj_points)
        colour = (0, 220, 0) if (found_l and found_r) else (0, 165, 255)
        label = f"pairs {n}/{MIN_PAIRS}   board: {'BOTH' if found_l and found_r else 'left ' + str(found_l) + ' right ' + str(found_r)}"
        cv2.putText(both, label, (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.7, colour, 2)
        return self._encode(both), bool(found_l and found_r)

    def capture_pair(self):
        """Grab the current frames; if both show the board, keep the corners."""
        fl, fr = self._latest()
        gray_l = cv2.cvtColor(fl, cv2.COLOR_BGR2GRAY)
        gray_r = cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY)
        found_l, corners_l = cv2.findChessboardCorners(gray_l, (CB_COLS, CB_ROWS), self._cb_flags)
        found_r, corners_r = cv2.findChessboardCorners(gray_r, (CB_COLS, CB_ROWS), self._cb_flags)
        if not (found_l and found_r):
            with self._calib_lock:
                self._last_status = "Not captured - both cameras must see the whole board."
                return self._calib_state()
        corners_l = cv2.cornerSubPix(gray_l, corners_l, (11, 11), (-1, -1), self._criteria)
        corners_r = cv2.cornerSubPix(gray_r, corners_r, (11, 11), (-1, -1), self._criteria)
        with self._calib_lock:
            self._obj_points.append(self._objp)
            self._img_points_l.append(corners_l)
            self._img_points_r.append(corners_r)
            self._img_size = (gray_l.shape[1], gray_l.shape[0])
            n = len(self._obj_points)
            self._last_status = f"Captured pair {n}."
            return self._calib_state()

    def reset_calibration_capture(self):
        with self._calib_lock:
            self._obj_points.clear()
            self._img_points_l.clear()
            self._img_points_r.clear()
            self._last_status = "Cleared captured pairs."
            return self._calib_state()

    def run_calibration(self):
        """Compute stereo calibration from the captured pairs and save it."""
        with self._calib_lock:
            if len(self._obj_points) < MIN_PAIRS:
                self._last_status = (f"Need at least {MIN_PAIRS} pairs; "
                                     f"have {len(self._obj_points)}.")
                return self._calib_state()
            obj = list(self._obj_points)
            ptl = list(self._img_points_l)
            ptr = list(self._img_points_r)
            img_size = self._img_size

        # Heavy work outside the lock so the stream keeps flowing.
        rms_l, K_l, D_l, _, _ = cv2.calibrateCamera(obj, ptl, img_size, None, None)
        rms_r, K_r, D_r, _, _ = cv2.calibrateCamera(obj, ptr, img_size, None, None)
        rms_s, K_l, D_l, K_r, D_r, R, T, E, F = cv2.stereoCalibrate(
            obj, ptl, ptr, K_l, D_l, K_r, D_r, img_size,
            criteria=self._criteria, flags=cv2.CALIB_FIX_INTRINSIC)
        R1, R2, P1, P2, Q, _, _ = cv2.stereoRectify(
            K_l, D_l, K_r, D_r, img_size, R, T, alpha=0)
        np.savez(CALIB_FILE, K_l=K_l, D_l=D_l, K_r=K_r, D_r=D_r, R=R, T=T,
                 R1=R1, R2=R2, P1=P1, P2=P2, Q=Q, img_size=img_size)
        self._load_calibration()
        baseline = float(np.linalg.norm(T))
        with self._calib_lock:
            self._last_status = (
                f"Calibrated. stereo RMS {rms_s:.3f} px (under 1.0 is good), "
                f"baseline {baseline:.1f} mm, focal {K_l[0,0]:.0f} px. Saved {CALIB_FILE}.")
            return self._calib_state()

    def _calib_state(self):
        """Dict for the browser (call with _calib_lock held)."""
        return {
            "pairs": len(self._obj_points),
            "need": MIN_PAIRS,
            "ready": len(self._obj_points) >= MIN_PAIRS,
            "status": self._last_status,
            "calibrated": self._maps is not None,
        }

    def calib_state(self):
        with self._calib_lock:
            return self._calib_state()

    # --- measure -----------------------------------------------------------
    def _load_calibration(self):
        try:
            calib = np.load(CALIB_FILE)
        except FileNotFoundError:
            with self._rect_lock:
                self._maps = None
            return
        img_size = tuple(int(v) for v in calib["img_size"])
        map_lx, map_ly = cv2.initUndistortRectifyMap(
            calib["K_l"], calib["D_l"], calib["R1"], calib["P1"], img_size, cv2.CV_16SC2)
        map_rx, map_ry = cv2.initUndistortRectifyMap(
            calib["K_r"], calib["D_r"], calib["R2"], calib["P2"], img_size, cv2.CV_16SC2)
        with self._rect_lock:
            self._maps = (map_lx, map_ly, map_rx, map_ry, calib["Q"], img_size)

    def have_calibration(self):
        with self._rect_lock:
            return self._maps is not None

    def add_measure_point(self, x, y):
        """x, y are full-frame rectified-left pixels. Third click clears."""
        if len(self._points) >= 2:
            self._points = []
        self._points.append((int(x), int(y)))

    def clear_measure_points(self):
        self._points = []

    def measure_frame(self):
        """Rectified left (with click overlays) beside the colour disparity map.

        Returns (jpeg_bytes, readout_text).
        """
        with self._rect_lock:
            maps = self._maps
        fl, fr = self._latest()
        if maps is None:
            # No calibration yet: show the plain left image with a notice.
            disp = cv2.resize(fl, None, fx=0.5, fy=0.5)
            cv2.putText(disp, "No calibration - calibrate first", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            return self._encode(disp), "No calibration loaded."

        map_lx, map_ly, map_rx, map_ry, Q, img_size = maps
        if (fl.shape[1], fl.shape[0]) != img_size:
            fl = cv2.resize(fl, img_size)
            fr = cv2.resize(fr, img_size)
        rect_l = cv2.remap(fl, map_lx, map_ly, cv2.INTER_LINEAR)
        rect_r = cv2.remap(fr, map_rx, map_ry, cv2.INTER_LINEAR)

        gray_l = cv2.cvtColor(rect_l, cv2.COLOR_BGR2GRAY)
        gray_r = cv2.cvtColor(rect_r, cv2.COLOR_BGR2GRAY)
        disparity = self._stereo.compute(gray_l, gray_r).astype(np.float32) / 16.0
        xyz = cv2.reprojectImageTo3D(disparity, Q)

        display = rect_l.copy()
        pts_3d = []
        readout = "Click one point for distance, two for size."
        for (x, y) in self._points:
            patch = xyz[max(0, y - 2):y + 3, max(0, x - 2):x + 3].reshape(-1, 3)
            patch_d = disparity[max(0, y - 2):y + 3, max(0, x - 2):x + 3].reshape(-1)
            good = patch[patch_d > 0]
            if len(good) == 0:
                cv2.circle(display, (x, y), 6, (0, 0, 255), 2)
                cv2.putText(display, "no match", (x + 10, y),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                continue
            p = np.median(good, axis=0)
            pts_3d.append(p)
            cv2.circle(display, (x, y), 6, (0, 255, 0), 2)
            cv2.putText(display, f"{p[2] / 10:.1f} cm", (x + 10, y),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        if len(pts_3d) == 1:
            readout = f"Distance: {pts_3d[0][2] / 10:.1f} cm"
        elif len(pts_3d) == 2:
            size_mm = float(np.linalg.norm(pts_3d[0] - pts_3d[1]))
            cv2.line(display, self._points[0], self._points[1], (255, 200, 0), 2)
            cv2.putText(display, f"size: {size_mm / 10:.1f} cm", (10, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 200, 0), 2)
            readout = (f"Size: {size_mm / 10:.1f} cm   "
                       f"(depths {pts_3d[0][2] / 10:.1f} / {pts_3d[1][2] / 10:.1f} cm)")

        disp_vis = cv2.normalize(disparity, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        disp_vis = cv2.applyColorMap(disp_vis, cv2.COLORMAP_JET)
        both = np.hstack((display, disp_vis))
        both = cv2.resize(both, None, fx=0.5, fy=0.5)
        # The left half of the half-size image is the clickable area; the page
        # scales clicks back up by 2 and ignores clicks on the right half.
        return self._encode(both), readout

    # --- shared ------------------------------------------------------------
    @staticmethod
    def _encode(bgr):
        ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        if not ok:
            raise RuntimeError("JPEG encode failed")
        return buf.tobytes()


# ---------------------------------------------------------------------------
# Web page
# ---------------------------------------------------------------------------
PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>Stereo Measure</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0; background:#111; color:#eee; }
  header { padding: 10px 16px; background:#1b2a3a; }
  h1 { font-size: 18px; margin: 0; }
  .tabs { display:flex; gap:8px; padding:10px 16px; }
  .tabs button { font-size:15px; padding:8px 16px; border:0; border-radius:6px;
                 background:#2a3b4d; color:#cfe8ef; cursor:pointer; }
  .tabs button.active { background:#2bb3a3; color:#06231f; font-weight:600; }
  .panel { display:none; padding:0 16px 20px; }
  .panel.active { display:block; }
  img#view { max-width:100%; height:auto; border:1px solid #333; border-radius:6px;
             display:block; }
  .controls { margin:12px 0; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .controls button { font-size:15px; padding:8px 14px; border:0; border-radius:6px;
                     background:#2a3b4d; color:#cfe8ef; cursor:pointer; }
  .controls button:disabled { opacity:0.4; cursor:default; }
  .controls button.primary { background:#2bb3a3; color:#06231f; font-weight:600; }
  .status { margin:8px 0; min-height:1.4em; color:#9fdccb; }
  .hint { color:#8aa; font-size:13px; max-width:60ch; line-height:1.5; }
</style></head>
<body>
<header><h1>Stereo Measure &mdash; calibrate &amp; measure with two webcams</h1></header>
<div class="tabs">
  <button id="tab-cal" class="active" onclick="show('cal')">Calibrate</button>
  <button id="tab-mea" onclick="show('mea')">Measure</button>
</div>

<div id="panel-cal" class="panel active">
  <p class="hint">Hold a 9&times;6 (inner-corner) checkerboard so <b>both</b> cameras
     see the whole board, at different angles and distances. Click
     <b>Capture pair</b> for each pose. When you have 15+ pairs, click
     <b>Calibrate</b>. The result is saved as stereo_calib.npz.</p>
  <img id="view" alt="calibration view">
  <div class="controls">
    <button id="cap" class="primary" onclick="capture()">Capture pair</button>
    <button onclick="calibrate()" id="docal">Calibrate</button>
    <button onclick="resetcal()">Clear pairs</button>
    <span id="count" class="status"></span>
  </div>
  <div id="calstatus" class="status"></div>
</div>

<div id="panel-mea" class="panel">
  <p class="hint">Click one point on the <b>left image</b> for its distance; click a
     second point for the size between the two. A third click starts over. The
     right half is the depth map (not clickable).</p>
  <img id="view2" alt="measure view" onclick="clickMeasure(event)">
  <div class="controls">
    <button onclick="clearMeasure()">Clear points</button>
    <span id="readout" class="status"></span>
  </div>
</div>

<script>
let tab = 'cal';
function show(t){
  tab = t;
  document.getElementById('tab-cal').classList.toggle('active', t==='cal');
  document.getElementById('tab-mea').classList.toggle('active', t==='mea');
  document.getElementById('panel-cal').classList.toggle('active', t==='cal');
  document.getElementById('panel-mea').classList.toggle('active', t==='mea');
}
// Calibrate tab: refresh the annotated frame and the pair count a few times a second.
async function tickCal(){
  if (tab==='cal'){
    document.getElementById('view').src = '/calib/frame.jpg?ts=' + Date.now();
    try{
      const s = await (await fetch('/calib/state')).json();
      document.getElementById('count').textContent =
        'pairs ' + s.pairs + ' / ' + s.need;
      document.getElementById('docal').disabled = !s.ready;
      document.getElementById('calstatus').textContent = s.status;
    }catch(e){}
  }
  setTimeout(tickCal, 300);
}
// Measure tab: refresh the measure frame and the readout.
async function tickMea(){
  if (tab==='mea'){
    document.getElementById('view2').src = '/measure/frame.jpg?ts=' + Date.now();
    try{
      const r = await (await fetch('/measure/readout')).text();
      document.getElementById('readout').textContent = r;
    }catch(e){}
  }
  setTimeout(tickMea, 350);
}
async function capture(){
  const s = await (await fetch('/calib/capture', {method:'POST'})).json();
  document.getElementById('calstatus').textContent = s.status;
}
async function calibrate(){
  document.getElementById('calstatus').textContent = 'Calibrating, please wait...';
  const s = await (await fetch('/calib/run', {method:'POST'})).json();
  document.getElementById('calstatus').textContent = s.status;
}
async function resetcal(){
  const s = await (await fetch('/calib/reset', {method:'POST'})).json();
  document.getElementById('calstatus').textContent = s.status;
}
function clickMeasure(ev){
  const img = ev.target;
  // Map the click from displayed pixels to the half-size image's pixels, then
  // the server scales x2 to full-frame. Ignore clicks on the right (depth) half.
  const r = img.getBoundingClientRect();
  const sx = img.naturalWidth / r.width;
  const sy = img.naturalHeight / r.height;
  const ix = (ev.clientX - r.left) * sx;
  const iy = (ev.clientY - r.top) * sy;
  fetch('/measure/click?x=' + Math.round(ix) + '&y=' + Math.round(iy), {method:'POST'});
}
async function clearMeasure(){ await fetch('/measure/clear', {method:'POST'}); }
tickCal(); tickMea();
</script>
</body></html>
"""


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    rig: StereoRig = None

    def log_message(self, *args):
        pass  # keep the console quiet; errors still raise

    def _send(self, code, body, content_type):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        try:
            if path in ("/", "/index.html"):
                self._send(200, PAGE, "text/html; charset=utf-8")
            elif path == "/calib/frame.jpg":
                jpeg, _ = self.rig.calib_annotated_pair()
                self._send(200, jpeg, "image/jpeg")
            elif path == "/calib/state":
                self._send(200, json.dumps(self.rig.calib_state()), "application/json")
            elif path == "/measure/frame.jpg":
                jpeg, _ = self.rig.measure_frame()
                self._send(200, jpeg, "image/jpeg")
            elif path == "/measure/readout":
                _, text = self.rig.measure_frame()
                self._send(200, text, "text/plain; charset=utf-8")
            else:
                self._send(404, "not found", "text/plain")
        except Exception as exc:  # a camera hiccup shouldn't kill the server
            self._send(500, f"error: {exc}", "text/plain")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            if path == "/calib/capture":
                self._send(200, json.dumps(self.rig.capture_pair()), "application/json")
            elif path == "/calib/run":
                self._send(200, json.dumps(self.rig.run_calibration()), "application/json")
            elif path == "/calib/reset":
                self._send(200, json.dumps(self.rig.reset_calibration_capture()),
                           "application/json")
            elif path == "/measure/click":
                q = parse_qs(parsed.query)
                x = int(q.get("x", [0])[0]) * 2   # half-size display -> full frame
                y = int(q.get("y", [0])[0]) * 2
                self.rig.add_measure_point(x, y)
                self._send(200, "ok", "text/plain")
            elif path == "/measure/clear":
                self.rig.clear_measure_points()
                self._send(200, "ok", "text/plain")
            else:
                self._send(404, "not found", "text/plain")
        except Exception as exc:
            self._send(500, f"error: {exc}", "text/plain")


def local_ip():
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


# ---------------------------------------------------------------------------
@click.command(help="Calibrate and measure with two USB webcams, from a browser.")
@click.option("--left", type=int, default=0, show_default=True, help="Left camera index.")
@click.option("--right", type=int, default=1, show_default=True, help="Right camera index.")
@click.option("--port", type=int, default=8010, show_default=True, help="Web server port.")
@click.option("--list", "list_only", is_flag=True,
              help="List camera indexes and exit (don't start the server).")
def main(left, right, port, list_only):
    if list_only:
        list_cameras()
        return

    try:
        rig = StereoRig(left, right)
    except RuntimeError as exc:
        sys.exit(str(exc))

    Handler.rig = rig
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    ip = local_ip()
    print(f"Stereo web app on:")
    print(f"  http://localhost:{port}/")
    print(f"  http://{ip}:{port}/   (from another computer on the network)")
    print("Calibrate tab first (saves stereo_calib.npz), then Measure. Ctrl-C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        server.shutdown()
        rig.close()


if __name__ == "__main__":
    main()
