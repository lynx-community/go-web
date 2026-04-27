export type WebPreviewMode = 'fit' | 'responsive' | 'auto';
export type ResolvedWebPreviewMode = Exclude<WebPreviewMode, 'auto'>;

export type ResolveWebPreviewModeArgs = {
  webPreviewMode: WebPreviewMode;
  designWidth: number;
  designHeight: number;
  fitThresholdScale: number;
  fitMinScale: number;
  containerWidth: number;
  containerHeight: number;
};

export function resolveWebPreviewMode({
  webPreviewMode,
  designWidth,
  designHeight,
  fitThresholdScale,
  fitMinScale,
  containerWidth,
  containerHeight,
}: ResolveWebPreviewModeArgs): ResolvedWebPreviewMode {
  if (webPreviewMode === 'fit') return 'fit';
  if (webPreviewMode === 'responsive') return 'responsive';

  if (
    !Number.isFinite(containerWidth) ||
    containerWidth <= 0 ||
    !Number.isFinite(containerHeight) ||
    containerHeight <= 0
  ) {
    return 'responsive';
  }
  if (
    !Number.isFinite(designWidth) ||
    designWidth <= 0 ||
    !Number.isFinite(designHeight) ||
    designHeight <= 0
  ) {
    return 'responsive';
  }

  const ratioW = containerWidth / designWidth;
  const ratioH = containerHeight / designHeight;

  const shouldUseFit = ratioW < fitThresholdScale || ratioH < fitMinScale;

  return shouldUseFit ? 'fit' : 'responsive';
}
