import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import '@douyinfe/semi-ui/dist/css/semi.min.css';
import {
  GoConfigProvider,
  Go,
  EXAMPLE_SCOPES,
  searchExamplePackages,
  fetchPackageVersions,
  fetchExampleMetadata,
} from '../../src/index';
import type { NpmPackageInfo, PackageVersionInfo } from '../../src/index';
import type { PreviewTab, GoConfig } from '../../src/config';
import type { ShikiTransformer, BundledLanguage } from 'shiki';
import './styles.css';

const LOGO_LIGHT =
  'https://lf-lynx.tiktok-cdns.com/obj/lynx-artifacts-oss-sg/lynx-website/assets/lynx-dark-logo.svg';
const LOGO_DARK =
  'https://lf-lynx.tiktok-cdns.com/obj/lynx-artifacts-oss-sg/lynx-website/assets/lynx-light-logo.svg';

type Lang = 'en' | 'zh';

// ---------------------------------------------------------------------------
// i18n translations
// ---------------------------------------------------------------------------

const translations: Record<string, Record<string, string>> = {
  en: {
    'go.preview': 'Preview',
    'go.qrcode': 'QRCode',
    'go.files': 'Files',
    'go.scan.message-1': 'Download ',
    'go.scan.message-2': 'and scan the QR code to get started.',
    'go.qrcode.copy-link': 'Copy Link',
    'go.qrcode.copied': 'Copied',
    'go.qrcode.entry': 'Entry',
  },
  zh: {
    'go.preview': '预览',
    'go.qrcode': '二维码',
    'go.files': '文件',
    'go.scan.message-1': '请下载 ',
    'go.scan.message-2': '扫描二维码预览',
    'go.qrcode.copy-link': '复制链接',
    'go.qrcode.copied': '已复制',
    'go.qrcode.entry': '入口',
  },
};

// ---------------------------------------------------------------------------
// Standalone CodeBlock (shiki-based syntax highlighting)
// ---------------------------------------------------------------------------

let _codeHighlighterP: ReturnType<typeof import('shiki').then> | null = null;
function getCodeHighlighter() {
  if (!_codeHighlighterP) {
    _codeHighlighterP = import('shiki').then((mod) =>
      mod.createHighlighter({
        themes: ['github-light', 'github-dark'],
        langs: [],
      }),
    );
  }
  return _codeHighlighterP;
}

const StandaloneCodeBlock = ({
  lang,
  code,
  onRendered,
  shikiOptions,
}: {
  lang: string;
  code: string;
  onRendered?: () => void;
  shikiOptions?: { transformers?: ShikiTransformer[] };
}) => {
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    getCodeHighlighter().then(async (highlighter) => {
      if (cancelled) return;
      const loaded = highlighter.getLoadedLanguages();
      if (!loaded.includes(lang as BundledLanguage)) {
        try {
          await highlighter.loadLanguage(lang as BundledLanguage);
        } catch {
          // fall back to plaintext
        }
      }
      const effective = highlighter
        .getLoadedLanguages()
        .includes(lang as BundledLanguage)
        ? lang
        : 'text';
      const result = highlighter.codeToHtml(code, {
        lang: effective,
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: false,
        transformers: shikiOptions?.transformers ?? [],
      });
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [code, lang, shikiOptions?.transformers]);

  useEffect(() => {
    if (html && onRendered) requestAnimationFrame(() => onRendered());
  }, [html, onRendered]);

  return (
    <div className="rp-codeblock">
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="shiki">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
};

// Build-time injected SSG previews (example list is now fetched at runtime)
declare global {
  interface ImportMeta {
    env: {
      EXAMPLES: { name: string; version: string }[];
      SSG_PREVIEWS: Record<string, string>;
    };
  }
}
const SSG_PREVIEWS: Record<string, string> =
  import.meta.env.SSG_PREVIEWS ?? {};

// ---------------------------------------------------------------------------
// Runtime example & version fetching hooks
// ---------------------------------------------------------------------------

type PackagesSource = 'build' | 'fetching' | 'live' | 'error';

function useExamplePackages() {
  // Initialize immediately from build-time data — zero latency on first render.
  // Build-time names like "vue-basic" must map back to their npm scope.
  // Each entry now carries the version that was pinned at build time so the
  // version dropdown is populated immediately (before the live npm fetch).
  const [packages, setPackages] = useState<NpmPackageInfo[]>(() =>
    (import.meta.env.EXAMPLES ?? [{ name: 'hello-world', version: '' }]).map(
      ({ name, version }: { name: string; version: string }) => {
        const scopeConfig =
          EXAMPLE_SCOPES.find((s) => s.prefix && name.startsWith(s.prefix)) ??
          EXAMPLE_SCOPES[0];
        const rawName = scopeConfig.prefix
          ? name.slice(scopeConfig.prefix.length)
          : name;
        return {
          name: `${scopeConfig.scope}${rawName}`,
          shortName: name,
          scope: scopeConfig,
          version,
        };
      },
    ),
  );
  const [source, setSource] = useState<PackagesSource>('build');

  useEffect(() => {
    setSource('fetching');
    searchExamplePackages()
      .then((pkgs) => {
        setPackages(pkgs);
        setSource('live');
      })
      .catch((err) => {
        console.error('Failed to fetch example packages:', err);
        setSource('error');
      });
  }, []);

  return { packages, source };
}

function usePackageVersions(packageName: string) {
  const [versions, setVersions] = useState<PackageVersionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!packageName) return;
    setVersions([]);
    setLoading(true);
    fetchPackageVersions(packageName)
      .then(setVersions)
      .catch((err) =>
        console.error(`Failed to fetch versions for ${packageName}:`, err),
      )
      .finally(() => setLoading(false));
  }, [packageName]);
  return { versions, loading };
}

// ---------------------------------------------------------------------------
// SourceBadge — shows whether the example list is from build-time or npm live
// ---------------------------------------------------------------------------

const SOURCE_BADGE_CONFIG: Record<
  PackagesSource,
  { label: string; className: string; dot: boolean }
> = {
  build:    { label: 'static', className: 'source-badge-build',    dot: false },
  fetching: { label: 'fetching', className: 'source-badge-fetching', dot: true  },
  live:     { label: 'live',    className: 'source-badge-live',     dot: true  },
  error:    { label: 'offline', className: 'source-badge-error',    dot: false },
};

function SourceBadge({ source, count }: { source: PackagesSource; count: number }) {
  const { label, className, dot } = SOURCE_BADGE_CONFIG[source];
  return (
    <span
      className={`source-badge ${className}`}
      title={
        source === 'build'    ? `Showing ${count} examples from build-time bundle` :
        source === 'fetching' ? 'Fetching latest examples from npm registry…' :
        source === 'live'     ? `Showing ${count} examples fetched live from npm` :
                                'npm fetch failed — showing build-time bundle'
      }
    >
      {dot && <span className={`source-dot${source === 'fetching' ? ' source-dot-fetching' : ''}`} />}
      {label}
    </span>
  );
}

function getExampleSource(name: string): 'vue' | 'lynx' {
  return name.startsWith('vue-') ? 'vue' : 'lynx';
}

// ---------------------------------------------------------------------------
// URL State Persistence
// ---------------------------------------------------------------------------

interface UrlState {
  dark?: boolean;
  lang?: Lang;
  tab?: PreviewTab;
  file?: string;
  example?: string;
  version?: string;
}

function readUrlState(): UrlState {
  try {
    const hash = window.location.hash.slice(1);
    if (!hash) return {};
    return JSON.parse(decodeURIComponent(hash));
  } catch {
    return {};
  }
}

function writeUrlState(state: UrlState) {
  const cleaned = Object.fromEntries(
    Object.entries(state).filter(([, v]) => v !== undefined),
  );
  const hash = encodeURIComponent(JSON.stringify(cleaned));
  window.history.replaceState(null, '', `#${hash}`);
}

// ---------------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------------

class PreviewErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <strong>Preview Error</strong>
          <pre>{this.state.error.message}</pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="error-retry"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// UI primitives — SegmentedControl + ControlGroup (Mumbai v1 style)
// ---------------------------------------------------------------------------

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
      }}
    >
      <span className="control-label">{label}</span>
      {children}
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        borderRadius: 6,
        border: '1px solid var(--sb-border)',
        overflow: 'hidden',
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '3px 10px',
            border: 'none',
            borderRight: '1px solid var(--sb-border)',
            background:
              value === opt.value ? 'var(--sb-accent)' : 'transparent',
            color: value === opt.value ? '#fff' : 'var(--sb-text-dim)',
            fontSize: 11,
            fontFamily: 'inherit',
            cursor: 'pointer',
            fontWeight: value === opt.value ? 600 : 400,
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Custom select styling matching Mumbai v1
const selectStyle: React.CSSProperties = {
  padding: '3px 24px 3px 8px',
  borderRadius: 6,
  border: '1px solid var(--sb-border)',
  background: 'transparent',
  color: 'inherit',
  fontSize: 12,
  fontFamily: 'inherit',
  cursor: 'pointer',
  outline: 'none',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 6px center',
};

// Responsive: <select> on mobile for compact header
function useIsMobile(breakpoint = 600) {
  const [mobile, setMobile] = useState(
    () => window.matchMedia(`(max-width: ${breakpoint}px)`).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);
  return mobile;
}

function AdaptiveControl<T extends string>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as T)}
        style={selectStyle}
      >
        {props.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
  return <SegmentedControl {...props} />;
}

const inputStyle: React.CSSProperties = {
  width: 120,
  padding: '3px 8px',
  borderRadius: 6,
  border: '1px solid var(--sb-border)',
  background: 'transparent',
  color: 'inherit',
  fontSize: 12,
  fontFamily: 'inherit',
  outline: 'none',
};

const panelLabelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  color: 'var(--sb-text-dim)',
  whiteSpace: 'nowrap',
};

const panelInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: 'auto',
  minWidth: 0,
};

// ---------------------------------------------------------------------------
// Column Resizer (Finder-style drag handle between columns)
// ---------------------------------------------------------------------------

function ColumnResizer({
  widthRef,
  onWidthChange,
  reverse,
}: {
  widthRef: React.RefObject<number>;
  onWidthChange: (w: number) => void;
  reverse?: boolean;
}) {
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startW = widthRef.current!;
      const sign = reverse ? -1 : 1;
      const onPointerMove = (ev: PointerEvent) => {
        onWidthChange(Math.max(160, startW + (ev.clientX - startX) * sign));
      };
      const onPointerUp = () => {
        el.removeEventListener('pointermove', onPointerMove);
        el.removeEventListener('pointerup', onPointerUp);
        el.removeEventListener('pointercancel', onPointerUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', onPointerUp);
      el.addEventListener('pointercancel', onPointerUp);
    },
    [widthRef, onWidthChange, reverse],
  );

  return (
    <div
      className="col-resizer"
      onPointerDown={handlePointerDown}
      style={{ touchAction: 'none' }}
    />
  );
}

// ---------------------------------------------------------------------------
// JSX snippet builder (for copy-to-clipboard)
// ---------------------------------------------------------------------------

function buildJsxString({
  example,
  defaultFile,
  defaultTab,
  defaultEntryFile,
  entryFilter,
  highlight,
  img,
  schema,
}: {
  example: string;
  defaultFile: string;
  defaultTab: PreviewTab;
  defaultEntryFile: string;
  entryFilter: string;
  highlight: string;
  img: string;
  schema: string;
}): string {
  const props: string[] = [`example="${example}"`];
  if (defaultFile) props.push(`defaultFile="${defaultFile}"`);
  if (defaultTab !== 'web') props.push(`defaultTab="${defaultTab}"`);
  if (defaultEntryFile) props.push(`defaultEntryFile="${defaultEntryFile}"`);
  if (highlight) props.push(`highlight="${highlight}"`);
  if (entryFilter) {
    if (entryFilter.includes(',')) {
      props.push(
        `entry={${JSON.stringify(entryFilter.split(',').map((s) => s.trim()))}}`,
      );
    } else {
      props.push(`entry="${entryFilter}"`);
    }
  }
  if (schema) props.push(`schema="${schema}"`);
  if (img) props.push(`img="${img}"`);

  if (props.length <= 2) {
    return `<Go ${props.join(' ')} />`;
  }
  return `<Go\n${props.map((p) => `  ${p}`).join('\n')}\n/>`;
}

// ---------------------------------------------------------------------------
// Shiki highlighter (lazy singleton for metadata JSON)
// ---------------------------------------------------------------------------

let _highlighterP: Promise<any> | null = null;
function getJsonHighlighter() {
  if (!_highlighterP) {
    _highlighterP = import('shiki').then((m) =>
      m.createHighlighter({
        themes: ['github-light', 'github-dark'],
        langs: ['json'],
      }),
    );
  }
  return _highlighterP;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Given an entry name (from bundle filename, e.g. "gallery-autoscroll") and the
 * full file list, find the actual source directory and index file.
 *
 * Entry keys in lynx.config.ts may differ in casing/hyphenation from source
 * directory names (e.g. entry "gallery-autoscroll" → dir "GalleryAutoScroll"),
 * so we normalize both sides by stripping hyphens and comparing lowercase.
 */
function findEntrySourceDir(
  entryName: string,
  files: string[],
): { srcDir: string; indexFile: string | undefined } | undefined {
  const normalize = (s: string) => s.replace(/-/g, '').toLowerCase();
  const target = normalize(entryName);
  for (const f of files) {
    const m = f.match(/^src\/([^/]+)\/index\.\w+$/);
    if (m) {
      const dirName = m[1];
      if (normalize(dirName) === target) {
        return { srcDir: `src/${dirName}`, indexFile: f };
      }
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
  const initial = useMemo(() => readUrlState(), []);

  const [lang, setLang] = useState<Lang>(initial.lang ?? 'en');
  const [dark, setDark] = useState(
    () =>
      initial.dark ?? window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const [defaultTab, setDefaultTab] = useState<PreviewTab>(
    initial.tab ?? 'web',
  );
  const [example, setExample] = useState(initial.example ?? 'hello-world');
  const [defaultFile, setDefaultFile] = useState(
    initial.file ?? ((initial.example ?? 'hello-world').startsWith('vue-') ? 'src/App.vue' : 'src/App.tsx'),
  );
  const [version, setVersion] = useState<string | undefined>(
    initial.version ??
      ((import.meta.env.EXAMPLES ?? []).find(
        (e: { name: string; version: string }) =>
          e.name === (initial.example ?? 'hello-world'),
      )?.version || undefined),
  );
  const [copied, setCopied] = useState(false);
  const [exampleSearch, setExampleSearch] = useState('');
  const [entrySearch, setEntrySearch] = useState('');

  // Runtime: fetch example list and versions from npm
  const { packages: examplePackages, source: packagesSource } =
    useExamplePackages();
  const EXAMPLES = useMemo(
    () => examplePackages.map((p) => p.shortName),
    [examplePackages],
  );
  // Derive the full package name from the packages list (scope-aware).
  const currentPkg = examplePackages.find((p) => p.shortName === example);
  const currentPkgName = currentPkg?.name ?? `@lynx-example/${example}`;

  // The version that was pinned when this site was built (from build-time EXAMPLES).
  const getBuildVersion = useCallback(
    (name: string) =>
      (import.meta.env.EXAMPLES ?? []).find(
        (e: { name: string; version: string }) => e.name === name,
      )?.version ?? '',
    [],
  );
  const buildVersion = getBuildVersion(example);

  const { versions: packageVersions } = usePackageVersions(currentPkgName);

  // Auto-select the newest concrete version once packageVersions loads.
  // Never pass the virtual 'latest' tag to jsdelivr; the data API requires real semver.
  const effectiveVersion =
    version ?? currentPkg?.version ?? packageVersions[0]?.version;

  // Fallback: if no build version is known for this example (e.g. a newly
  // published package not yet in the build), auto-select the newest live version.
  useEffect(() => {
    if (!version && !buildVersion && packageVersions.length > 0) {
      setVersion(packageVersions[0].version);
    }
  }, [version, buildVersion, packageVersions]);

  // Metadata & entry state
  const [metadata, setMetadata] = useState<Record<string, any> | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState('');
  const [defaultEntryFile, setDefaultEntryFile] = useState('');
  const [entryFilter, setEntryFilter] = useState('');
  const [highlight, setHighlight] = useState('');
  const [img, setImg] = useState('');
  const [schema, setSchema] = useState('');
  const [propsOpen, setPropsOpen] = useState(true);
  const [ssgOpen, setSsgOpen] = useState(false);
  const [jsxDialogOpen, setJsxDialogOpen] = useState(false);
  const [jsxCopied, setJsxCopied] = useState(false);
  const jsxPreRef = useRef<HTMLPreElement>(null);
  const [metadataHtml, setMetadataHtml] = useState('');

  // Resizable column widths
  const col1Ref = useRef(220);
  const col2Ref = useRef(220);
  const col3Ref = useRef(220);
  const col4Ref = useRef(220);
  const [col1W, setCol1W] = useState(220);
  const [col2W, setCol2W] = useState(220);
  const [col3W, setCol3W] = useState(220);
  const [col4W, setCol4W] = useState(220);

  const setCol1 = useCallback((w: number) => { col1Ref.current = w; setCol1W(w); }, []);
  const setCol2 = useCallback((w: number) => { col2Ref.current = w; setCol2W(w); }, []);
  const setCol3 = useCallback((w: number) => { col3Ref.current = w; setCol3W(w); }, []);
  const setCol4 = useCallback((w: number) => { col4Ref.current = w; setCol4W(w); }, []);

  const jsxString = useMemo(
    () =>
      buildJsxString({
        example,
        defaultFile,
        defaultTab,
        defaultEntryFile,
        entryFilter,
        highlight,
        img,
        schema,
      }),
    [
      example,
      defaultFile,
      defaultTab,
      defaultEntryFile,
      entryFilter,
      highlight,
      img,
      schema,
    ],
  );

  const copyJsx = useCallback(() => {
    navigator.clipboard.writeText(jsxString);
    setJsxCopied(true);
    setTimeout(() => setJsxCopied(false), 1500);
  }, [jsxString]);

  // Auto-select code when JSX dialog opens
  useEffect(() => {
    if (jsxDialogOpen && jsxPreRef.current) {
      const range = document.createRange();
      range.selectNodeContents(jsxPreRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [jsxDialogOpen]);

  // Close dialog on Escape
  useEffect(() => {
    if (!jsxDialogOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setJsxDialogOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [jsxDialogOpen]);

  // Persist state to URL hash
  useEffect(() => {
    writeUrlState({
      dark,
      lang,
      tab: defaultTab,
      file: defaultFile,
      example,
      version,
    });
  }, [dark, lang, defaultTab, defaultFile, example, version]);

  // Apply Semi UI dark/light mode
  useEffect(() => {
    document.body.setAttribute('theme-mode', dark ? 'dark' : 'light');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);

  // Sync with system preference
  useEffect(() => {
    if (initial.dark != null) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+D toggles dark mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        setDark((d) => !d);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Fetch example metadata when example or version changes.
  // Use effectiveVersion (resolved semver) because the jsdelivr data API
  // does not accept dist-tags like 'latest'.
  useEffect(() => {
    if (!effectiveVersion) return; // still resolving 'latest', wait
    setMetadata(null);
    setMetadataLoading(true);
    setEntrySearch('');

    const metadataPromise = fetchExampleMetadata(currentPkgName, effectiveVersion);

    metadataPromise
      .then((data) => {
        setMetadata(data);
        const first = data.templateFiles?.[0];
        if (first) {
          setSelectedEntry(first.name);
          setDefaultEntryFile(first.file);
          if (data.templateFiles.length > 1) {
            const found = findEntrySourceDir(first.name, data.files ?? []);
            setDefaultFile(found?.indexFile ?? `src/${first.name}/index.tsx`);
            setEntryFilter(found?.srcDir ?? `src/${first.name}`);
          } else {
            setEntryFilter('');
          }
        }
        setHighlight('');
        setImg(data.previewImage || '');
        setSchema('');
      })
      .catch(() => setMetadata(null))
      .finally(() => setMetadataLoading(false));
  }, [example, effectiveVersion]);

  // Highlight metadata JSON with shiki
  useEffect(() => {
    if (!metadata) {
      setMetadataHtml('');
      return;
    }
    const json = JSON.stringify(metadata, null, 2);
    getJsonHighlighter().then((hl) => {
      setMetadataHtml(
        hl.codeToHtml(json, {
          lang: 'json',
          themes: { light: 'github-light', dark: 'github-dark' },
        }),
      );
    });
  }, [metadata]);

  const handleEntryChange = useCallback(
    (entryName: string) => {
      setSelectedEntry(entryName);
      const entry = metadata?.templateFiles?.find(
        (t: any) => t.name === entryName,
      );
      if (entry) {
        setDefaultEntryFile(entry.file);
        if (metadata!.templateFiles.length > 1) {
          const found = findEntrySourceDir(entryName, metadata!.files ?? []);
          setDefaultFile(found?.indexFile ?? `src/${entryName}/index.tsx`);
          setEntryFilter(found?.srcDir ?? `src/${entryName}`);
        }
      }
    },
    [metadata],
  );

  const copyShareLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  const goConfig: GoConfig = {
    exampleBasePath: '/lynx-examples', // fallback for non-versioned mode
    defaultTab,
    explorerUrl: {
      en: 'https://lynxjs.org/guide/start/quick-start.html#download-lynx-explorer',
      cn: 'https://lynxjs.org/zh/guide/start/quick-start.html#download-lynx-explorer',
    },
    explorerText: 'Lynx Explorer',
    useI18n: () => (key: string) =>
      translations[lang]?.[key] ?? translations.en[key] ?? key,
    useLang: () => lang,
    useDark: () => dark,
    CodeBlock: StandaloneCodeBlock,
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      {/* ── Toolbar card (header + collapsible props) ── */}
      <div
        style={{
          marginBottom: 20,
          borderRadius: 10,
          background: 'var(--sb-surface)',
          border: '1px solid var(--sb-border)',
          overflow: 'hidden',
          fontSize: 13,
          fontFamily: 'var(--sb-font-mono)',
        }}
      >
        {/* Header row — click to toggle panel */}
        <header
          className="toolbar-header"
          onClick={() => setPropsOpen((v) => !v)}
          style={{ cursor: 'pointer' }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginRight: 'auto',
            }}
          >
            <img
              src={dark ? LOGO_DARK : LOGO_LIGHT}
              alt="Lynx"
              style={{ height: 20 }}
            />
            <span
              style={{
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: '0.5px',
                color: 'var(--sb-text-dim)',
              }}
            >
              {'<Go> with Examples'}
            </span>
          </span>

          {/* Stop interactive controls from toggling the panel */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'contents' }}
          >
            <ControlGroup label="Theme">
              <AdaptiveControl
                value={dark ? 'dark' : 'light'}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
                onChange={(v) => setDark(v === 'dark')}
              />
            </ControlGroup>

            <ControlGroup label="Lang">
              <AdaptiveControl
                value={lang}
                options={[
                  { value: 'en', label: 'EN' },
                  { value: 'zh', label: '中文' },
                ]}
                onChange={(v) => setLang(v as Lang)}
              />
            </ControlGroup>

            <ControlGroup label="Tab">
              <AdaptiveControl
                value={defaultTab}
                options={[
                  { value: 'web', label: 'Web' },
                  { value: 'qrcode', label: 'QR' },
                ]}
                onChange={(v) => setDefaultTab(v as PreviewTab)}
              />
            </ControlGroup>

            {/* JSX button */}
            <button
              className="toolbar-btn"
              onClick={() => setJsxDialogOpen(true)}
              title="Embed code"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <polyline points="5 3 1 8 5 13" />
                <polyline points="11 3 15 8 11 13" />
              </svg>
              <span className="btn-label">Embed</span>
            </button>

            {/* Share URL button — icon flashes accent on copy */}
            <button
              className={`toolbar-btn${copied ? ' toolbar-btn-flash' : ''}`}
              onClick={copyShareLink}
              title="Copy shareable URL"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                {copied ? (
                  <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                ) : (
                  <>
                    <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" />
                    <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" />
                  </>
                )}
              </svg>
              <span className="btn-label">Share</span>
            </button>
          </div>
        </header>

        {/* Collapsible props content */}
        {propsOpen && (
          <div
            style={{
              borderTop: '1px solid var(--sb-border)',
              background: 'var(--sb-bg)',
              display: 'flex',
              overflowX: 'auto',
            }}
          >
            {/* Col 1: examples list */}
            <div
              style={{
                flex: `0 0 ${col1W}px`,
                padding: '10px 12px',
                overflow: 'auto',
                maxHeight: 200,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              <div
                style={{
                  ...panelLabelStyle,
                  padding: '0 4px',
                  marginBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>Examples</span>
                <SourceBadge source={packagesSource} count={EXAMPLES.length} />
                <input
                  type="text"
                  value={exampleSearch}
                  onChange={(e) => setExampleSearch(e.target.value)}
                  placeholder="Filter…"
                  style={{
                    flex: 1,
                    padding: '1px 5px',
                    borderRadius: 4,
                    border: '1px solid var(--sb-border)',
                    background: 'transparent',
                    color: 'inherit',
                    fontSize: 10,
                    fontFamily: 'inherit',
                    outline: 'none',
                    minWidth: 0,
                  }}
                />
              </div>
              {EXAMPLES.filter(
                (name) =>
                  !exampleSearch ||
                  name.toLowerCase().includes(exampleSearch.toLowerCase()),
              ).map((name) => {
                const source = getExampleSource(name);
                const displayName =
                  source === 'vue' ? name.replace(/^vue-/, '') : name;
                return (
                  <button
                    key={name}
                    className="entry-list-btn"
                    data-active={example === name}
                    onClick={() => {
                      setExample(name);
                      setVersion(getBuildVersion(name) || undefined);
                      setDefaultFile(
                        source === 'vue' ? 'src/App.vue' : 'src/App.tsx',
                      );
                    }}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 5,
                      border: 'none',
                      background:
                        example === name ? 'var(--sb-accent)' : 'transparent',
                      color: example === name ? '#fff' : 'var(--sb-text-dim)',
                      fontSize: 11,
                      fontFamily: 'var(--sb-font-mono)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      whiteSpace: 'nowrap',
                      transition: 'background 0.12s, color 0.12s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {displayName}
                    {source === 'vue' && (
                      <span
                        className="example-tag example-tag-vue"
                        style={{
                          fontSize: 9,
                          padding: '0 4px',
                          borderRadius: 3,
                          lineHeight: '16px',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        Vue
                      </span>
                    )}
                    {example === name && (() => {
                      const pkg = examplePackages.find(p => p.shortName === name);
                      const displayVer = version ?? pkg?.version;
                      return displayVer ? (
                        <span
                          style={{
                            fontSize: 9,
                            padding: '0 4px',
                            borderRadius: 3,
                            lineHeight: '16px',
                            fontWeight: 500,
                            flexShrink: 0,
                            background: 'rgba(255,255,255,0.25)',
                            color: 'inherit',
                            marginLeft: 'auto',
                          }}
                        >
                          v{displayVer}
                        </span>
                      ) : null;
                    })()}
                  </button>
                );
              })}
            </div>

            <ColumnResizer widthRef={col1Ref} onWidthChange={setCol1} />

            {/* Col 2: entry list */}
            <div
              style={{
                flex: `0 0 ${col2W}px`,
                padding: '10px 12px',
                overflow: 'auto',
                maxHeight: 200,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              <div
                style={{
                  ...panelLabelStyle,
                  padding: '0 4px',
                  marginBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ flexShrink: 0 }}>Entries</span>
                <input
                  type="text"
                  value={entrySearch}
                  onChange={(e) => setEntrySearch(e.target.value)}
                  placeholder="Filter…"
                  style={{
                    flex: 1,
                    padding: '1px 5px',
                    borderRadius: 4,
                    border: '1px solid var(--sb-border)',
                    background: 'transparent',
                    color: 'inherit',
                    fontSize: 10,
                    fontFamily: 'inherit',
                    outline: 'none',
                    minWidth: 40,
                  }}
                />
                <select
                  value={version ?? ''}
                  onChange={(e) => setVersion(e.target.value || undefined)}
                  style={{
                    ...selectStyle,
                    fontSize: 10,
                    padding: '1px 20px 1px 6px',
                    borderRadius: 4,
                    flexShrink: 0,
                  }}
                >
                  {packageVersions.length === 0 && (
                    <option value="" disabled>Loading…</option>
                  )}
                  {packageVersions.map((v) => (
                    <option key={v.version} value={v.version}>
                      {v.version}{v.version === buildVersion ? ' (build)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {metadata?.templateFiles?.filter(
                (t: any) =>
                  !entrySearch ||
                  t.name.toLowerCase().includes(entrySearch.toLowerCase()),
              ).map((t: any) => (
                <button
                  key={t.name}
                  className="entry-list-btn"
                  data-active={selectedEntry === t.name}
                  onClick={() => handleEntryChange(t.name)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 5,
                    border: 'none',
                    background:
                      selectedEntry === t.name
                        ? 'var(--sb-accent)'
                        : 'transparent',
                    color:
                      selectedEntry === t.name ? '#fff' : 'var(--sb-text-dim)',
                    fontSize: 11,
                    fontFamily: 'var(--sb-font-mono)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    transition: 'background 0.12s, color 0.12s',
                  }}
                >
                  {t.name}
                  {t.webFile ? '' : ' *'}
                </button>
              ))}
              {!metadata && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--sb-text-dim)',
                    padding: '3px 8px',
                  }}
                >
                  {metadataLoading ? 'Loading…' : '—'}
                </span>
              )}
            </div>

            <ColumnResizer widthRef={col2Ref} onWidthChange={setCol2} />

            {/* Col 3: controls */}
            <div
              style={{
                flex: `0 0 ${col3W}px`,
                minWidth: 160,
                padding: '10px 16px',
                overflow: 'hidden',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: '5px 10px',
                alignItems: 'center',
                alignContent: 'start',
              }}
            >
              <span style={panelLabelStyle}>File</span>
              <input
                type="text"
                value={defaultFile}
                onChange={(e) => setDefaultFile(e.target.value)}
                style={panelInputStyle}
              />

              <span style={panelLabelStyle}>Entry File</span>
              <input
                type="text"
                value={defaultEntryFile}
                onChange={(e) => setDefaultEntryFile(e.target.value)}
                style={panelInputStyle}
                placeholder="dist/main.lynx.bundle"
              />

              <span style={panelLabelStyle}>Entry Filter</span>
              <input
                type="text"
                value={entryFilter}
                onChange={(e) => setEntryFilter(e.target.value)}
                style={panelInputStyle}
                placeholder="src/sizing"
              />

              <span style={panelLabelStyle}>Highlight</span>
              <input
                type="text"
                value={highlight}
                onChange={(e) => setHighlight(e.target.value)}
                style={panelInputStyle}
                placeholder="{5-10}"
              />

              <span style={panelLabelStyle}>Img</span>
              <input
                type="text"
                value={img}
                onChange={(e) => setImg(e.target.value)}
                style={panelInputStyle}
                placeholder="https://..."
              />

              <span style={panelLabelStyle}>Schema</span>
              <input
                type="text"
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
                style={panelInputStyle}
                placeholder="lynx://..."
              />
            </div>

            <ColumnResizer widthRef={col3Ref} onWidthChange={setCol3} />

            {/* Col 4: metadata JSON */}
            <div
              style={{
                flex: `0 0 ${col4W}px`,
                minWidth: 0,
                padding: '10px 16px',
                overflow: 'auto',
                maxHeight: 200,
              }}
            >
              <div style={{ ...panelLabelStyle, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                example-metadata.json
                {metadata?.version && (
                  <span className="example-tag example-tag-version">
                    {metadata.version}
                  </span>
                )}
                {metadata?.reactLynxVersion && (
                  <span className="example-tag example-tag-react">
                    react {metadata.reactLynxVersion}
                  </span>
                )}
                {metadata?.vueLynxVersion && (
                  <span className="example-tag example-tag-vue">
                    vue-lynx {metadata.vueLynxVersion}
                  </span>
                )}
                {metadata?.templateFiles?.length > 0 && (
                  <span
                    className={`example-tag ${
                      metadata.templateFiles.some((t: any) => t.webFile)
                        ? 'example-tag-web'
                        : 'example-tag-no-web'
                    }`}
                  >
                    {metadata.templateFiles.some((t: any) => t.webFile)
                      ? 'Web'
                      : 'No Web'}
                  </span>
                )}
              </div>
              {metadataHtml ? (
                <div
                  className="metadata-shiki"
                  dangerouslySetInnerHTML={{ __html: metadataHtml }}
                />
              ) : (
                <pre
                  style={{
                    margin: 0,
                    fontSize: 11,
                    lineHeight: 1.5,
                    fontFamily: 'var(--sb-font-mono)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    color: 'inherit',
                  }}
                >
                  {metadataLoading ? 'Loading…' : 'No metadata'}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Go component(s) — Desktop + Mobile ── */}
      {/* App-level concern: don't render Go until we have a resolved CDN version.
          This avoids the useCdn=false → useCdn=true double-mount when
          effectiveVersion transitions from undefined to a real semver. */}
      <main>
        <PreviewErrorBoundary>
          <GoConfigProvider config={goConfig}>
            {effectiveVersion ? (
              <div className="dual-view">
                {/* Desktop */}
                <div style={{ flex: '1 1 500px', minWidth: 0 }}>
                  <Go
                    key={`desktop-${example}-${selectedEntry}-${defaultTab}-${effectiveVersion}`}
                    example={example}
                    defaultFile={defaultFile}
                    defaultTab={defaultTab}
                    defaultEntryFile={defaultEntryFile || undefined}
                    entry={entryFilter || undefined}
                    highlight={highlight || undefined}
                    img={img || undefined}
                    schema={schema || undefined}
                    version={effectiveVersion}
                  />
                  <div className="figure-caption">Desktop</div>
                </div>
                {/* Mobile — fixed 320×660 */}
                <div
                  className="mobile-preview"
                  style={{
                    flex: '0 0 320px',
                    maxWidth: 320,
                    overflow: 'hidden',
                    containerType: 'inline-size' as any,
                  }}
                >
                  <div
                    style={{
                      height: 660,
                      overflow: 'hidden',
                      borderRadius: 16,
                    }}
                  >
                    <Go
                      key={`mobile-${example}-${selectedEntry}-${defaultTab}-${effectiveVersion}`}
                      example={example}
                      defaultFile={defaultFile}
                      defaultTab={defaultTab}
                      defaultEntryFile={defaultEntryFile || undefined}
                      entry={entryFilter || undefined}
                      highlight={highlight || undefined}
                      img={img || undefined}
                      schema={schema || undefined}
                      version={effectiveVersion}
                    />
                  </div>
                  <div className="figure-caption">Mobile (320 × 660)</div>
                </div>
              </div>
            ) : (
              <div className="dual-view" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
                <span style={{ color: 'var(--semi-color-text-2)', fontSize: 13 }}>
                  Resolving package version…
                </span>
              </div>
            )}
          </GoConfigProvider>
        </PreviewErrorBoundary>
      </main>

      {/* ── SSG Preview panel ── */}
      {SSG_PREVIEWS[example] && (
        <div
          style={{
            marginTop: 20,
            borderRadius: 10,
            background: 'var(--sb-surface)',
            border: '1px solid var(--sb-border)',
            overflow: 'hidden',
            fontSize: 13,
            fontFamily: 'var(--sb-font-mono)',
          }}
        >
          <button
            onClick={() => setSsgOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              fontSize: 13,
              fontFamily: 'inherit',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transition: 'transform 0.15s',
                transform: ssgOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            >
              &#9654;
            </span>
            <span style={{ fontWeight: 600 }}>SSG Preview</span>
            <span style={{ color: 'var(--sb-text-dim)', fontSize: 11 }}>
              Raw markdown output from ExamplePreviewSSG
            </span>
          </button>
          {ssgOpen && (
            <pre
              style={{
                borderTop: '1px solid var(--sb-border)',
                padding: 16,
                margin: 0,
                background: 'var(--sb-bg)',
                fontSize: 12,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {SSG_PREVIEWS[example]}
            </pre>
          )}
        </div>
      )}

      {/* ── JSX dialog ── */}
      {jsxDialogOpen && (
        <div
          className="jsx-dialog-backdrop"
          onClick={() => setJsxDialogOpen(false)}
        >
          <div className="jsx-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="jsx-dialog-header">
              <span>JSX Snippet</span>
              <button
                className="jsx-dialog-close"
                onClick={() => setJsxDialogOpen(false)}
              >
                ×
              </button>
            </div>
            <pre ref={jsxPreRef}>{jsxString}</pre>
            <div className="jsx-dialog-footer">
              <button className="toolbar-btn" onClick={copyJsx}>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" />
                  <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" />
                </svg>
                {jsxCopied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
