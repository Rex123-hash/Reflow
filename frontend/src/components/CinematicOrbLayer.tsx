export type CinematicOrbBounds = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

const SOURCE = {
  width: 1536,
  height: 1024,
  alphaLeft: 162,
  alphaTop: 80,
  alphaWidth: 1217,
  alphaHeight: 869,
} as const;

export function CinematicOrbLayer({ bounds, mix }: { bounds: CinematicOrbBounds | null; mix: number }) {
  if (!bounds) return null;

  // Preserve the authored image proportions. The projected WebGL silhouette
  // owns center and width; the alpha-bounded source determines rendered height.
  const imageWidth = bounds.width * (SOURCE.width / SOURCE.alphaWidth);
  const imageHeight = imageWidth * (SOURCE.height / SOURCE.width);
  const alphaCenterX = (SOURCE.alphaLeft + SOURCE.alphaWidth / 2) / SOURCE.width;
  const alphaCenterY = (SOURCE.alphaTop + SOURCE.alphaHeight / 2) / SOURCE.height;
  const left = bounds.centerX - imageWidth * alphaCenterX;
  const top = bounds.centerY - imageHeight * alphaCenterY;

  return (
    <img
      className="cinematic-orb-layer"
      src="/experiments/cinematic-orb-master.png"
      alt=""
      draggable={false}
      data-projected-width={bounds.width.toFixed(2)}
      data-projected-height={bounds.height.toFixed(2)}
      data-asset-alpha-height={(imageHeight * SOURCE.alphaHeight / SOURCE.height).toFixed(2)}
      style={{ left, top, width: imageWidth, height: imageHeight, opacity: mix }}
    />
  );
}
