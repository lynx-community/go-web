import { useMemo, useState } from 'react';
import { getUrlFromMustacheSchema } from '../utils/tool';

export interface SchemaOptionType {
  /** Display label in the host selector. */
  name: string;
  /**
   * Default URL template for opening an entry in the host app.
   * Supports `{{{url}}}` for the current entry file URL.
   */
  schema: string;
  /**
   * @deprecated The containing `SchemaOptionsData` property name identifies
   * the host. This field is ignored.
   */
  type?: string;
  /** @deprecated Retained for compatibility; URLs use the schema protocol. */
  prefix?: string;
}
/**
 * Maps caller-defined host IDs to their schema options.
 * Each object property name is a host ID: in `{ hostA: option }`, it is `hostA`.
 * Keep IDs stable across updates to preserve selection and saved edits.
 * `option.name` is the display label; the legacy `option.type` is ignored.
 * The first property in `Object.keys` order is selected by default.
 */
export interface SchemaOptionsData {
  [key: string]: SchemaOptionType;
}

export type SwitchSchemaResult = ReturnType<typeof useSwitchSchema>;

interface SchemaState {
  currentAppType: string | undefined;
  editedSchemas: Record<string, { schema: string; previewSchema: string }>;
}

const EMPTY_OPTIONS: SchemaOptionsData = {};

export const useSwitchSchema = ({
  currentEntryFileUrl,
  optionsData = EMPTY_OPTIONS,
}: {
  currentEntryFileUrl: string;
  optionsData?: SchemaOptionsData;
}) => {
  const [state, setState] = useState<SchemaState>(() => ({
    currentAppType: Object.keys(optionsData)[0],
    editedSchemas: {},
  }));
  const appKeys = Object.keys(optionsData);
  const currentAppType =
    state.currentAppType !== undefined && appKeys.includes(state.currentAppType)
      ? state.currentAppType
      : appKeys[0];
  const validEdits = Object.entries(state.editedSchemas).filter(([key]) =>
    appKeys.includes(key),
  );
  // Empty options can be a loading state. Reconcile once hosts are available;
  // only hosts removed from a nonempty configuration lose their edits.
  if (
    appKeys.length > 0 &&
    (currentAppType !== state.currentAppType ||
      validEdits.length !== Object.keys(state.editedSchemas).length)
  ) {
    setState({
      currentAppType,
      editedSchemas: Object.fromEntries(validEdits),
    });
  }
  const appOptions = useMemo(
    () =>
      Object.entries(optionsData).map(([key, option]) => ({
        ...option,
        schema: state.editedSchemas[key]?.schema ?? option.schema,
        key,
      })),
    [optionsData, state.editedSchemas],
  );
  const currentApp = appOptions.find((option) => option.key === currentAppType);
  const currentEdit =
    currentAppType === undefined
      ? undefined
      : state.editedSchemas[currentAppType];
  const previewSchema = currentEdit?.previewSchema ?? currentApp?.schema ?? '';
  const isSchemaValid =
    currentEdit === undefined ||
    currentEdit.schema === currentEdit.previewSchema;
  const onAppTypeChange = (v: string) => {
    if (appKeys.includes(v)) {
      setState((data) =>
        data.currentAppType === v ? data : { ...data, currentAppType: v },
      );
    }
  };
  const onSchemaChange = (schema: string) => {
    if (
      currentAppType === undefined ||
      !currentApp ||
      schema === currentApp.schema
    ) {
      return;
    }
    let nextPreviewSchema = previewSchema;
    try {
      new URL(schema);
      nextPreviewSchema = schema;
    } catch {
      // Keep incomplete input as a draft, using the last valid URL for QR/copy.
    }
    setState((data) => ({
      ...data,
      editedSchemas: {
        ...data.editedSchemas,
        [currentAppType]: { schema, previewSchema: nextPreviewSchema },
      },
    }));
  };

  const schemaWithTemplateUrl = useMemo(
    () => getUrlFromMustacheSchema(previewSchema, currentEntryFileUrl || ''),
    [previewSchema, currentEntryFileUrl],
  );

  return {
    schemaWithTemplateUrl,
    currentApp,
    isSchemaValid,
    onSchemaChange,
    onAppTypeChange,
    currentAppType,
    appOptions,
  };
};
