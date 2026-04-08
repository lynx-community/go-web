import { describe, it, expect } from 'vitest';
import { resolveSchema } from './resolve-schema';

describe('resolveSchema', () => {
  const propSchema = 'custom://open?url={{{url}}}';
  const metadataSchema = 'lynxexplorer://open?url={{{url}}}';

  it('returns prop schema when both are provided (prop wins)', () => {
    expect(resolveSchema(propSchema, metadataSchema)).toBe(propSchema);
  });

  it('returns metadata schema when prop is undefined', () => {
    expect(resolveSchema(undefined, metadataSchema)).toBe(metadataSchema);
  });

  it('returns prop schema when metadata is undefined', () => {
    expect(resolveSchema(propSchema, undefined)).toBe(propSchema);
  });

  it('returns undefined when both are undefined', () => {
    expect(resolveSchema(undefined, undefined)).toBeUndefined();
  });
});
