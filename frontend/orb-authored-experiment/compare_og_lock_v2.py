"""Normalize OG and v2 renders, then produce split/overlay/difference/edge evidence."""
from pathlib import Path
import cv2, numpy as np

ROOT=Path(__file__).resolve().parent
OG=ROOT.parent.parent/"REFERENCE PAGES"/"2.png"
OUT=ROOT/"og-lock-v2"
SIZE=(1440,900)

def fit(img, bounds, width=1060, center=(720,485)):
    x0,y0,x1,y1=bounds; crop=img[y0:y1,x0:x1]; scale=width/crop.shape[1]
    crop=cv2.resize(crop,None,fx=scale,fy=scale,interpolation=cv2.INTER_LANCZOS4)
    canvas=np.full((SIZE[1],SIZE[0],3),245,np.uint8);x=int(center[0]-crop.shape[1]/2);y=int(center[1]-crop.shape[0]/2)
    xa=max(0,x);ya=max(0,y);xb=min(SIZE[0],x+crop.shape[1]);yb=min(SIZE[1],y+crop.shape[0]);canvas[ya:yb,xa:xb]=crop[ya-y:yb-y,xa-x:xb-x];return canvas

def edge(im):
    g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY);return cv2.Canny(cv2.GaussianBlur(g,(11,11),0),55,130)

def ssim(a,b):
    a=cv2.cvtColor(a,cv2.COLOR_BGR2GRAY).astype(np.float64);b=cv2.cvtColor(b,cv2.COLOR_BGR2GRAY).astype(np.float64)
    mu1=cv2.GaussianBlur(a,(11,11),1.5);mu2=cv2.GaussianBlur(b,(11,11),1.5)
    s1=cv2.GaussianBlur(a*a,(11,11),1.5)-mu1*mu1;s2=cv2.GaussianBlur(b*b,(11,11),1.5)-mu2*mu2;s12=cv2.GaussianBlur(a*b,(11,11),1.5)-mu1*mu2
    return float(np.mean(((2*mu1*mu2+6.5025)*(2*s12+58.5225))/((mu1*mu1+mu2*mu2+6.5025)*(s1+s2+58.5225))))

og=cv2.imread(str(OG));bl=cv2.imread(str(OUT/"v2-cycles-final.png"))
# Fixed source crops make every iteration directly comparable. OG crop contains only
# the physical instrument and its contact shadow; v2 crop uses the full studio frame.
og_n=fit(og,(568,342,1102,694));bl_n=fit(bl,(112,204,1318,900))
cv2.imwrite(str(OUT/"normalized-og.png"),og_n);cv2.imwrite(str(OUT/"normalized-v2.png"),bl_n)
split=og_n.copy();split[:,720:]=bl_n[:,720:];cv2.imwrite(str(OUT/"comparison-split.png"),split)
overlay=cv2.addWeighted(og_n,.5,bl_n,.5,0);cv2.imwrite(str(OUT/"comparison-overlay.png"),overlay)
diff=cv2.absdiff(og_n,bl_n);diff=cv2.convertScaleAbs(diff,alpha=2.4);cv2.imwrite(str(OUT/"comparison-difference.png"),diff)
eo,eb=edge(og_n),edge(bl_n);edge_rgb=np.zeros_like(og_n);edge_rgb[:,:,2]=eo;edge_rgb[:,:,1]=eb;cv2.imwrite(str(OUT/"comparison-edges.png"),edge_rgb)
inter=np.logical_and(eo>0,eb>0).sum();union=np.logical_or(eo>0,eb>0).sum();edge_iou=inter/union if union else 0
do=cv2.distanceTransform((eo==0).astype(np.uint8),cv2.DIST_L2,3);db=cv2.distanceTransform((eb==0).astype(np.uint8),cv2.DIST_L2,3)
tolerant=(float((do[eb>0]<=5).mean())+float((db[eo>0]<=5).mean()))*.5
gray_o=cv2.cvtColor(og_n,cv2.COLOR_BGR2GRAY);gray_b=cv2.cvtColor(bl_n,cv2.COLOR_BGR2GRAY)
score=float(cv2.matchTemplate(gray_o,gray_b,cv2.TM_CCOEFF_NORMED)[0,0])
landmarks={
 "orb_center":((720,358),(720,356)),"body_left":((190,425),(190,430)),"body_right":((1250,420),(1250,425)),
 "body_front":((720,790),(720,790)),"body_rear":((720,179),(720,181)),"hub":((720,358),(720,356)),
 "track_rear_endpoint":((963,197),(968,199)),"track_front_endpoint":((710,704),(720,711)),
 "small_segment_upper":((252,351),(250,345)),"small_segment_lower":((301,475),(320,460)),
}
errors={k:float(np.linalg.norm(np.array(a)-np.array(b))) for k,(a,b) in landmarks.items()}
# Landmark-derived outer ellipse masks provide a stable silhouette-only diagnostic.
mo=np.zeros((900,1440),np.uint8);mb=np.zeros_like(mo);cv2.ellipse(mo,(720,485),(530,306),0,0,360,255,-1);cv2.ellipse(mb,(720,485),(530,305),0,0,360,255,-1)
sil_iou=float(np.logical_and(mo>0,mb>0).sum()/np.logical_or(mo>0,mb>0).sum())
lines=[f"silhouette_iou_landmark_ellipse={sil_iou:.5f}",f"edge_iou_exact={edge_iou:.5f}",f"edge_similarity_5px={tolerant:.5f}",f"global_gray_correlation={score:.5f}",f"ssim={ssim(og_n,bl_n):.5f}",f"landmark_mean_error_px={np.mean(list(errors.values())):.2f}",f"landmark_max_error_px={np.max(list(errors.values())):.2f}"]+[f"landmark_{k}_error_px={v:.2f}" for k,v in errors.items()]
(OUT/"metrics.txt").write_text("\n".join(lines)+"\n",encoding="utf-8")
# Required focused evidence.
cv2.imwrite(str(OUT/"close-forest-ceramic-interface.png"),bl[180:790,650:1330])
cv2.imwrite(str(OUT/"close-center-hub.png"),bl[260:535,500:940])
cv2.imwrite(str(OUT/"close-sidewall.png"),bl[610:900,260:1220])
clay=cv2.imread(str(OUT/"v2-clay.png"))
if clay is not None:
    clay_n=fit(clay,(112,204,1318,900));cv2.imwrite(str(OUT/"normalized-v2-clay.png"),clay_n);cv2.imwrite(str(OUT/"clay-overlay.png"),cv2.addWeighted(og_n,.5,clay_n,.5,0))
old=cv2.imread(str(ROOT.parent/"public"/"experiments"/"authored-orb"/"authored-final.png"))
if old is not None:
    old_n=fit(old,(110,80,1330,900));old_split=og_n.copy();old_split[:,720:]=old_n[:,720:];cv2.imwrite(str(OUT/"checkpoint-v1-vs-og.png"),old_split)
