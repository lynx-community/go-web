declare module '*.scss' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.module.scss' {
  const classes: Record<string, string>;
  export default classes;
}

// vant-touch.js is a self-executing script with no exports
declare module '*/vant-touch.js' {
  // Module has no exports - it self-executes on load
}

interface ImportMeta {
  readonly env: Record<string, unknown>;
}
