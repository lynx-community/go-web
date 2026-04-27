/**
 * Embed entry point — renders inside the iframe created by src/embed.ts.
 *
 * Listens for postMessage from the parent to receive example configuration,
 * then renders a Go component with GoConfigProvider.
 */
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@douyinfe/semi-ui/dist/css/semi.min.css';
import { GoConfigProvider, Go } from '../../src/index';
import type { GoConfig } from '../../src/config';
import type { ShikiTransformer, BundledLanguage } from 'shiki';
import './styles.css';

// ---------------------------------------------------------------------------
// Shiki CodeBlock (reused from main.tsx)
// ---------------------------------------------------------------------------

type ShikiHighlighter = Awaited<
  ReturnType<(typeof import('shiki'))['createHighlighter']>
>;

let _codeHighlighterP: Promise<ShikiHighlighter> | null = null;
function getCodeHighlighter(): Promise<ShikiHighlighter> {
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

  if (!html) {
    return (
      <pre style={{ padding: '16px', margin: 0, overflow: 'auto' }}>
        <code>{code}</code>
      </pre>
    );
  }
  return (
    <div className="rp-codeblock" dangerouslySetInnerHTML={{ __html: html }} />
  );
};

// ---------------------------------------------------------------------------
// Embed options type (mirrors src/embed.ts)
// ---------------------------------------------------------------------------

type EmbedOptions = {
  example: string;
  defaultFile?: string;
  defaultTab?: 'preview' | 'web' | 'qrcode';
  img?: string;
  defaultEntryFile?: string;
  defaultEntryName?: string;
  highlight?: string | Record<string, string>;
  entry?: string | string[];
  seamless?: boolean;
  exampleBasePath?: string;
  webPreview?: boolean;
  webPreviewMode?: 'fit' | 'responsive' | 'auto';
  designWidth?: number;
  designHeight?: number;
  fitThresholdScale?: number;
  fitMinScale?: number;
};

// ---------------------------------------------------------------------------
// EmbedApp
// ---------------------------------------------------------------------------

function EmbedApp() {
  const [options, setOptions] = useState<EmbedOptions | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; options?: EmbedOptions };

      if (data?.type === 'go-embed:init' && data.options) {
        setOptions(data.options);
      }

      if (data?.type === 'go-embed:update' && data.options) {
        setOptions((prev) => (prev ? { ...prev, ...data.options } : null));
      }
    };

    window.addEventListener('message', handleMessage);

    // Signal to parent that we're ready to receive options
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'go-embed:ready' }, '*');
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (!options) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#999',
          fontFamily: 'sans-serif',
        }}
      >
        Loading...
      </div>
    );
  }

  const goConfig: GoConfig = {
    exampleBasePath: options.exampleBasePath || '/lynx-examples',
    CodeBlock: StandaloneCodeBlock,
  };

  return (
    <GoConfigProvider config={goConfig}>
      <div style={{ height: '100%', overflow: 'hidden' }}>
        <Go
          key={`${options.exampleBasePath}/${options.example}`}
          example={options.example}
          defaultFile={
            options.defaultFile ??
            (options.example.startsWith('vue-') ? 'src/App.vue' : 'src/App.tsx')
          }
          defaultTab={options.defaultTab}
          img={options.img}
          defaultEntryFile={options.defaultEntryFile}
          defaultEntryName={options.defaultEntryName}
          highlight={options.highlight}
          entry={options.entry}
          webPreview={options.webPreview}
          webPreviewMode={options.webPreviewMode}
          designWidth={options.designWidth}
          designHeight={options.designHeight}
          fitThresholdScale={options.fitThresholdScale}
          fitMinScale={options.fitMinScale}
        />
      </div>
    </GoConfigProvider>
  );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const container = document.getElementById('embed-root')!;
const root = createRoot(container);
root.render(<EmbedApp />);
