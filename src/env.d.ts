declare module '*.scss' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.module.scss' {
  const classes: Record<string, string>;
  export default classes;
}

interface ImportMetaEnv extends Record<string, unknown> {
  readonly SSG_MD?: boolean;
  readonly EXAMPLES?: string[];
  readonly SSG_PREVIEWS?: Record<string, string>;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
