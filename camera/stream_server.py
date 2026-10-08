"""
Streams video from a USB camera over HTTP as MJPEG.

Run it on the Raspberry Pi, then open http://<pi-ip-address>:8000/ in a
browser on your laptop to watch the live feed.
"""

import argparse
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import cv2

BOUNDARY = "frame"


class Camera:
    """Continuously reads frames from a camera in a background thread.

    cv2.VideoCapture.read() blocks until the next frame is ready, so a
    dedicated thread keeps grabbing frames even while an HTTP client is
    slowly being served the previous one.
    """

    def __init__(self, index: int, width: int, height: int):
        self.capture = cv2.VideoCapture(index)
        self.capture.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self.capture.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        if not self.capture.isOpened():
            raise RuntimeError(
                f"Could not open camera {index}. Check that it's plugged in "
                f"and that /dev/video{index} exists."
            )

        self._lock = threading.Lock()
        self._latest_jpeg = None
        self._running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

    def _capture_loop(self):
        while self._running:
            ok, frame = self.capture.read()
            if not ok:
                time.sleep(0.1)
                continue
            ok, encoded = cv2.imencode(".jpg", frame)
            if not ok:
                continue
            with self._lock:
                self._latest_jpeg = encoded.tobytes()

    def get_jpeg(self, timeout: float = 2.0) -> bytes:
        """Return the most recent frame as JPEG bytes, waiting briefly for
        the first frame to arrive if the camera has just started."""
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            with self._lock:
                if self._latest_jpeg is not None:
                    return self._latest_jpeg
            time.sleep(0.05)
        raise TimeoutError("No frame received from camera")

    def close(self):
        self._running = False
        self._thread.join(timeout=2.0)
        self.capture.release()


class StreamingHandler(BaseHTTPRequestHandler):
    # Set by main() before the server starts handling requests.
    camera: Camera = None

    def log_message(self, fmt, *args):
        pass  # Quiet down the default per-request console logging.

    def do_GET(self):
        if self.path == "/":
            self._serve_index()
        elif self.path == "/stream.mjpg":
            self._serve_stream()
        else:
            self.send_error(404)

    def _serve_index(self):
        body = (
            "<html><head><title>ROV Camera</title></head>"
            "<body style='margin:0;background:#111'>"
            "<img src='/stream.mjpg' style='width:100%;height:auto;display:block'>"
            "</body></html>"
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_stream(self):
        self.send_response(200)
        self.send_header(
            "Content-Type", f"multipart/x-mixed-replace; boundary={BOUNDARY}"
        )
        self.end_headers()
        try:
            while True:
                jpeg = self.camera.get_jpeg()
                self.wfile.write(f"--{BOUNDARY}\r\n".encode())
                self.wfile.write(b"Content-Type: image/jpeg\r\n")
                self.wfile.write(f"Content-Length: {len(jpeg)}\r\n\r\n".encode())
                self.wfile.write(jpeg)
                self.wfile.write(b"\r\n")
                time.sleep(1 / 30)  # cap at ~30 fps
        except (BrokenPipeError, ConnectionResetError):
            pass  # Client closed the browser tab / lost connection.


def local_ip() -> str:
    """Best-effort guess at this machine's LAN IP, for the startup message."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--camera", type=int, default=0, help="camera index (/dev/videoN)")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    args = parser.parse_args()

    camera = Camera(args.camera, args.width, args.height)
    StreamingHandler.camera = camera

    server = ThreadingHTTPServer(("0.0.0.0", args.port), StreamingHandler)
    print(f"Streaming at http://{local_ip()}:{args.port}/  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()
        camera.close()


if __name__ == "__main__":
    main()
