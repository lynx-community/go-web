export { GoConfigProvider, useGoConfig } from './config';
export type { GoConfig, PreviewTab } from './config';
export { ExamplePreview, type ExamplePreviewProps } from './example-preview';
export type { ExampleMetadata } from './example-preview';
export { getFileCodeLanguage } from './example-preview/utils/example-data';
export { Go, type GoProps } from './Go';

// Level A — configurable native environment for the previewed <lynx-view>.
export {
  resolveCloneableInput,
  mergePreviewNativeEnv,
  applyPreviewNativeEnv,
} from './example-preview/preview-native-env';
export type {
  PreviewNativeEnv,
  CloneableInput,
  Cloneable,
  NativeModulesCall,
  NativeModulesMap,
  NapiModulesCall,
  NapiModulesMap,
} from './example-preview/preview-native-env';

// Level B — pluggable preview runtime for multi-page (MPA) examples.
export type {
  PreviewRuntimeComponent,
  PreviewRuntimeProps,
  PreviewRuntimeEntry,
} from './example-preview/preview-runtime';
