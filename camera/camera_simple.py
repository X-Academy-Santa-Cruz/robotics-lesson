# camera_simple.py
# Streams a USB camera to a web browser so the surface crew can watch.
# Read this file top to bottom: every step is commented.
#
# This is the beginner version. Once it makes sense, look at stream_server.py
# for the sturdier version you would put on a competition ROV.

import cv2                       # OpenCV: talks to the camera, makes JPEGs
from flask import Flask, Response  # Flask: the tiny web server

# Create the web application. __name__ just tells Flask where it lives.
app = Flask(__name__)

# Open the camera. 0 means "the first USB camera" (/dev/video0).
# If your camera is not found, try camera = cv2.VideoCapture(1) instead.
camera = cv2.VideoCapture(0)


def make_frames():
    # This function runs forever, handing out one JPEG image at a time.
    while True:
        # Ask the camera for one picture. 'ok' is True if it worked,
        # 'frame' is the picture itself (a grid of pixels).
        ok, frame = camera.read()
        if not ok:
            break                 # no picture? stop the loop

        # Squeeze the picture into a JPEG (much smaller to send).
        ok, buffer = cv2.imencode(".jpg", frame)
        jpg = buffer.tobytes()    # turn it into raw bytes to send

        # Hand this one JPEG to the browser, wrapped in the little
        # header the browser expects between frames. 'yield' means
        # "send this now, then come back for the next one."
        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n")


@app.route("/")
def home_page():
    # The page you open in a browser. The <img> tag points at /video,
    # so the browser keeps showing each new frame as it arrives.
    return "<html><body><h1>ROV Camera</h1>" \
           "<img src='/video'></body></html>"


@app.route("/video")
def video_feed():
    # This is the never-ending stream of JPEGs from make_frames().
    # The long 'mimetype' is how we tell the browser: "keep replacing
    # the image with each new one I send."
    return Response(make_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame")


# This block runs when you type: python3 camera_simple.py
if __name__ == "__main__":
    # host="0.0.0.0" makes the stream reachable from the surface laptop,
    # not just from the Pi itself. port=8000 is the address you open.
    app.run(host="0.0.0.0", port=8000)
