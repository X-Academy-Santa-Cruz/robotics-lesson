"""
Logitech C270 camera mount — parametric CadQuery model
X Academy / Santa Cruz COE MATE ROV program

Coordinate frame:  +X = forward (direction the lens looks)
                   +Y = camera left/right
                   +Z = up (lens axis is parallel to the base, i.e. the XY plane)

How the camera sits:
  * The C270's folding clip is folded flat under the camera head.
  * The folded clip (the "foot") slides into a rectangular slot from the REAR
    of the mount. The slot roof keeps the camera from lifting out.
  * The camera head rests on a flat platform in front of the slot; two side
    arms stop it rolling, and a front lip with a U-notch for the lens stops it
    sliding forward. Because the platform is flat and level, the lens axis is
    parallel to the bottom of the mount.
  * A 1/4" hole in the bottom (with an optional hex pocket for a 1/4-20 nut)
    mounts the whole thing to the ROV frame or a tripod stud.

All dimensions in millimetres.  *** MEASURE YOUR CAMERA with calipers and
adjust the CLIP_* and HEAD_* values below — the clip dimensions in particular
are estimates. ***
"""

import cadquery as cq

# ------------------------------------------------------------------ parameters
# Camera head (the part with the lens).  MEASURED on the actual camera.
HEAD_W = 71.0          # width, left-right
HEAD_H = 32.0          # height
HEAD_D = 19.0          # depth, front-to-back of the head only (not the clip)
LENS_Z = 16.0          # lens centre height above the camera's resting surface

# The lens is NOT centred in the head.  LENS_FROM_LEFT is measured from the edge
# that appears on YOUR left when you stand in front of the camera looking at the
# lens.  If the notch comes out on the wrong side of the printed part, flip
# LENS_LEFT_IS_MINUS_Y instead of changing the measurement.
LENS_FROM_LEFT = 20.0  # lens centre, from the left edge of the head
LENS_LEFT_IS_MINUS_Y = True
LENS_WINDOW_W = 20.0   # width of the U-notch in the front lip (clears the lens barrel)

# Folding clip, folded flat under the head ("the foot") — ESTIMATES, MEASURE!
CLIP_W = 41.0          # width of the folded clip
CLIP_L = 51.0          # how far the folded clip extends behind the head
CLIP_T = 8.3           # thickness of the folded clip (incl. rubber pad)

HEAD_RAISE = 0.0       # if the head's underside sits HIGHER than the folded clip's
                       # underside, enter that step here (0 = flush / coplanar)

# Fit clearance (resin prints are accurate; 0.4–0.6 mm total is typical)
CLR = 0.8

# Mount body
WALL = 3.0             # side-arm / slot-wall thickness
BASE_T = 8.0           # base plate thickness (needs room for the hex pocket)
SLOT_ROOF_T = 3.0      # material above the clip slot
ARM_H = 20.0           # height of the side arms above the platform
LIP_H = 22.0           # height of the front lip above the platform
LIP_T = 3.0            # front lip thickness
BASE_MARGIN = 4.0      # extra base plate around the body
FILLET = 1.5           # outside edge fillet (set 0 to disable)

# 1/4-20 mounting hole
BOLT_HOLE_D = 6.6      # clearance for 1/4" (6.35 mm) stud
NUT_AF = 11.2          # 1/4-20 hex nut across flats (7/16" = 11.1) + clearance
NUT_T = 5.8            # nut pocket depth (1/4-20 nut is ~5.5 mm thick)
NUT_POCKET = True      # False = plain through hole only

# ------------------------------------------------------------------ derived
slot_w = CLIP_W + CLR
slot_h = CLIP_T + CLR
slot_l = CLIP_L + 2.0            # a little extra so the clip bottoms out on the head, not the slot
platform_l = HEAD_D + CLR + LIP_T
body_w = max(HEAD_W + CLR + 2 * WALL, slot_w + 2 * WALL)
body_l = platform_l + slot_l
base_w = body_w + 2 * BASE_MARGIN
base_l = body_l + 2 * BASE_MARGIN
z_platform = BASE_T              # the camera's resting surface

# Lens centre, in model Y.  Looking at the front of the mount (down the -X axis,
# the way the camera looks back at you), -Y is on your left.
_side = -1.0 if LENS_LEFT_IS_MINUS_Y else +1.0
lens_y = _side * (HEAD_W / 2 - LENS_FROM_LEFT)

# ------------------------------------------------------------------ base plate
base = (
    cq.Workplane("XY")
    .box(base_l, base_w, BASE_T, centered=(True, True, False))
)

# origin reference: x=0 is the front face of the front lip, slot opens at the rear (-X)
x_front = base_l / 2 - BASE_MARGIN          # front face of the lip
x_lip_back = x_front - LIP_T
x_platform_back = x_lip_back - (HEAD_D + CLR)  # where the head stops / slot begins
x_slot_back = x_platform_back - slot_l       # rear opening of the slot

# ------------------------------------------------------------------ clip-slot housing
housing_h = slot_h + SLOT_ROOF_T
housing = (
    cq.Workplane("XY")
    .center((x_platform_back + x_slot_back) / 2, 0)
    .box(slot_l, slot_w + 2 * WALL, housing_h, centered=(True, True, False))
    .translate((0, 0, z_platform))
)
slot_cut = (
    cq.Workplane("XY")
    .center((x_platform_back + x_slot_back) / 2 - 1, 0)   # over-cut past the rear face
    .box(slot_l + 2, slot_w, slot_h, centered=(True, True, False))
    .translate((0, 0, z_platform))
)

# ------------------------------------------------------------------ optional raised head platform
platform = None
if HEAD_RAISE > 0:
    platform = (
        cq.Workplane("XY")
        .center(x_front - (HEAD_D + CLR + LIP_T) / 2, 0)
        .box(HEAD_D + CLR + LIP_T, HEAD_W + CLR + 2 * WALL, HEAD_RAISE, centered=(True, True, False))
        .translate((0, 0, z_platform))
    )

z_head = z_platform + HEAD_RAISE   # camera head resting surface

# ------------------------------------------------------------------ side arms (head cradle)
arm_l = HEAD_D + CLR + LIP_T
arm_y = (HEAD_W + CLR) / 2 + WALL / 2
arms = cq.Workplane("XY")
for sgn in (+1, -1):
    arm = (
        cq.Workplane("XY")
        .center(x_front - arm_l / 2, sgn * arm_y)
        .box(arm_l, WALL, ARM_H, centered=(True, True, False))
        .translate((0, 0, z_head))
    )
    arms = arms.union(arm) if arms.objects else arm

# ------------------------------------------------------------------ front lip with lens U-notch
lip = (
    cq.Workplane("XY")
    .center(x_front - LIP_T / 2, 0)
    .box(LIP_T, HEAD_W + CLR + 2 * WALL, LIP_H, centered=(True, True, False))
    .translate((0, 0, z_head))
)
# U-notch: rectangle from the lens centre upward + a half-round bottom
notch_bottom_z = z_head + LENS_Z
notch = (
    cq.Workplane("XY")
    .center(x_front - LIP_T / 2, lens_y)
    .box(LIP_T + 2, LENS_WINDOW_W, LIP_H, centered=(True, True, False))
    .translate((0, 0, notch_bottom_z))
)
notch_round = (
    cq.Workplane("YZ")
    .workplane(offset=x_front - LIP_T - 1)
    .center(lens_y, notch_bottom_z)
    .circle(LENS_WINDOW_W / 2)
    .extrude(LIP_T + 2)
)

# ------------------------------------------------------------------ assemble
mount = base.union(housing).union(arms).union(lip)
if platform is not None:
    mount = mount.union(platform)
mount = mount.cut(slot_cut).cut(notch).cut(notch_round)

# 1/4" mounting hole through the base, under the camera head / slot junction
hole_x = x_platform_back - slot_l * 0.35       # roughly under the camera's centre of mass
bolt_hole = (
    cq.Workplane("XY")
    .center(hole_x, 0)
    .circle(BOLT_HOLE_D / 2)
    .extrude(BASE_T + housing_h + 2)
    .translate((0, 0, -1))
)
mount = mount.cut(bolt_hole)
if NUT_POCKET:
    # hex pocket from the TOP of the slot floor is unreachable once the clip is in,
    # so put it on the UNDERSIDE instead — captures a nut, or just use the through hole.
    pocket = (
        cq.Workplane("XY")
        .center(hole_x, 0)
        .polygon(6, NUT_AF / 0.8660254)         # polygon() takes the circumscribed dia
        .extrude(NUT_T)
    )
    mount = mount.cut(pocket)

# Cosmetic fillets on outer vertical edges (skip if it fails on a given parameter set)
if FILLET > 0:
    try:
        mount = mount.edges("|Z").fillet(FILLET)
    except Exception:
        pass

# ------------------------------------------------------------------ export
if __name__ == "__main__":
    import os
    out = os.path.dirname(os.path.abspath(__file__))
    cq.exporters.export(mount, os.path.join(out, "c270_mount.step"))
    cq.exporters.export(mount, os.path.join(out, "c270_mount.stl"), tolerance=0.02, angularTolerance=0.1)
    bb = mount.val().BoundingBox()
    print(f"Overall size: {bb.xlen:.1f} x {bb.ylen:.1f} x {bb.zlen:.1f} mm (L x W x H)")
    print(f"Clip slot: {slot_w:.1f} wide x {slot_h:.1f} high x {slot_l:.1f} deep, open at rear")
    print(f"Head cradle: {HEAD_W + CLR:.1f} wide")
    side = "-Y (left as you face the lens)" if LENS_LEFT_IS_MINUS_Y else "+Y"
    print(f"Lens centre: {LENS_FROM_LEFT} mm from the left head edge -> Y={lens_y:+.1f}, offset {abs(lens_y):.1f} mm toward {side}")
    print(f"Lens notch: {LENS_WINDOW_W} mm wide, centred at Z={LENS_Z} above the platform")
    # remaining material in the front lip either side of the notch
    lip_half = (HEAD_W + CLR + 2 * WALL) / 2
    left_web = (lens_y - LENS_WINDOW_W / 2) - (-lip_half)
    right_web = lip_half - (lens_y + LENS_WINDOW_W / 2)
    print(f"Front lip webs: {left_web:.1f} mm on -Y side, {right_web:.1f} mm on +Y side")
    if min(left_web, right_web) < 2.0:
        print("  !! WARNING: lip web under 2 mm — narrow LENS_WINDOW_W or widen the lip")
    # does the notch eat into a side arm?
    arm_inner = (HEAD_W + CLR) / 2
    if lens_y - LENS_WINDOW_W / 2 < -arm_inner or lens_y + LENS_WINDOW_W / 2 > arm_inner:
        print("  !! WARNING: notch extends past the cradle wall into a side arm")
    print(f"1/4in hole at X={hole_x:.1f} from front face; hex pocket {NUT_AF} AF x {NUT_T} deep on underside: {NUT_POCKET}")