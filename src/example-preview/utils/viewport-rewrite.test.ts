/**
 * Tests for viewport-rewrite utilities
 *
 * Run with: npx tsx src/example-preview/utils/viewport-rewrite.test.ts
 * Or use the HTML test file: test-viewport-rewrite.html
 */

import {
  rewriteValue,
  rewriteViewportUnits,
  validateViewportRewriting,
  type LynxTemplate,
} from './viewport-rewrite';

// Simple test runner
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function describe(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

function it(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, passed: true });
    console.log(`  ✅ ${name}`);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    results.push({ name, passed: false, error });
    console.log(`  ❌ ${name}: ${error}`);
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected: T) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toHaveLength(length: number) {
      if ((actual as unknown[]).length !== length) {
        throw new Error(`Expected length ${length}, got ${(actual as unknown[]).length}`);
      }
    },
    toContain(item: unknown) {
      if (!(actual as unknown[]).includes(item)) {
        throw new Error(`Expected to contain ${JSON.stringify(item)}`);
      }
    },
  };
}

// Run tests

describe('rewriteValue', () => {
  describe('vh units', () => {
    it('should rewrite 100vh to var(--lynx-vh, 100%)', () => {
      expect(rewriteValue('100vh')).toBe('var(--lynx-vh, 100%)');
    });

    it('should rewrite 50vh to calc with custom property', () => {
      expect(rewriteValue('50vh')).toBe('calc(var(--lynx-vh, 100%) * 0.5)');
    });

    it('should rewrite 0vh correctly', () => {
      expect(rewriteValue('0vh')).toBe('calc(var(--lynx-vh, 100%) * 0)');
    });

    it('should rewrite decimal vh values', () => {
      expect(rewriteValue('33.33vh')).toBe('calc(var(--lynx-vh, 100%) * 0.3333)');
    });

    it('should rewrite negative vh values', () => {
      expect(rewriteValue('-10vh')).toBe('calc(var(--lynx-vh, 100%) * -0.1)');
    });

    it('should rewrite multiple vh values in one string', () => {
      expect(rewriteValue('height: 100vh; min-height: 50vh')).toBe(
        'height: var(--lynx-vh, 100%); min-height: calc(var(--lynx-vh, 100%) * 0.5)'
      );
    });
  });

  describe('vw units', () => {
    it('should rewrite 100vw to var(--lynx-vw, 100%)', () => {
      expect(rewriteValue('100vw')).toBe('var(--lynx-vw, 100%)');
    });

    it('should rewrite 50vw to calc with custom property', () => {
      expect(rewriteValue('50vw')).toBe('calc(var(--lynx-vw, 100%) * 0.5)');
    });

    it('should rewrite decimal vw values', () => {
      expect(rewriteValue('33.33vw')).toBe('calc(var(--lynx-vw, 100%) * 0.3333)');
    });

    it('should rewrite negative vw values', () => {
      expect(rewriteValue('-10vw')).toBe('calc(var(--lynx-vw, 100%) * -0.1)');
    });
  });

  describe('mixed units', () => {
    it('should rewrite both vh and vw in the same string', () => {
      expect(rewriteValue('width: 100vw; height: 100vh')).toBe(
        'width: var(--lynx-vw, 100%); height: var(--lynx-vh, 100%)'
      );
    });

    it('should handle calc expressions with viewport units', () => {
      expect(rewriteValue('calc(100vh - 50px)')).toBe(
        'calc(var(--lynx-vh, 100%) - 50px)'
      );
    });

    it('should not affect non-viewport units', () => {
      expect(rewriteValue('100px')).toBe('100px');
      expect(rewriteValue('100%')).toBe('100%');
      expect(rewriteValue('100em')).toBe('100em');
      expect(rewriteValue('100rem')).toBe('100rem');
    });

    it('should not affect vh/vw as part of other words', () => {
      // These should NOT be rewritten
      expect(rewriteValue('avhicle')).toBe('avhicle');
      expect(rewriteValue('somevw')).toBe('somevw');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(rewriteValue('')).toBe('');
    });

    it('should handle string without viewport units', () => {
      expect(rewriteValue('color: red; font-size: 16px')).toBe(
        'color: red; font-size: 16px'
      );
    });

    it('should handle values with leading/trailing spaces', () => {
      expect(rewriteValue('  100vh  ')).toBe('  var(--lynx-vh, 100%)  ');
    });

    it('should handle 100.0vh as 100vh', () => {
      expect(rewriteValue('100.0vh')).toBe('var(--lynx-vh, 100%)');
    });
  });
});

describe('rewriteViewportUnits', () => {
  it('should rewrite styleInfo content', () => {
    const template: LynxTemplate = {
      styleInfo: {
        '0': {
          content: ['height: 100vh', 'min-height: 50vh'],
        },
      },
    };

    rewriteViewportUnits(template);

    expect(template.styleInfo?.['0'].content).toEqual([
      'height: var(--lynx-vh, 100%)',
      'min-height: calc(var(--lynx-vh, 100%) * 0.5)',
    ]);
  });

  it('should rewrite styleInfo rules declarations', () => {
    const template: LynxTemplate = {
      styleInfo: {
        '0': {
          rules: [
            {
              decl: [
                ['width', '100vw'],
                ['height', '100vh'],
              ],
            },
          ],
        },
      },
    };

    rewriteViewportUnits(template);

    expect(template.styleInfo?.['0'].rules?.[0].decl).toEqual([
      ['width', 'var(--lynx-vw, 100%)'],
      ['height', 'var(--lynx-vh, 100%)'],
    ]);
  });

  it('should handle both content and rules in the same styleInfo', () => {
    const template: LynxTemplate = {
      styleInfo: {
        '0': {
          content: ['height: 100vh'],
          rules: [
            {
              decl: [['width', '50vw']],
            },
          ],
        },
      },
    };

    rewriteViewportUnits(template);

    expect(template.styleInfo?.['0'].content).toEqual(['height: var(--lynx-vh, 100%)']);
    expect(template.styleInfo?.['0'].rules?.[0].decl).toEqual([
      ['width', 'calc(var(--lynx-vw, 100%) * 0.5)'],
    ]);
  });

  it('should handle multiple styleInfo entries', () => {
    const template: LynxTemplate = {
      styleInfo: {
        '0': {
          content: ['height: 100vh'],
        },
        '1': {
          content: ['width: 100vw'],
        },
      },
    };

    rewriteViewportUnits(template);

    expect(template.styleInfo?.['0'].content).toEqual(['height: var(--lynx-vh, 100%)']);
    expect(template.styleInfo?.['1'].content).toEqual(['width: var(--lynx-vw, 100%)']);
  });

  it('should handle rules without decl property', () => {
    const template: LynxTemplate = {
      styleInfo: {
        '0': {
          rules: [{}, { decl: [['height', '100vh']] }],
        },
      },
    };

    rewriteViewportUnits(template);

    expect(template.styleInfo?.['0'].rules?.[0]).toEqual({});
    expect(template.styleInfo?.['0'].rules?.[1].decl).toEqual([
      ['height', 'var(--lynx-vh, 100%)'],
    ]);
  });

  it('should not modify template without styleInfo', () => {
    const template: LynxTemplate & { lepusCode?: { root: string } } = {
      lepusCode: { root: 'some code' },
    };

    rewriteViewportUnits(template);

    expect(template).toEqual({
      lepusCode: { root: 'some code' },
    });
  });

  it('should handle empty styleInfo', () => {
    const template: LynxTemplate = {
      styleInfo: {},
    };

    rewriteViewportUnits(template);

    expect(template.styleInfo).toEqual({});
  });
});

describe('validateViewportRewriting', () => {
  it('should report missing styleInfo', () => {
    const template: LynxTemplate = {};
    const result = validateViewportRewriting(template);

    expect(result.hasStyleInfo).toBe(false);
    expect(result.issues).toContain('Template has no styleInfo');
  });

  it('should validate correctly rewritten content', () => {
    const template: LynxTemplate = {
      styleInfo: {
        '0': {
          content: ['height: var(--lynx-vh, 100%)'],
        },
      },
    };
    const result = validateViewportRewriting(template);

    expect(result.hasStyleInfo).toBe(true);
    expect(result.totalRules).toBe(1);
    expect(result.rewrittenRules).toBe(1);
    expect(result.issues).toHaveLength(0);
  });

  it('should detect unrewritten viewport units in content', () => {
    const template: LynxTemplate = {
      styleInfo: {
        '0': {
          content: ['height: 100vh'],
        },
      },
    };
    const result = validateViewportRewriting(template);

    expect(result.totalRules).toBe(1);
    expect(result.rewrittenRules).toBe(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain('unrewritten viewport unit');
  });

  it('should detect unrewritten viewport units in rules', () => {
    const template: LynxTemplate = {
      styleInfo: {
        '0': {
          rules: [
            {
              decl: [['width', '100vw']],
            },
          ],
        },
      },
    };
    const result = validateViewportRewriting(template);

    expect(result.totalRules).toBe(1);
    expect(result.rewrittenRules).toBe(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain('unrewritten viewport unit');
  });

  it('should count non-viewport rules as neither rewritten nor issues', () => {
    const template: LynxTemplate = {
      styleInfo: {
        '0': {
          content: ['color: red'],
          rules: [
            {
              decl: [['font-size', '16px']],
            },
          ],
        },
      },
    };
    const result = validateViewportRewriting(template);

    expect(result.totalRules).toBe(2);
    expect(result.rewrittenRules).toBe(0);
    expect(result.issues).toHaveLength(0);
  });
});

// Run tests and print summary
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running viewport-rewrite tests...\n');

  // Tests are already executed above

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => console.log(`  - ${r.name}: ${r.error}`));
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}
