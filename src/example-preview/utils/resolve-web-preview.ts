import { isFinitePositive } from './number';

export type WebPreviewMode = 'fit' | 'responsive' | 'auto';
export type ResolvedWebPreviewMode = Exclude<WebPreviewMode, 'auto'>;

export type WebPreviewResolveReason =
  | 'explicit_fit'
  | 'explicit_responsive'
  | 'invalid_dims'
  | 'invalid_thresholds'
  | 'width_bound'
  | 'height_bound'
  | 'hysteresis_hold'
  | 'none';

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
}: ResolveWebPreviewModeArgs): {
  mode: ResolvedWebPreviewMode;
  reason: WebPreviewResolveReason;
} {
  if (webPreviewMode === 'fit') return { mode: 'fit', reason: 'explicit_fit' };
  if (webPreviewMode === 'responsive')
    return { mode: 'responsive', reason: 'explicit_responsive' };

  if (!isFinitePositive(containerWidth) || !isFinitePositive(containerHeight)) {
    return { mode: 'responsive', reason: 'invalid_dims' };
  }
  if (!isFinitePositive(designWidth) || !isFinitePositive(designHeight)) {
    return { mode: 'responsive', reason: 'invalid_dims' };
  }
  if (!isFinitePositive(fitThresholdScale) || !isFinitePositive(fitMinScale)) {
    return { mode: 'responsive', reason: 'invalid_thresholds' };
  }

  const ratioW = containerWidth / designWidth;
  const ratioH = containerHeight / designHeight;

  const widthBound = ratioW < fitThresholdScale;
  const heightBound = ratioH < fitMinScale;
  const shouldUseFit = widthBound || heightBound;

  if (shouldUseFit) {
    return {
      mode: 'fit',
      reason: heightBound ? 'height_bound' : 'width_bound',
    };
  }

  return { mode: 'responsive', reason: 'none' };
}

export type ResolveWebPreviewModeWithHysteresisResult = {
  mode: ResolvedWebPreviewMode;
  reason: WebPreviewResolveReason;
  ratioW: number;
  ratioH: number;
  enterThresholdScale: number;
  enterMinScale: number;
  exitThresholdScale: number;
  exitMinScale: number;
  inHysteresisHold: boolean;
  hysteresisProgress: number;
};

export function resolveWebPreviewModeWithHysteresis(
  args: ResolveWebPreviewModeArgs,
  prevMode: ResolvedWebPreviewMode,
): ResolveWebPreviewModeWithHysteresisResult {
  const AUTO_HYSTERESIS_FACTOR = 1.06;

  const base = resolveWebPreviewMode(args);

  const invalidBase =
    base.reason === 'invalid_dims' || base.reason === 'invalid_thresholds';
  const isExplicit =
    base.reason === 'explicit_fit' || base.reason === 'explicit_responsive';

  if (invalidBase || isExplicit) {
    const ratioW = args.containerWidth / args.designWidth;
    const ratioH = args.containerHeight / args.designHeight;

    return {
      mode: base.mode,
      reason: base.reason,
      ratioW,
      ratioH,
      enterThresholdScale: args.fitThresholdScale,
      enterMinScale: args.fitMinScale,
      exitThresholdScale: args.fitThresholdScale,
      exitMinScale: args.fitMinScale,
      inHysteresisHold: false,
      hysteresisProgress: 0,
    };
  }

  const ratioW = args.containerWidth / args.designWidth;
  const ratioH = args.containerHeight / args.designHeight;

  const enterThresholdScale = args.fitThresholdScale;
  const enterMinScale = args.fitMinScale;
  const exitThresholdScale = enterThresholdScale * AUTO_HYSTERESIS_FACTOR;
  const exitMinScale = enterMinScale * AUTO_HYSTERESIS_FACTOR;

  const enterWidthBound = ratioW < enterThresholdScale;
  const enterHeightBound = ratioH < enterMinScale;
  const enterFit = enterWidthBound || enterHeightBound;

  const exitFit = ratioW >= exitThresholdScale && ratioH >= exitMinScale;

  let mode: ResolvedWebPreviewMode;
  if (prevMode === 'fit') {
    mode = exitFit ? 'responsive' : 'fit';
  } else {
    mode = enterFit ? 'fit' : 'responsive';
  }

  const inHysteresisHold = prevMode === 'fit' && mode === 'fit' && !enterFit;
  const hysteresisProgress = inHysteresisHold
    ? Math.min(
        1,
        Math.max(
          0,
          Math.min(
            (ratioW - enterThresholdScale) /
              (exitThresholdScale - enterThresholdScale),
            (ratioH - enterMinScale) / (exitMinScale - enterMinScale),
          ),
        ),
      )
    : 0;

  let reason: WebPreviewResolveReason;
  if (mode === 'fit') {
    if (enterFit) {
      reason = enterHeightBound ? 'height_bound' : 'width_bound';
    } else {
      reason = 'hysteresis_hold';
    }
  } else {
    reason = 'none';
  }

  return {
    mode,
    reason,
    ratioW,
    ratioH,
    enterThresholdScale,
    enterMinScale,
    exitThresholdScale,
    exitMinScale,
    inHysteresisHold,
    hysteresisProgress,
  };
}
