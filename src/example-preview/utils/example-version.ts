export const EXAMPLE_VERSION_EN = 'Example version: ';
export const EXAMPLE_VERSION_ZH = '示例版本：';

/** Format the version of the loaded example package, when it is available. */
export function getExampleVersionText(
  version: string | undefined,
  lang = 'en',
  label?: string,
): string | null {
  if (typeof version !== 'string' || !version.trim()) return null;
  const base = lang.toLowerCase().split(/[-_]/)[0];
  const prefix =
    label ?? (base === 'zh' ? EXAMPLE_VERSION_ZH : EXAMPLE_VERSION_EN);
  return `${prefix}${version}`;
}
