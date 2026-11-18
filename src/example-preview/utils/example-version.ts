export const DEFAULT_VERSION_LABEL = 'v';

/** Format the version of the loaded example, when it is available. */
export function getExampleVersionText(
  version: string | undefined,
  label = DEFAULT_VERSION_LABEL,
): string | null {
  if (typeof version !== 'string' || !version.trim()) return null;
  return `${label}${version}`;
}
