/**
 * Resolve the effective schema for QR code URL construction.
 *
 * Priority:
 * 1. schema prop on `<Go>` (explicit per-instance override)
 * 2. schema from `example-metadata.json` (persisted from pluginQRCode config)
 * 3. undefined (raw bundle URL, no schema wrapping)
 */
export function resolveSchema(
  propSchema: string | undefined,
  metadataSchema: string | undefined,
): string | undefined {
  return propSchema ?? metadataSchema;
}
