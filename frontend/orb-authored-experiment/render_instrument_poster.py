"""Renders the marketing loading poster from the authored instrument.

The poster has one job: be indistinguishable from the browser's first real WebGL
frame, so the crossfade has nothing to jump between. That means it is not a
"nice render of the orb" — it reproduces the browser's exact hero state:

  * the same GLB geometry and calibrated materials (imported, never re-authored);
  * the desktop hero root transform the story controller sets at progress 0;
  * the Three.js camera position, target and *vertical* FOV;
  * the three orbital satellites at their deterministic frozen phase angles;
  * a shadow-catcher ground on a transparent film, matching the browser's
    transparent canvas over the page's warm background.

    & 'D:\\blender.exe' --background --python render_instrument_poster.py
"""

import math
import os
import sys

import bpy
from mathutils import Euler, Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import build_reflow_orb_production_presentation_v1 as prod  # noqa: E402

OUT_DIR = os.path.join(ROOT, "poster-v1")
ASSET_DIR = os.path.join(os.path.dirname(ROOT), "src", "assets", "instrument")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(ASSET_DIR, exist_ok=True)

# --- values mirrored from the browser -----------------------------------------
# src/components/ReflowInstrument.tsx  -> camera + groundCorrection
# src/story/useStoryController.ts      -> desktop hero pose, orientation keyframe 0
# src/orb/authoredReflowRendering.tsx  -> AUTHORED_BODY_FLOOR
BODY_FLOOR = -0.165
HERO_SCALE = 0.38          # conditions.desktop heroScale
HERO_POSE_Y = 2.7          # pose.y at hero, which drives Three's Z
HERO_YAW_DEG = -8.6        # GLOBAL_ORIENTATION_KEYFRAMES[0].degrees
CAMERA_THREE = (0.0, 6.55, 9.75)
TARGET_THREE = (0.0, 0.2, 0.0)
CAMERA_FOV_V_DEG = 20.58   # Three PerspectiveCamera fov is vertical

# src/orb/AuthoredReflowInstrument.tsx -> SATELLITES
SATELLITES = [
    dict(r=0.19, scale=(1.0, 0.96, 1.05), rx=3.05, rz=2.52, phase=3.52, incl=0.018, h=0.035, bias=0.10),
    dict(r=0.205, scale=(1.02, 0.97, 1.0), rx=3.55, rz=2.94, phase=1.86, incl=-0.03, h=0.045, bias=0.11),
    dict(r=0.20, scale=(1.04, 0.97, 1.02), rx=4.05, rz=3.32, phase=5.68, incl=0.038, h=0.055, bias=0.12),
]

RESOLUTION = (2200, 1400)   # sized by height in CSS, so width is generous headroom
SAMPLES = 256


def three_to_blender(vec):
    """Three.js is Y-up, Blender is Z-up. The GLB was exported with export_yup."""
    x, y, z = vec
    return Vector((x, -z, y))


def place_camera():
    camera = bpy.data.objects.get("OGReferenceCamera")
    if camera is None:
        raise RuntimeError("OGReferenceCamera missing; the authored build did not run")

    camera.location = three_to_blender(CAMERA_THREE)
    target = three_to_blender(TARGET_THREE)
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()

    data = camera.data
    data.type = "PERSP"
    # Three's fov is vertical, so the Blender sensor must be fit vertically or the
    # framing silently changes with aspect ratio.
    data.sensor_fit = "VERTICAL"
    data.angle_y = math.radians(CAMERA_FOV_V_DEG)
    data.clip_start = 0.1
    data.clip_end = 120.0
    bpy.context.scene.camera = camera
    return camera


def apply_hero_transform(root):
    """The transform ReflowInstrument applies to its root group at progress 0."""
    ground_correction = BODY_FLOOR * (1.0 - HERO_SCALE)
    root.location = three_to_blender((0.0, ground_correction, HERO_POSE_Y))
    root.rotation_euler = Euler((0.0, 0.0, math.radians(HERO_YAW_DEG)), "XYZ")
    root.scale = (HERO_SCALE,) * 3
    return root


def satellite_material():
    material = bpy.data.materials.new("PosterSatelliteSage")
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.353, 0.408, 0.325, 1.0)  # #9ead99 linearised
    bsdf.inputs["Roughness"].default_value = 0.72
    bsdf.inputs["Metallic"].default_value = 0.0
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = 0.025
    return material


def add_satellites(root):
    """The browser draws these in R3F, not from the GLB, so the poster must too.

    Their first-frame position is deterministic: `frozenAngle = phase`, which is
    also where the animated orbit starts at clock time zero.

    Blender's own OrbitalSatellite_* objects are removed first. `setup_camera`
    deliberately leaves them unparented, so they neither inherit the hero scale nor
    correspond to the satellites the browser actually renders.
    """
    for obj in [o for o in bpy.data.objects if o.name.startswith("OrbitalSatellite_")]:
        bpy.data.objects.remove(obj, do_unlink=True)

    material = satellite_material()
    for index, sat in enumerate(SATELLITES):
        phase = sat["phase"]
        local_x = math.cos(phase) * sat["rx"]
        local_z = math.sin(phase) * sat["rz"]
        local_y = sat["bias"] + local_z * sat["incl"] + math.sin(phase * 3.0) * sat["h"]

        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=sat["r"])
        sphere = bpy.context.object
        sphere.name = f"PosterSatellite_{index}"
        sphere.location = three_to_blender((local_x, local_y, local_z))
        sphere.scale = (sat["scale"][0], sat["scale"][2], sat["scale"][1])
        sphere.data.materials.append(material)
        for polygon in sphere.data.polygons:
            polygon.use_smooth = True
        # Deliberately leaving matrix_parent_inverse at identity: the satellites
        # live inside the scaled root group in R3F, so they must inherit the hero
        # scale here too. Setting the inverse would cancel exactly that.
        sphere.parent = root


def configure_shadow_catcher():
    """The browser has no visible ground — only a faint shadow catcher plane.

    Rendering the ivory studio floor here would put a hard disc behind the poster
    that the WebGL frame does not have. Transparent film plus a shadow catcher
    reproduces exactly what the canvas composites over the page.
    """
    ground = bpy.data.objects.get("StudioGround")
    if ground is not None:
        ground.is_shadow_catcher = True
    bpy.context.scene.render.film_transparent = True


def configure_render(samples=SAMPLES, scale=100):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = RESOLUTION
    scene.render.resolution_percentage = scale
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    # Matches the authored reference look transform; the browser is being brought
    # to these values rather than the other way round.
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.0


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    preview = "preview" in args

    root = prod.build(True, "website")
    apply_hero_transform(root)
    add_satellites(root)
    place_camera()
    configure_shadow_catcher()
    configure_render(samples=48 if preview else SAMPLES, scale=50 if preview else 100)

    bpy.context.view_layer.update()
    name = "poster-preview" if preview else "reflow-instrument-poster"
    target = os.path.join(OUT_DIR, f"{name}.png")
    bpy.context.scene.render.filepath = target
    bpy.ops.render.render(write_still=True)
    print(f"[poster] wrote {target}")

    if not preview:
        blend = os.path.join(OUT_DIR, "reflow-instrument-poster.blend")
        bpy.ops.wm.save_as_mainfile(filepath=blend)
        print(f"[poster] wrote {blend}")


if __name__ == "__main__":
    main()
