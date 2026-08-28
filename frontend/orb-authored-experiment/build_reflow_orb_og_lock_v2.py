"""Reference-locked Reflow instrument reconstruction (Phase 3.6C).

This is an isolated successor to build_reflow_orb.py. It deliberately does not
overwrite the Phase 3.6 blend, GLB, renders, or texture sources.
"""
import bpy, math, os, sys
from mathutils import Vector
ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path: sys.path.insert(0, ROOT)
from build_reflow_orb import material, bevel, cylinder, ring, arc_mesh, anchor, ensure_uvs

OUT = os.path.join(ROOT, "og-lock-v2")
os.makedirs(OUT, exist_ok=True)

P = {
    "body_radius": 2.82, "body_height": 0.30,
    "lower_sidewall_radius": 2.79, "upper_sidewall_radius": 2.72,
    "edge_bevel": 0.065, "top_plate_radius": 2.63, "top_plate_height": 0.105,
    "track_inner_radius": 2.08, "track_outer_radius": 2.47,
    "track_insert_height": 0.047, "track_recess_depth": 0.016, "track_bevel": 0.014,
    "track_segments": [(-1.61, 0.91), (3.02, 3.50)],
    "secondary_radius": 2.56, "secondary_width": 0.105, "secondary_height": 0.036,
    "secondary_segments": [(-1.70, 0.95)],
    "lower_pedestal_radius": 0.82, "lower_pedestal_height": 0.105,
    "upper_pedestal_radius": 0.60, "upper_pedestal_height": 0.065,
    "objective_hub_radius": 0.115, "objective_hub_height": 0.052,
    "inner_arc_radius": 0.47, "inner_arc_width": 0.052, "inner_arc_height": 0.030,
    "marker_radius": 0.034, "marker_height": 0.030,
    "marker_positions": [(2.98,2.18),(0.70,2.18),(0.02,2.18),(-0.88,2.18),(-1.54,2.16)],
    "seam_radii": [1.08,1.58], "seam_width": 0.005, "seam_depth": 0.006,
    "radial_seam_angles": [0,math.pi/2,math.pi,math.pi*1.5], "radial_seam_width": 0.006,
    "camera_focal_length": 62.0, "camera_distance": 9.75, "camera_elevation": 6.55,
    "camera_target": (0.0,0.0,0.20), "object_yaw": 0.0, "camera_roll": 0.0,
}

ITERATIONS = [
    ("v2.0", "Separated v2 pipeline; parameterized all critical geometry", "Make reconstruction attributable"),
    ("v2.1", "Reduced body depth/bevel and pedestal/hub mass", "Match OG shallow architectural silhouette"),
    ("v2.2", "Replaced three plate-like inserts with one long and one short near-flush insert", "Match OG topology and remove bolted-plate appearance"),
    ("v2.3", "Reduced brass by about 40% and replaced black seats with micro-gaps", "Match precision hardware/interfaces"),
    ("v2.4", "Changed black CAD seams to shallow warm physical grooves", "Let AO and grazing light define construction"),
    ("v2.5", "Lowered camera elevation and increased focal length", "Match OG ellipse and sidewall exposure"),
]

def principled(name, color, roughness, metallic=0.0, coat=0.0):
    m=material(name,color,metallic,roughness); b=m.node_tree.nodes.get("Principled BSDF")
    if "Coat Weight" in b.inputs: b.inputs["Coat Weight"].default_value=coat
    noise=m.node_tree.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value=34; noise.inputs["Detail"].default_value=2; noise.inputs["Roughness"].default_value=.62
    bump=m.node_tree.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value=.085 if metallic==0 else .025; bump.inputs["Distance"].default_value=.028
    m.node_tree.links.new(noise.outputs["Fac"],bump.inputs["Height"]);m.node_tree.links.new(bump.outputs["Normal"],b.inputs["Normal"])
    return m

def groove_curve(name, angle, r0, r1, z, mat):
    curve=bpy.data.curves.new(name,"CURVE");curve.dimensions="3D";curve.bevel_depth=P["radial_seam_width"];curve.bevel_resolution=2
    spline=curve.splines.new("POLY");spline.points.add(1)
    spline.points[0].co=(math.cos(angle)*r0,math.sin(angle)*r0,z,1);spline.points[1].co=(math.cos(angle)*r1,math.sin(angle)*r1,z,1)
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);obj.data.materials.append(mat);return obj

def add_pin(angle, radius, z, brass, i):
    x,y=math.cos(angle)*radius,math.sin(angle)*radius
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=P["marker_radius"],depth=P["marker_height"],location=(x,y,z))
    stem=bpy.context.object;stem.name=f"BrassMarker_{i:02d}";stem.data.materials.append(brass);bevel(stem,.007,3)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,radius=P["marker_radius"]*1.28,location=(x,y,z+P["marker_height"]*.58))
    cap=bpy.context.object;cap.name=f"BrassMarkerCap_{i:02d}";cap.scale.z=.54;cap.data.materials.append(brass);bpy.ops.object.shade_smooth()

def add_satellite(name, location, radius, sage, scale=(1,1,1)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5,radius=radius,location=location)
    obj=bpy.context.object;obj.name=name;obj.scale=scale;obj.data.materials.append(sage);bpy.ops.object.shade_smooth()
    bevel(obj,.008,3);return obj

def build(clay=False):
    bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
    neutral=material("Clay",(.62,.60,.56),0,.82)
    ceramic=neutral if clay else principled("CeramicWarmIvory",(.83,.79,.71),.68,0,.05)
    ceramic_top=neutral if clay else principled("CeramicTop",(.90,.865,.79),.64,0,.04)
    ceramic_groove=neutral if clay else material("CeramicGroove",(.43,.40,.35),0,.88)
    forest=neutral if clay else principled("ForestEnamel",(.018,.052,.033),.42,.08,.18)
    brass=neutral if clay else principled("MutedPrecisionBrass",(.42,.245,.075),.31,.88,.08)
    interface=neutral if clay else material("MicroInterface",(.115,.115,.095),0,.88)
    sage=neutral if clay else principled("OrbitalSageCeramic",(.42,.47,.37),.68,0,.03)

    top_z=.285
    cylinder("ReflowBody",P["body_radius"],P["body_height"],-.015,ceramic,P["edge_bevel"])
    cylinder("LowerSidewall",P["lower_sidewall_radius"],.16,.105,ceramic,.04)
    cylinder("UpperSidewall",P["upper_sidewall_radius"],.095,.205,ceramic_top,.025)
    ring("SidewallForestReveal",2.715,.026,.157,forest)
    ring("SidewallBrassReveal",2.725,.009,.183,brass)
    cylinder("TopPlate",P["top_plate_radius"],P["top_plate_height"],.235,ceramic_top,.026)

    # Seats are only a hair wider/deeper than inserts: micro-shadow, never a black plate.
    for i,(start,end) in enumerate(P["track_segments"]):
        inner=P["track_inner_radius"] if i==0 else 2.16;outer=P["track_outer_radius"] if i==0 else 2.49
        arc_mesh(f"PrimaryTrackRecess_{i}",inner-.022,outer+.022,top_z-.012,top_z-.003,start-.012,end+.012,interface,120,.006)
        arc_mesh(f"PrimaryForestTrack_{i}",inner,outer,top_z-.003,top_z+P["track_insert_height"],start,end,forest,144,P["track_bevel"])
    for i,(start,end) in enumerate(P["secondary_segments"]):
        inner=P["secondary_radius"]-P["secondary_width"]*.5;outer=P["secondary_radius"]+P["secondary_width"]*.5
        arc_mesh(f"SecondaryTrackRecess_{i}",inner-.012,outer+.012,top_z-.034,top_z-.020,start-.01,end+.01,interface,144,.004)
        arc_mesh(f"SecondaryForestTrack_{i}",inner,outer,top_z-.022,top_z+P["secondary_height"]-.022,start,end,forest,144,.008)

    # The OG's concentric boundaries are terraced construction, not printed
    # rings: two nested ceramic plates rise by millimetric steps. Their bevels,
    # AO and grazing light create the boundary. Only radial assembly junctions
    # retain a hairline material separation.
    cylinder("ConcentricCeramicTierOuter",P["seam_radii"][1],.020,top_z+.010,ceramic_top,.008,192)
    cylinder("ConcentricCeramicTierInner",P["seam_radii"][0],.016,top_z+.028,ceramic_top,.006,192)
    for i,a in enumerate(P["radial_seam_angles"]):
        groove_curve(f"RadialAssemblyJunctionOuter_{i}",a,1.08,1.88,top_z+.022,ceramic_groove)
        groove_curve(f"RadialAssemblyJunctionInner_{i}",a,.82,1.08,top_z+.040,ceramic_groove)

    cylinder("CenterLowerPedestal",P["lower_pedestal_radius"],P["lower_pedestal_height"],top_z+.050,ceramic_top,.026,144)
    cylinder("CenterUpperPedestal",P["upper_pedestal_radius"],P["upper_pedestal_height"],top_z+.115,ceramic_top,.018,128)
    ir=P["inner_arc_radius"]; iw=P["inner_arc_width"]
    arc_mesh("InnerRecoveryRecess",ir-iw*.5-.012,ir+iw*.5+.012,top_z+.142,top_z+.147,2.32,6.78,interface,112,.004)
    arc_mesh("InnerRecoveryArc",ir-iw*.5,ir+iw*.5,top_z+.146,top_z+.146+P["inner_arc_height"],2.35,6.75,forest,112,.008)
    cylinder("ObjectiveHubBrassSeat",P["objective_hub_radius"]*1.26,.018,top_z+.157,brass,.006,96)
    cylinder("ObjectiveHub",P["objective_hub_radius"],P["objective_hub_height"],top_z+.184,forest,.014,96)
    for i,(a,r) in enumerate(P["marker_positions"]): add_pin(a,r,top_z+.048,brass,i)
    # One small center-track marker visible in the OG.
    add_pin(.12,ir,top_z+.185,brass,9)
    # Reference-composition satellites are independent scene bodies. They are
    # intentionally excluded from the instrument root and GLB export.
    add_satellite("OrbitalSatellite_RearLeft",(-3.40,.92,.015),.205,sage,(1.00,.96,1.05))
    add_satellite("OrbitalSatellite_FrontLeft",(-3.26,-1.76,.012),.220,sage,(1.02,.97,1.00))
    add_satellite("OrbitalSatellite_RearRight",(3.42,.88,.018),.215,sage,(1.04,.97,1.02))
    for name,r,a,z in [("objectiveHub",0,0,.48),("recoveryTrackTangent",P["track_outer_radius"],-.2,.34),("impactSource",3.0,3.3,.3),("futureA",3.2,3.9,.3),("futureB",3.2,4.7,.3),("futureC",3.2,5.9,.3),("actionExit",2.48,-.28,.34)]: anchor(name,r,a,z)
    ensure_uvs()

def setup_camera(yaw=0,tilt=0):
    root=bpy.data.objects.new("ReflowInstrumentRoot",None);bpy.context.collection.objects.link(root)
    for obj in list(bpy.context.scene.objects):
        if obj!=root and obj.type!="CAMERA" and obj.parent is None and not obj.name.startswith("OrbitalSatellite_"): obj.parent=root
    root.rotation_euler=(math.radians(tilt),0,math.radians(yaw+P["object_yaw"]))
    bpy.ops.object.camera_add(location=(0,-P["camera_distance"],P["camera_elevation"]))
    cam=bpy.context.object;cam.name="OGReferenceCamera";bpy.context.scene.camera=cam;cam.data.lens=P["camera_focal_length"]
    cam.rotation_euler=(Vector(P["camera_target"])-cam.location).to_track_quat('-Z','Y').to_euler();cam.rotation_euler.z+=math.radians(P["camera_roll"])
    return root

def lighting():
    world=bpy.context.scene.world or bpy.data.worlds.new("World");bpy.context.scene.world=world;world.use_nodes=True
    world.node_tree.nodes["Background"].inputs["Color"].default_value=(.075,.066,.052,1);world.node_tree.nodes["Background"].inputs["Strength"].default_value=.32
    def area(name,loc,energy,size,color):
        bpy.ops.object.light_add(type="AREA",location=loc);o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.shape="DISK";o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,.2))-o.location).to_track_quat('-Z','Y').to_euler()
    area("LargeSoftKey",(-4.7,-5.3,8.2),1050,6.5,(1,.91,.78));area("BroadWarmFill",(5.2,-1.6,4.8),510,5.8,(.78,.85,.76));area("OppositeBounce",(-2.5,4.5,4.0),280,4.5,(.90,.82,.70));area("FrontReflector",(0,-3,7.8),320,5.2,(1,.94,.84))
    bpy.ops.mesh.primitive_plane_add(size=30,location=(0,0,-.18));g=bpy.context.object;g.name="StudioGround";g.data.materials.append(material("GroundIvory",(.89,.865,.79),0,.82))

def render(name,clay=False):
    s=bpy.context.scene;s.render.engine="CYCLES";s.cycles.samples=48;s.cycles.use_denoising=True
    s.render.resolution_x=1440;s.render.resolution_y=900;s.render.resolution_percentage=100;s.render.image_settings.file_format="PNG";s.render.image_settings.color_mode="RGBA";s.render.image_settings.color_depth="8";s.render.film_transparent=False
    s.view_settings.look="AgX - Medium High Contrast";s.view_settings.exposure=0;s.render.filepath=os.path.join(OUT,name+".png")
    bpy.ops.render.render(write_still=True)

def export(root):
    bpy.ops.object.select_all(action="DESELECT");root.select_set(True)
    for child in root.children_recursive: child.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,"reflow-orb-og-lock-v2.glb"),export_format="GLB",export_yup=True,export_apply=True,export_cameras=False,export_lights=False,use_selection=True)

def main():
    args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    mode=args[0] if args else "clay";clay=mode=="clay";build(clay);root=setup_camera();lighting()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,"reflow-orb-og-lock-v2.blend"))
    if clay: render("v2-clay",True);return
    if mode=="hero": render("v2-cycles-final");bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,"reflow-orb-og-lock-v2.blend"));return
    if mode=="composition":
        cam=bpy.context.scene.camera;cam.location=(0,-12.6,8.6);cam.rotation_euler=(Vector(P["camera_target"])-cam.location).to_track_quat('-Z','Y').to_euler();render("v2-og-composition");return
    for yaw,name in [(0,"v2-cycles-final"),(-10,"v2-yaw-minus-10"),(10,"v2-yaw-plus-10"),(-15,"v2-yaw-minus-15"),(15,"v2-yaw-plus-15")]: root.rotation_euler.z=math.radians(yaw);render(name)
    root.rotation_euler=(math.radians(4),0,0);render("v2-tilt-plus-4");root.rotation_euler=(0,0,0);export(root)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,"reflow-orb-og-lock-v2.blend"))

if __name__=="__main__": main()
