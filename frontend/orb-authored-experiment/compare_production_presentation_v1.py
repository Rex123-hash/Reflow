from pathlib import Path
import cv2, numpy as np

ROOT=Path(__file__).resolve().parent/"production-presentation-v1"
ref=cv2.imread(str(ROOT/"reference-master-on-ivory.png"));prod=cv2.imread(str(ROOT/"production-on-website.png"))
split=ref.copy();split[:,720:]=prod[:,720:];cv2.imwrite(str(ROOT/"reference-production-split.png"),split)
cv2.imwrite(str(ROOT/"reference-production-overlay.png"),cv2.addWeighted(ref,.5,prod,.5,0))
diff=cv2.convertScaleAbs(cv2.absdiff(ref,prod),alpha=4);cv2.imwrite(str(ROOT/"reference-production-difference.png"),diff)
gray_ref=cv2.cvtColor(ref,cv2.COLOR_BGR2GRAY);gray_prod=cv2.cvtColor(prod,cv2.COLOR_BGR2GRAY)
pair=np.concatenate([cv2.cvtColor(gray_ref,cv2.COLOR_GRAY2BGR),cv2.cvtColor(gray_prod,cv2.COLOR_GRAY2BGR)],axis=1)
cv2.imwrite(str(ROOT/"reference-production-grayscale.png"),pair)
cv2.imwrite(str(ROOT/"detail-ceramic-sidewall.png"),prod[535:900,170:1270])
cv2.imwrite(str(ROOT/"detail-forest-bevel.png"),prod[180:790,650:1325])
cv2.imwrite(str(ROOT/"detail-brass.png"),prod[330:760,650:1240])
cv2.imwrite(str(ROOT/"detail-satellite.png"),prod[270:475,0:250])
cv2.imwrite(str(ROOT/"detail-shadow-grounding.png"),prod[575:900,120:1320])
# Value-separation diagnostics over stable hand-audited regions.
page=(slice(80,160),slice(530,910));top=(slice(360,560),slice(430,950));side=(slice(705,845),slice(290,1150));forest=(slice(255,730),slice(720,1270))
def mean(im,roi):return float(im[roi].mean())
lines=[]
for label,roi in [("page",page),("top",top),("sidewall",side),("forest",forest)]:
    lines.append(f"reference_{label}_luma={mean(gray_ref,roi):.2f}");lines.append(f"production_{label}_luma={mean(gray_prod,roi):.2f}")
lines.append(f"reference_page_sidewall_delta={abs(mean(gray_ref,page)-mean(gray_ref,side)):.2f}")
lines.append(f"production_page_sidewall_delta={abs(mean(gray_prod,page)-mean(gray_prod,side)):.2f}")
lines.append(f"reference_page_forest_delta={abs(mean(gray_ref,page)-mean(gray_ref,forest)):.2f}")
lines.append(f"production_page_forest_delta={abs(mean(gray_prod,page)-mean(gray_prod,forest)):.2f}")
(ROOT/"value-metrics.txt").write_text("\n".join(lines)+"\n",encoding="utf-8")
browser=ROOT/"browser-evidence";br=cv2.imread(str(browser/"reference-hero.png"));bp=cv2.imread(str(browser/"production-hero.png"))
if br is not None and bp is not None:
    gr=cv2.cvtColor(br,cv2.COLOR_BGR2GRAY);gp=cv2.cvtColor(bp,cv2.COLOR_BGR2GRAY)
    cv2.imwrite(str(browser/"reference-production-grayscale.png"),np.concatenate([cv2.cvtColor(gr,cv2.COLOR_GRAY2BGR),cv2.cvtColor(gp,cv2.COLOR_GRAY2BGR)],axis=1))
