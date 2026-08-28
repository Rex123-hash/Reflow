"""Phase 3.6D presentation derivative.

Imports the immutable OG-lock v2 constructor and changes only materials,
lighting, ground response and exposure. Geometry parameters are never changed.
"""
import bpy, os, sys
from mathutils import Vector

ROOT=os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path: sys.path.insert(0,ROOT)
import build_reflow_orb_og_lock_v2 as ref

OUT=os.path.join(ROOT,"production-presentation-v1")
PUBLIC=os.path.join(os.path.dirname(ROOT),"public","experiments","production-presentation-v1")
os.makedirs(OUT,exist_ok=True);os.makedirs(PUBLIC,exist_ok=True)

PALETTE={
 "website":(.922,.896,.823), "elevated":(.965,.947,.896), "high":(.991,.984,.948),
 "ceramic_top":(.935,.895,.815), "sidewall":(.650,.555,.445),
 "forest":(.014,.052,.032), "sage":(.315,.390,.295), "brass":(.475,.305,.102),
}

def set_bsdf(name,color,roughness=None,metallic=None,coat=None):
    mat=bpy.data.materials.get(name);bsdf=mat.node_tree.nodes.get("Principled BSDF");bsdf.inputs["Base Color"].default_value=(*color,1)
    if roughness is not None: bsdf.inputs["Roughness"].default_value=roughness
    if metallic is not None: bsdf.inputs["Metallic"].default_value=metallic
    if coat is not None and "Coat Weight" in bsdf.inputs: bsdf.inputs["Coat Weight"].default_value=coat

def calibrate_materials():
    set_bsdf("CeramicWarmIvory",(.86,.805,.705),.66,0,.055)
    set_bsdf("CeramicTop",PALETTE["ceramic_top"],.60,0,.065)
    set_bsdf("ForestEnamel",PALETTE["forest"],.39,.08,.22)
    set_bsdf("MutedPrecisionBrass",PALETTE["brass"],.28,.90,.10)
    set_bsdf("OrbitalSageCeramic",PALETTE["sage"],.64,0,.035)
    side=ref.principled("ProductionWarmSidewall",PALETTE["sidewall"],.70,0,.025)
    for name in ["ReflowBody","LowerSidewall","UpperSidewall"]:
        obj=bpy.data.objects.get(name)
        if obj: obj.data.materials.clear();obj.data.materials.append(side)

def calibrate_lighting(background="website"):
    ground=bpy.data.objects.get("StudioGround")
    if ground:
        m=ref.material("WebsiteCanvas_"+background,PALETTE[background],0,.86);ground.data.materials.clear();ground.data.materials.append(m)
    # Quiet form-revealing additions: a broad low sidewall source and a tall,
    # soft forest/brass reflection card. Neither is visible to the camera.
    def area(name,loc,energy,size,color,shape="DISK",size_y=None):
        bpy.ops.object.light_add(type="AREA",location=loc);o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.shape=shape;o.data.size=size
        if size_y is not None: o.data.size_y=size_y
        o.data.color=color;o.rotation_euler=(Vector((0,0,.18))-o.location).to_track_quat('-Z','Y').to_euler()
    area("ProductionSidewallLift",(4.8,-5.8,1.8),170,4.8,(1.0,.78,.58))
    area("ProductionForestReflection",(-5.4,-1.0,5.8),250,5.2,(.78,.90,.80),"RECTANGLE",1.8)
    key=bpy.data.objects.get("LargeSoftKey");fill=bpy.data.objects.get("BroadWarmFill")
    if key:key.data.energy=1180
    if fill:fill.data.energy=430

def render(name):
    s=bpy.context.scene;s.render.engine="CYCLES";s.cycles.samples=48;s.cycles.use_denoising=True;s.render.resolution_x=1440;s.render.resolution_y=900;s.render.resolution_percentage=100
    s.render.image_settings.file_format="PNG";s.render.image_settings.color_mode="RGBA";s.render.image_settings.color_depth="8";s.render.film_transparent=False;s.view_settings.look="AgX - Medium High Contrast";s.view_settings.exposure=.10
    s.view_settings.exposure=0;s.render.filepath=os.path.join(OUT,name+".png");bpy.ops.render.render(write_still=True)

def export(root,path):
    bpy.ops.object.select_all(action="DESELECT");root.select_set(True)
    for child in root.children_recursive:child.select_set(True)
    bpy.context.view_layer.objects.active=root;bpy.ops.export_scene.gltf(filepath=path,export_format="GLB",export_yup=True,export_apply=True,export_cameras=False,export_lights=False,use_selection=True)

def build(profile=True,background="website"):
    ref.build(False);root=ref.setup_camera();ref.lighting()
    if profile:calibrate_materials();calibrate_lighting(background)
    else:
        ground=bpy.data.objects.get("StudioGround");m=ref.material("ReferenceWebsiteCanvas",PALETTE[background],0,.86);ground.data.materials.clear();ground.data.materials.append(m)
    return root

def main():
    args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    mode=args[0] if args else "production"
    if mode=="reference":
        root=build(False,"website");render("reference-master-on-ivory");export(root,os.path.join(PUBLIC,"reflow-orb-reference-master.glb"));return
    if mode in ("website","elevated","high"):
        root=build(True,mode);render("production-on-"+mode);return
    root=build(True,"website");render("production-presentation-final")
    blend=os.path.join(OUT,"reflow-orb-production-presentation-v1.blend");bpy.ops.wm.save_as_mainfile(filepath=blend)
    export(root,os.path.join(OUT,"reflow-orb-production-presentation-v1.glb"));export(root,os.path.join(PUBLIC,"reflow-orb-production-presentation-v1.glb"));bpy.ops.wm.save_as_mainfile(filepath=blend)

if __name__=="__main__":main()
