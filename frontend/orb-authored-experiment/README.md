# Reflow authored-orb experiment

Isolated Blender 5.2 LTS spike. Nothing in this directory is used by the production RecoveryStory.

```powershell
& 'D:\blender.exe' --background --python build_reflow_orb.py -- clay
& 'D:\blender.exe' --background --python build_reflow_orb.py -- final
```

The script regenerates the `.blend`, neutral-clay render, final product renders, named anchors, and exported GLB.
