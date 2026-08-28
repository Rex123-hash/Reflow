from pathlib import Path
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent / "browser-converged-v1"
EVIDENCE = ROOT / "evidence"


def read(name: str) -> np.ndarray:
    image = cv2.imread(str(EVIDENCE / name), cv2.IMREAD_COLOR)
    if image is None:
        raise FileNotFoundError(name)
    return image


def global_ssim(a: np.ndarray, b: np.ndarray) -> float:
    a = a.astype(np.float64)
    b = b.astype(np.float64)
    c1 = (0.01 * 255) ** 2
    c2 = (0.03 * 255) ** 2
    mu_a = cv2.GaussianBlur(a, (11, 11), 1.5)
    mu_b = cv2.GaussianBlur(b, (11, 11), 1.5)
    sigma_a = cv2.GaussianBlur(a * a, (11, 11), 1.5) - mu_a * mu_a
    sigma_b = cv2.GaussianBlur(b * b, (11, 11), 1.5) - mu_b * mu_b
    sigma_ab = cv2.GaussianBlur(a * b, (11, 11), 1.5) - mu_a * mu_b
    score = ((2 * mu_a * mu_b + c1) * (2 * sigma_ab + c2)) / (
        (mu_a * mu_a + mu_b * mu_b + c1) * (sigma_a + sigma_b + c2)
    )
    return float(np.mean(score))


def normalize_background(image: np.ndarray, target: np.ndarray) -> np.ndarray:
    # Background-only strip; removes page-color offset from material diagnostics.
    source_mean = image[24:140, 400:1040].mean(axis=(0, 1))
    target_mean = target[24:140, 400:1040].mean(axis=(0, 1))
    return np.clip(image.astype(np.float32) + target_mean - source_mean, 0, 255).astype(np.uint8)


def edge_similarity(a: np.ndarray, b: np.ndarray, radius: int = 5) -> float:
    ea = cv2.Canny(a, 40, 110) > 0
    eb = cv2.Canny(b, 40, 110) > 0
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (radius * 2 + 1, radius * 2 + 1))
    da = cv2.dilate(ea.astype(np.uint8), kernel) > 0
    db = cv2.dilate(eb.astype(np.uint8), kernel) > 0
    coverage_a = float((ea & db).sum() / max(1, ea.sum()))
    coverage_b = float((eb & da).sum() / max(1, eb.sum()))
    return (coverage_a + coverage_b) * 0.5


def contact_sheet(names: list[str], output: str, columns: int = 3) -> None:
    width, height = 1440, 900
    rows = int(np.ceil(len(names) / columns))
    cell_w, cell_h = width // columns, height // rows
    sheet = np.full((height, width, 3), (234, 241, 246), dtype=np.uint8)
    for index, name in enumerate(names):
        image = read(name)
        scale = min(cell_w / image.shape[1], (cell_h - 30) / image.shape[0])
        resized = cv2.resize(image, (int(image.shape[1] * scale), int(image.shape[0] * scale)), interpolation=cv2.INTER_AREA)
        row, column = divmod(index, columns)
        x = column * cell_w + (cell_w - resized.shape[1]) // 2
        y = row * cell_h + 26
        sheet[y:y + resized.shape[0], x:x + resized.shape[1]] = resized
        cv2.putText(sheet, Path(name).stem.replace("-", " ").upper(), (column * cell_w + 14, row * cell_h + 19), cv2.FONT_HERSHEY_SIMPLEX, 0.43, (28, 54, 43), 1, cv2.LINE_AA)
    cv2.imwrite(str(EVIDENCE / output), sheet)


cycles = read("approved-cycles-target.png")
initial = read("initial-browser-glb.png")
final = read("final-browser-glb.png")
texture_512 = read("texture-512.png")
texture_1024 = read("texture-1024.png")

initial_n = normalize_background(initial, cycles)
final_n = normalize_background(final, cycles)
roi = (slice(165, 900), slice(70, 1370))
cycles_gray = cv2.cvtColor(cycles[roi], cv2.COLOR_BGR2GRAY)
initial_gray = cv2.cvtColor(initial_n[roi], cv2.COLOR_BGR2GRAY)
final_gray = cv2.cvtColor(final_n[roi], cv2.COLOR_BGR2GRAY)

# Landmark coordinates are manually audited at native resolution against the
# deterministic split. They are geometry/camera diagnostics, not material metrics.
cycles_landmarks = np.array([
    [110, 528], [1328, 528], [720, 899], [720, 181], [720, 405],
    [997, 221], [698, 711], [198, 393], [219, 539], [632, 805],
], dtype=np.float32)
initial_landmarks = np.array([
    [198, 530], [1241, 530], [720, 851], [720, 250], [720, 408],
    [957, 257], [702, 673], [271, 402], [292, 528], [646, 751],
], dtype=np.float32)
final_landmarks = np.array([
    [111, 528], [1329, 528], [720, 899], [720, 180], [720, 405],
    [998, 221], [698, 711], [198, 393], [218, 539], [632, 805],
], dtype=np.float32)

initial_errors = np.linalg.norm(initial_landmarks - cycles_landmarks, axis=1)
final_errors = np.linalg.norm(final_landmarks - cycles_landmarks, axis=1)

ellipse_cycles = np.zeros((900, 1440), np.uint8)
ellipse_final = np.zeros_like(ellipse_cycles)
cv2.ellipse(ellipse_cycles, (719, 540), (610, 359), 0, 0, 360, 255, -1)
cv2.ellipse(ellipse_final, (720, 540), (609, 360), 0, 0, 360, 255, -1)
intersection = np.logical_and(ellipse_cycles, ellipse_final).sum()
union = np.logical_or(ellipse_cycles, ellipse_final).sum()

texture_diff = cv2.absdiff(texture_512, texture_1024)
cv2.imwrite(str(EVIDENCE / "texture-512-1024-difference-x8.png"), cv2.convertScaleAbs(texture_diff, alpha=8))

lines = [
    f"cycles_initial_ssim_bg_normalized={global_ssim(cycles_gray, initial_gray):.5f}",
    f"cycles_final_ssim_bg_normalized={global_ssim(cycles_gray, final_gray):.5f}",
    f"cycles_initial_edge_similarity_5px={edge_similarity(cycles_gray, initial_gray):.5f}",
    f"cycles_final_edge_similarity_5px={edge_similarity(cycles_gray, final_gray):.5f}",
    f"initial_landmark_mean_px={initial_errors.mean():.2f}",
    f"initial_landmark_max_px={initial_errors.max():.2f}",
    f"final_landmark_mean_px={final_errors.mean():.2f}",
    f"final_landmark_max_px={final_errors.max():.2f}",
    f"final_silhouette_ellipse_iou={intersection / union:.5f}",
    f"texture_512_1024_ssim={global_ssim(cv2.cvtColor(texture_512, cv2.COLOR_BGR2GRAY), cv2.cvtColor(texture_1024, cv2.COLOR_BGR2GRAY)):.5f}",
    f"texture_512_1024_mean_abs_difference={texture_diff.mean():.5f}",
    f"texture_512_1024_max_abs_difference={texture_diff.max()}",
]
(ROOT / "visual-metrics.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")

contact_sheet(["story-hero.png", "story-impact.png", "story-futures.png", "story-action.png"], "story-scale-contact-sheet.png", 2)
contact_sheet(["yaw-minus-15.png", "yaw-minus-10.png", "sheen-0.png", "sheen-plus-5.png", "sheen-plus-10.png", "yaw-plus-15.png"], "angle-contact-sheet.png", 3)
contact_sheet(["forest-initial-final.png", "ceramic-initial-final.png", "brass-initial-final.png", "sidewall-initial-final.png", "seam-initial-final.png", "shadow-initial-final.png"], "detail-contact-sheet.png", 3)

print("\n".join(lines))
