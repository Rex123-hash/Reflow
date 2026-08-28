import bpy
import math
import os
import sys
import random
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(ROOT), "public", "experiments", "authored-orb")
os.makedirs(OUT, exist_ok=True)


def material(name, color, metallic=0.0, roughness=0.6):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def add_microtexture(mat, stem, base, rough_base, strength):
    size = 1024
    rng = random.Random(731 if stem == "ceramic" else 947)
    color_pixels = []
    rough_pixels = []
    for y in range(size):
        for x in range(size):
            fine = rng.random() - 0.5
            broad = math.sin(x * 0.031) * math.cos(y * 0.027) * 0.5
            variation = fine * strength + broad * strength * 0.42
            color_pixels.extend((max(0,min(1,base[0]+variation)),max(0,min(1,base[1]+variation)),max(0,min(1,base[2]+variation)),1))
            r=max(0,min(1,rough_base + broad*0.045 + fine*0.035))
            rough_pixels.extend((r,r,r,1))
    color_image=bpy.data.images.new(stem+"_basecolor",width=size,height=size,alpha=True)
    color_image.pixels.foreach_set(color_pixels);color_image.filepath_raw=os.path.join(OUT,stem+"-basecolor-1k.png");color_image.file_format="PNG";color_image.save();color_image.pack()
    rough_image=bpy.data.images.new(stem+"_roughness",width=size,height=size,alpha=True)
    rough_image.colorspace_settings.name="Non-Color";rough_image.pixels.foreach_set(rough_pixels);rough_image.filepath_raw=os.path.join(OUT,stem+"-roughness-1k.png");rough_image.file_format="PNG";rough_image.save();rough_image.pack()
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;bsdf=nodes.get("Principled BSDF")
    tex=nodes.new("ShaderNodeTexImage");tex.name=stem+" Base Color";tex.image=color_image;links.new(tex.outputs["Color"],bsdf.inputs["Base Color"])
    rough=nodes.new("ShaderNodeTexImage");rough.name=stem+" Roughness";rough.image=rough_image;rough.interpolation="Linear";links.new(rough.outputs["Color"],bsdf.inputs["Roughness"])


def ensure_uvs():
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.data.uv_layers:
            continue
        uv=obj.data.uv_layers.new(name="ReflowUV")
        for loop in obj.data.loops:
            co=obj.data.vertices[loop.vertex_index].co
            uv.data[loop.index].uv=((co.x+2.8)/5.6,(co.y+2.8)/5.6)


def bevel(obj, width, segments=4):
    mod = obj.modifiers.new("Manufactured edge", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"


def cylinder(name, radius, depth, z, mat, bevel_width=0.03, vertices=192):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, z))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bevel(obj, bevel_width)
    bpy.ops.object.shade_smooth()
    return obj


def ring(name, major, minor, z, mat):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=192, minor_segments=12, location=(0, 0, z))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def arc_mesh(name, inner, outer, z0, z1, start, end, mat, segments=96, bevel_width=0.025):
    verts = []
    faces = []
    for i in range(segments + 1):
        a = start + (end - start) * i / segments
        c, s = math.cos(a), math.sin(a)
        verts.extend([(inner*c, inner*s, z0), (outer*c, outer*s, z0), (inner*c, inner*s, z1), (outer*c, outer*s, z1)])
    for i in range(segments):
        a = i * 4
        b = a + 4
        faces.extend([
            (a, b, b+1, a+1), (a+2, a+3, b+3, b+2),
            (a, a+2, b+2, b), (a+1, b+1, b+3, a+3),
        ])
    faces.extend([(0,1,3,2), (segments*4,segments*4+2,segments*4+3,segments*4+1)])
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    bevel(obj, bevel_width, 3)
    for poly in mesh.polygons:
        poly.use_smooth = True
    return obj


def add_pin(angle, radius, z, brass, index):
    x, y = math.cos(angle)*radius, math.sin(angle)*radius
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.055, depth=0.055, location=(x,y,z))
    stem = bpy.context.object
    stem.name = f"BrassMarker_{index:02d}"
    stem.data.materials.append(brass)
    bevel(stem, 0.012, 3)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.07, location=(x,y,z+0.045))
    cap = bpy.context.object
    cap.name = f"BrassMarkerCap_{index:02d}"
    cap.scale.z = 0.68
    cap.data.materials.append(brass)
    bpy.ops.object.shade_smooth()


def anchor(name, radius, angle, z=0.43):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "SPHERE"
    obj.empty_display_size = 0.07
    obj.location = (math.cos(angle)*radius, math.sin(angle)*radius, z)
    bpy.context.collection.objects.link(obj)


def build(clay=False):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    ceramic = material("Clay" if clay else "CeramicWarmIvory", (0.72,0.69,0.64) if clay else (0.80,0.75,0.67), 0.0, 0.72)
    ceramic_top = ceramic if clay else material("CeramicTop", (0.91,0.87,0.80), 0.0, 0.64)
    # Calibrated in Blender's linear-light material space to retain the approved
    # dark-forest identity without collapsing to black under the warm studio rig.
    forest = ceramic if clay else material("ForestInsert", (0.060,0.145,0.100), 0.08, 0.54)
    brass = ceramic if clay else material("MutedBrass", (0.52,0.32,0.10), 0.82, 0.30)
    gap = ceramic if clay else material("AssemblyGap", (0.035,0.038,0.034), 0.0, 0.94)
    if not clay:
        add_microtexture(ceramic,"ceramic",(0.80,0.75,0.67),0.72,0.018)
        ceramic_top.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value=(0.91,0.87,0.80,1)
        add_microtexture(forest,"forest",(0.060,0.145,0.100),0.54,0.012)

    cylinder("ReflowBody", 2.78, 0.42, 0.0, ceramic, 0.11)
    cylinder("LayeredSidewall", 2.66, 0.18, 0.27, ceramic_top, 0.065)
    ring("SidewallForestBand", 2.55, 0.075, 0.205, forest)
    ring("SidewallBrassReveal", 2.58, 0.018, 0.285, brass)
    cylinder("TopPlate", 2.48, 0.16, 0.39, ceramic_top, 0.055)

    # Recessed seat and fitted primary segments.
    arc_mesh("PrimaryTrackSeat", 1.72, 2.39, 0.466, 0.492, -0.18, 1.63, gap, 112, 0.016)
    arc_mesh("PrimaryTrackSeat_B", 1.72, 2.39, 0.466, 0.492, 2.08, 2.92, gap, 64, 0.016)
    arc_mesh("PrimaryTrackSeat_C", 1.72, 2.39, 0.466, 0.492, 3.30, 4.28, gap, 64, 0.016)
    arc_mesh("PrimaryForestTrack", 1.75, 2.36, 0.49, 0.60, -0.14, 1.59, forest, 112, 0.032)
    arc_mesh("PrimaryForestTrack_B", 1.75, 2.36, 0.49, 0.60, 2.12, 2.88, forest, 64, 0.032)
    arc_mesh("PrimaryForestTrack_C", 1.75, 2.36, 0.49, 0.60, 3.34, 4.24, forest, 64, 0.032)

    arc_mesh("SecondaryTrackSeat", 2.43, 2.61, 0.37, 0.405, -0.1, 1.66, gap, 112, 0.012)
    arc_mesh("SecondaryForestTrack", 2.46, 2.58, 0.405, 0.47, -0.06, 1.62, forest, 112, 0.02)

    # Concentric construction seams and seated center assembly.
    ring("SeamGeometry_Outer", 1.50, 0.008, 0.477, gap)
    ring("SeamGeometry_Inner", 1.08, 0.007, 0.478, gap)
    for a in [0, math.pi/2, math.pi, math.pi*1.5]:
        curve = bpy.data.curves.new(f"RadialSeam_{a:.2f}", "CURVE")
        curve.dimensions = "3D"; curve.bevel_depth = 0.007; curve.bevel_resolution = 2
        spline = curve.splines.new("POLY"); spline.points.add(1)
        spline.points[0].co = (math.cos(a)*0.98, math.sin(a)*0.98, 0.479, 1)
        spline.points[1].co = (math.cos(a)*1.70, math.sin(a)*1.70, 0.479, 1)
        obj = bpy.data.objects.new(f"SeamGeometry_Radial_{a:.2f}", curve); bpy.context.collection.objects.link(obj); obj.data.materials.append(gap)

    cylinder("CenterPedestal", 0.82, 0.15, 0.545, ceramic_top, 0.045, 144)
    cylinder("CenterInterface", 0.59, 0.085, 0.655, ceramic_top, 0.03, 128)
    arc_mesh("ObjectiveTrackSeat", 0.38, 0.57, 0.724, 0.75, -0.35, 4.25, gap, 96, 0.012)
    arc_mesh("ObjectiveTrack", 0.41, 0.54, 0.748, 0.80, -0.31, 4.21, forest, 96, 0.018)
    cylinder("ObjectiveHubBrassSeat", 0.205, 0.035, 0.765, brass, 0.012, 96)
    cylinder("ObjectiveHub", 0.17, 0.085, 0.815, forest, 0.025, 96)

    pins = [(-0.02,2.08),(0.82,2.08),(1.53,2.08),(2.48,2.05),(3.80,2.04)]
    for i,(a,r) in enumerate(pins): add_pin(a,r,0.615,brass,i)

    for name,r,a,z in [
        ("objectiveHub",0,0,0.84),("recoveryTrackTangent",2.36,-0.18,0.60),
        ("impactSource",3.05,3.35,0.42),("futureA",3.25,3.86,0.42),
        ("futureB",3.25,4.71,0.42),("futureC",3.25,5.95,0.42),
        ("actionExit",2.40,-0.26,0.60)]: anchor(name,r,a,z)
    ensure_uvs()


def setup_camera(yaw=0.0, tilt=0.0):
    root = bpy.data.objects.new("ReflowInstrumentRoot", None)
    bpy.context.collection.objects.link(root)
    for obj in list(bpy.context.scene.objects):
        if obj != root and obj.type != "CAMERA" and obj.parent is None:
            obj.parent = root
    root.rotation_euler = (math.radians(tilt), 0, math.radians(yaw))
    bpy.ops.object.camera_add(location=(0,-8.9,7.25))
    cam=bpy.context.object;cam.name="ReferenceCamera";bpy.context.scene.camera=cam
    cam.data.lens=58
    direction=Vector((0,0,0.25))-cam.location
    cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    return root


def lighting():
    world=bpy.context.scene.world or bpy.data.worlds.new("World");bpy.context.scene.world=world;world.use_nodes=True
    world.node_tree.nodes["Background"].inputs["Color"].default_value=(0.055,0.047,0.036,1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value=0.28
    def area(name,loc,energy,size,color):
        bpy.ops.object.light_add(type="AREA",location=loc);o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.shape="DISK";o.data.size=size;o.data.color=color
        o.rotation_euler=((Vector((0,0,.25))-o.location).to_track_quat('-Z','Y').to_euler())
    area("LargeSoftKey",(-4.5,-4.8,8.5),1150,5.5,(1.0,.88,.70))
    area("BroadWarmFill",(5,-2,5),700,5,(.72,.82,.72))
    area("TopReflector",(0,3.5,8),520,4.5,(1.0,.91,.78))
    bpy.ops.mesh.primitive_plane_add(size=30,location=(0,0,-.26));ground=bpy.context.object;ground.name="Ground";ground.data.materials.append(material("GroundIvory",(.89,.86,.78),0,.82))


def render(path, clay=False):
    scene=bpy.context.scene
    scene.render.engine="BLENDER_EEVEE" if clay else "CYCLES"
    if not clay:
        scene.cycles.samples=32
        scene.cycles.use_denoising=True
    scene.render.resolution_x=1440;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG";scene.render.image_settings.color_mode="RGBA"
    scene.render.film_transparent=True
    scene.render.image_settings.color_depth="8"
    scene.view_settings.look="AgX - Medium High Contrast"
    scene.render.filepath=path
    bpy.ops.render.render(write_still=True)


def main():
    args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    mode=args[0] if args else "clay"
    clay=mode=="clay"
    build(clay=clay);root=setup_camera();lighting()
    blend=os.path.join(ROOT,"reflow-orb-authored.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    if clay:
        render(os.path.join(OUT,"authored-clay.png"),True)
        return
    for yaw,name in [(0,"authored-final"),(-15,"authored-yaw-minus-15"),(15,"authored-yaw-plus-15")]:
        root.rotation_euler.z=math.radians(yaw);render(os.path.join(OUT,name+".png"),False)
    root.rotation_euler=(math.radians(5),0,0);render(os.path.join(OUT,"authored-tilt-plus-5.png"),False)
    root.rotation_euler=(0,0,0)
    # Export the authored instrument hierarchy only. The studio ground, camera,
    # and lights are deliberately excluded from the browser asset.
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,"reflow-orb-authored.glb"),export_format="GLB",export_yup=True,export_apply=True,export_cameras=False,export_lights=False,use_selection=True)
    bpy.ops.wm.save_as_mainfile(filepath=blend)


if __name__ == "__main__":
    main()
