"""
Stereo (two-camera) C270 mount — X Academy / Santa Cruz COE MATE ROV program

Two camera stations on one base plate, lenses CAMERA_SPACING apart.  All of the
camera geometry, and every dimension, comes from c270_mount.py — this file only
decides where the stations go and how big the shared base has to be.  Change a
camera dimension there and both versions follow.

The lens pair is centred on the part (not the camera bodies), because the lens
is 16.5 mm off the centreline of its own body.  Centring the bodies instead
would leave the optical axes lopsided about the mounting point, which is the
thing that actually wants to sit on the vehicle centreline.

Run:  python3 c270_stereo_mount.py
"""

import importlib.util
import os

import cadquery as cq

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("c270", os.path.join(HERE, "c270_mount.py"))
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)

# ------------------------------------------------------------------ parameters
CAMERA_SPACING = 100.0   # lens-to-lens (the stereo baseline)
BOLT_YS = [0.0]          # 1/4-20 holes, Y positions. [0.0] = one on the optical
                         # centreline.  For two, use the station offsets printed
                         # below, which puts a hole under each camera.

# ------------------------------------------------------------------ layout
# A station's lens sits at (station dy + M.lens_y), so to land the lenses at
# +/- CAMERA_SPACING/2 the bodies are offset by that much less the lens offset.
lens_ys = [-CAMERA_SPACING / 2, +CAMERA_SPACING / 2]
station_dys = [ly - M.lens_y for ly in lens_ys]

half_body = (M.HEAD_W + M.CLR + 2 * M.WALL) / 2
y_min = min(station_dys) - half_body - M.BASE_MARGIN
y_max = max(station_dys) + half_body + M.BASE_MARGIN
base_w = y_max - y_min
base_y = (y_max + y_min) / 2     # base centre; not 0, since the lenses are centred

base = (
    cq.Workplane("XY")
    .center(0, base_y)
    .box(M.base_l, base_w, M.BASE_T, centered=(True, True, False))
)

# ------------------------------------------------------------------ assemble
mount = base
cuts = None
for dy in station_dys:
    add, cut = M.camera_station(dy, with_bolt=False)
    mount = mount.union(add)
    cuts = cut if cuts is None else cuts.union(cut)
for by in BOLT_YS:
    cuts = cuts.union(M.bolt_cut(by))
mount = mount.cut(cuts)

if M.FILLET > 0:
    try:
        mount = mount.edges("|Z").fillet(M.FILLET)
    except Exception:
        pass

# ------------------------------------------------------------------ export
if __name__ == "__main__":
    cq.exporters.export(mount, os.path.join(HERE, "c270_stereo_mount.step"))
    cq.exporters.export(mount, os.path.join(HERE, "c270_stereo_mount.stl"),
                        tolerance=0.02, angularTolerance=0.1)

    bb = mount.val().BoundingBox()
    print(f"Overall size: {bb.xlen:.1f} x {bb.ylen:.1f} x {bb.zlen:.1f} mm (L x W x H)")
    print(f"Stereo baseline: {CAMERA_SPACING} mm lens to lens")
    print(f"Lens centres at Y={lens_ys[0]:+.1f} and {lens_ys[1]:+.1f} (centred on the part)")
    print(f"Camera stations at Y={station_dys[0]:+.1f} and {station_dys[1]:+.1f}")
    print(f"Base plate {M.base_l:.1f} x {base_w:.1f}, centred at Y={base_y:+.1f}")
    print(f"Gap between the two bodies: {CAMERA_SPACING - 2 * half_body:.1f} mm")
    print(f"Mounting holes at Y={BOLT_YS}")
    print(f"Volume {mount.val().Volume()/1000:.1f} cm^3  (single mount is "
          f"{M.mount.val().Volume()/1000:.1f} cm^3)")
    print(f"Approx mass in resin @1.1 g/cm^3: {mount.val().Volume()/1000*1.1:.0f} g")

    # ---- checks
    ok = True
    if CAMERA_SPACING < 2 * half_body:
        print("  !! stations overlap — increase CAMERA_SPACING"); ok = False
    for by in BOLT_YS:
        # a blind hole needs seat material above the base, so it must fall
        # within a station's body
        if not any(abs(by - dy) <= half_body - M.BOLT_HOLE_D / 2 for dy in station_dys):
            print(f"  !! bolt hole at Y={by:+.1f} is not under a camera body — "
                  f"it would break through the base"); ok = False
    print("Checks passed" if ok else "CHECKS FAILED — see above")
