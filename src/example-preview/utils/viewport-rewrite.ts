/**
 * Viewport unit rewriting utilities for Lynx Web
 *
 * These functions rewrite CSS viewport units (vh/vw) to use container-relative
 * CSS custom properties (--lynx-vh / --lynx-vw) instead of browser viewport units.
 *
 * The issue: Inside <lynx-view> shadow DOM, native CSS vh/vw resolve to the
 * browser viewport rather than the preview container, causing sizing mismatches.
 *
 * Example: A container of 801px height with --lynx-vh: 801px should make
 * 100vh compute to 801px, not the browser viewport height (e.g., 896px).
 */

/**
 * Rewrites a single CSS value string, converting vh/vw units to use
 * container-relative custom properties.
 *
 * @param value - The CSS value string (e.g., "height: 100vh")
 * @returns The rewritten value (e.g., "height: var(--lynx-vh, 100%)")
 *
 * @example
 * rewriteValue("100vh") // returns "var(--lynx-vh, 100%)"
 * rewriteValue("50vh")  // returns "calc(var(--lynx-vh, 100%) * 0.5)"
 * rewriteValue("100vw") // returns "var(--lynx-vw, 100%)"
 * rewriteValue("-10vh") // returns "calc(var(--lynx-vh, 100%) * -0.1)"
 */
export function rewriteValue(value: string): string {
  return (
    value
      // Rewrite vh units
      // Match: number followed by 'vh' (including negative numbers and decimals)
      // Examples: "100vh", "50vh", "-10vh", "33.33vh"
      .replace(/(-?\d+\.?\d*)vh/g, (_, num) => {
        const n = Number.parseFloat(num);
        // For 100vh, use var(--lynx-vh, 100%) where 100% is a safe fallback
        // that resolves to the container height in most contexts
        if (n === 100) return 'var(--lynx-vh, 100%)';
        // For other values (e.g., 50vh), use calc with the custom property
        return `calc(var(--lynx-vh, 100%) * ${n / 100})`;
      })
      // Rewrite vw units similarly
      .replace(/(-?\d+\.?\d*)vw/g, (_, num) => {
        const n = Number.parseFloat(num);
        if (n === 100) return 'var(--lynx-vw, 100%)';
        return `calc(var(--lynx-vw, 100%) * ${n / 100})`;
      })
  );
}

/**
 * Interface for the template style info structure
 * @internal
 */
interface StyleInfo {
  content?: string[];
  rules?: Array<{
    decl?: Array<[string, string]>;
  }>;
}

/**
 * Interface for the Lynx template structure
 * @internal
 */
export interface LynxTemplate {
  styleInfo?: Record<string, StyleInfo>;
}

/**
 * Rewrites CSS viewport units (vh/vw) in a Lynx template's styleInfo to use
 * CSS custom properties (--lynx-vh / --lynx-vw).
 *
 * This fixes viewport-unit sizing inside the <lynx-view> shadow DOM, where
 * native CSS vh/vw resolve to the browser viewport rather than the preview container.
 *
 * The fix changes:
 * - `100vh` → `var(--lynx-vh, 100%)` (uses percentage fallback instead of 100vh)
 * - `50vh` → `calc(var(--lynx-vh, 100%) * 0.5)`
 * - `100vw` → `var(--lynx-vw, 100%)`
 * - `50vw` → `calc(var(--lynx-vw, 100%) * 0.5)`
 *
 * Using `100%` as the fallback (instead of `100vh`/`100vw`) ensures that if
 * the custom property is not set, the element will size to its container
 * rather than the browser viewport, preventing the miscalculation issue.
 *
 * @param template - The Lynx template object to rewrite in-place
 *
 * @example
 * const template = {
 *   styleInfo: {
 *     "0": {
 *       content: ["height: 100vh"],
 *       rules: [{ decl: [["width", "50vw"]] }]
 *     }
 *   }
 * };
 * rewriteViewportUnits(template);
 * // template.styleInfo["0"].content[0] === "height: var(--lynx-vh, 100%)"
 * // template.styleInfo["0"].rules[0].decl[0] === ["width", "var(--lynx-vw, 100%)"]
 */
export function rewriteViewportUnits(template: LynxTemplate): void {
  if (!template.styleInfo) return;

  for (const key of Object.keys(template.styleInfo)) {
    const info = template.styleInfo[key];
    if (info.content) {
      info.content = info.content.map((s: string) => rewriteValue(s));
    }
    if (info.rules) {
      for (const rule of info.rules) {
        if (rule.decl) {
          rule.decl = rule.decl.map(([prop, val]: [string, string]) => [
            prop,
            rewriteValue(val),
          ]);
        }
      }
    }
  }
}

/**
 * Validates that a template's styleInfo has been correctly rewritten.
 * Useful for testing and debugging.
 *
 * @param template - The Lynx template to validate
 * @returns An object with validation results
 */
export function validateViewportRewriting(template: LynxTemplate): {
  hasStyleInfo: boolean;
  totalRules: number;
  rewrittenRules: number;
  issues: string[];
} {
  const result = {
    hasStyleInfo: false,
    totalRules: 0,
    rewrittenRules: 0,
    issues: [] as string[],
  };

  if (!template.styleInfo) {
    result.issues.push('Template has no styleInfo');
    return result;
  }

  result.hasStyleInfo = true;

  for (const [key, info] of Object.entries(template.styleInfo)) {
    // Check content
    if (info.content) {
      for (const content of info.content) {
        result.totalRules++;
        if (content.includes('vh') || content.includes('vw')) {
          if (
            content.includes('var(--lynx-vh') ||
            content.includes('var(--lynx-vw')
          ) {
            result.rewrittenRules++;
          } else {
            result.issues.push(
              `StyleInfo[${key}].content contains unrewritten viewport unit: "${content}"`
            );
          }
        }
      }
    }

    // Check rules
    if (info.rules) {
      for (const rule of info.rules) {
        if (rule.decl) {
          for (const [prop, val] of rule.decl) {
            result.totalRules++;
            if (val.includes('vh') || val.includes('vw')) {
              if (
                val.includes('var(--lynx-vh') ||
                val.includes('var(--lynx-vw')
              ) {
                result.rewrittenRules++;
              } else {
                result.issues.push(
                  `StyleInfo[${key}].rules.decl contains unrewritten viewport unit for "${prop}": "${val}"`
                );
              }
            }
          }
        }
      }
    }
  }

  return result;
}
