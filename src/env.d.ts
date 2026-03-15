declare module '*.scss' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.module.scss' {
  const classes: Record<string, string>;
  export default classes;
}

interface ImportMeta {
  readonly env: Record<string, unknown>;
}
