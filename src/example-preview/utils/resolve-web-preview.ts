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

  if (containerWidth <= 0 || containerHeight <= 0) return 'responsive';

  const shouldUseFit =
    containerWidth < designWidth * fitThresholdScale ||
    containerHeight < designHeight * fitMinScale;

  return shouldUseFit ? 'fit' : 'responsive';
}
