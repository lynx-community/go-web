import { describe, it, expect } from 'vitest';
import { getUrlFromMustacheSchema } from './tool';

describe('getUrlFromMustacheSchema', () => {
  const templateUrl =
    'https://example.com/lynx-examples/basic/main.lynx.bundle';

  it('returns empty string when schema is empty', () => {
    expect(getUrlFromMustacheSchema('', templateUrl)).toBe('');
  });

  it('returns empty string when templateUrl is undefined', () => {
    expect(
      getUrlFromMustacheSchema('lynxexplorer://open?url={{{url}}}', undefined),
    ).toBe('');
  });

  it('replaces {{{url}}} placeholder in a deep-link schema', () => {
    const schema = 'lynxexplorer://open?url={{{url}}}';
    const result = getUrlFromMustacheSchema(schema, templateUrl);
    // URL is encoded when placed in a query parameter
    expect(result).toContain(encodeURIComponent(templateUrl));
    expect(result).not.toContain('{{{url}}}');
  });

  it('replaces {{{url}}} in query parameter value', () => {
    const schema = 'https://app.example.com/open?bundle={{{url}}}&mode=debug';
    const result = getUrlFromMustacheSchema(schema, templateUrl);
    expect(result).toContain(encodeURIComponent(templateUrl));
    expect(result).toContain('mode=debug');
    expect(result).not.toContain('{{{url}}}');
  });

  it('handles schema with no placeholder gracefully', () => {
    const schema = 'https://app.example.com/open?mode=debug';
    const result = getUrlFromMustacheSchema(schema, templateUrl);
    expect(result).toBe(schema);
  });
});
