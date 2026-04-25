/**
 * Dimensions of the container and the base frame.
 */
export type FitInput = {
  /** Container width in pixels */
  containerWidth: number;
  /** Container height in pixels */
  containerHeight: number;
  /** Base frame width in pixels */
  baseWidth: number;
  /** Base frame height in pixels */
  baseHeight: number;
};

/**
 * Contain and cover scale factors for a base frame fitted into a container.
 * The two values bracket the valid scale range.
 *
 * - `contain`: the base frame is fully visible inside the container
 * - `cover`: the container is fully filled, base frame may be cropped
 */
export type ScaleRange = {
  contain: number;
  cover: number;
};

/**
 * Pre-computed alignment factors along each axis.
 * Each value is in [0, 1]: 0 = start, 0.5 = center, 1 = end.
 */
export type AlignFactors = {
  ax: number;
  ay: number;
};

/**
 * Input for computing the frame's transform offset.
 */
export type FrameOffsetInput = {
  baseWidth: number;
  baseHeight: number;
  scale: number;
} & AlignFactors;

/**
 * 2D translation offset for a frame transform.
 */
export type FrameOffset = {
  offsetX: number;
  offsetY: number;
};

/**
 * Compute the contain and cover scale factors for a base frame
 * fitted into a container.
 */
export function computeScaleRange(input: FitInput): ScaleRange {
  const { containerWidth, containerHeight, baseWidth, baseHeight } = input;
  if (
    !Number.isFinite(baseWidth) ||
    baseWidth <= 0 ||
    !Number.isFinite(baseHeight) ||
    baseHeight <= 0
  ) {
    throw new RangeError(
      `computeScaleRange: baseWidth and baseHeight must be finite and > 0, got ${baseWidth}x${baseHeight}`,
    );
  }
  const ratioW = containerWidth / baseWidth;
  const ratioH = containerHeight / baseHeight;
  return {
    contain: Math.min(ratioW, ratioH),
    cover: Math.max(ratioW, ratioH),
  };
}

/**
 * Interpolate between contain and cover scale using a 0–1 progress value.
 *
 * - `t = 0`: behaves like contain
 * - `t = 1`: behaves like cover
 */
export function lerpFitScale(
  { contain, cover }: ScaleRange,
  t: number,
): number {
  return contain + (cover - contain) * t;
}

/**
 * Compute the transform offset for a scaled frame,
 * given pre-computed scale and alignment factors.
 */
export function computeFrameOffset(input: FrameOffsetInput): FrameOffset {
  const { baseWidth, baseHeight, scale, ax, ay } = input;
  return {
    offsetX: -(baseWidth * scale) * ax,
    offsetY: -(baseHeight * scale) * ay,
  };
}
