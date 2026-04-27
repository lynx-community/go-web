/**
 * @lynx-js/go-web Iframe Embed API
 *
 * Pure JS entry point — zero React dependency.
 * Creates an iframe that loads the Go component, communicating via postMessage.
 *
 * Usage:
 * ```html
 * <div id="demo" style="height: 500px;"></div>
 * <script type="module">
 *   import { mount } from 'https://your-site.com/embed.js';
 *   mount('#demo', {
 *     example: 'hello-world',
 *     defaultFile: 'src/App.tsx',
 *   });
 * </script>
 * ```
 */

export type EmbedOptions = {
  /** Example name (folder name under exampleBasePath) */
  example: string;
  /** Initial file to display */
  defaultFile?: string;
  /** Default preview tab */
  defaultTab?: 'preview' | 'web' | 'qrcode';
  /** Static preview image URL */
  img?: string;
  /** Default entry file for web preview */
  defaultEntryFile?: string;
  /**
   * Default entry name from example-metadata.json (templateFiles[].name).
   * Used when defaultEntryFile is not provided.
   */
  defaultEntryName?: string;
  /** Code highlight spec, e.g. '{1,3-5}' */
  highlight?: string | Record<string, string>;
  /** Filter entry files in tree */
  entry?: string | string[];
  /** Hide the header bar for minimal embeds */
  seamless?: boolean;
  /** Web preview viewport mode */
  webPreviewMode?: 'fit' | 'responsive' | 'auto';
  /** Design canvas width for fit mode */
  designWidth?: number;
  /** Design canvas height for fit mode */
  designHeight?: number;
  /** Auto mode width threshold multiplier */
  fitThresholdScale?: number;
  /** Auto mode height lower-bound multiplier */
  fitMinScale?: number;
  /**
   * Base path (or full URL) for example assets.
   * Defaults to '/lynx-examples'. Use a full URL for cross-origin data,
   * e.g. 'https://go.lynxjs.org/lynx-examples'.
   */
  exampleBasePath?: string;
};

export type EmbedControl = {
  iframe: HTMLIFrameElement;
  /** Update the displayed example */
  update: (options: Partial<EmbedOptions>) => void;
  /** Remove the embed and clean up listeners */
  destroy: () => void;
};

type EmbedReadyMessage = {
  type: 'go-embed:ready';
};

type EmbedInitMessage = {
  type: 'go-embed:init';
  options: EmbedOptions;
};

type EmbedUpdateMessage = {
  type: 'go-embed:update';
  options: Partial<EmbedOptions>;
};

function isEmbedReadyMessage(data: unknown): data is EmbedReadyMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: string }).type === 'go-embed:ready'
  );
}

/**
 * Resolve the embed.html URL relative to this script's location.
 * Works because embed.js and embed.html are co-located in the build output.
 */
function getEmbedUrl(): string {
  return new URL('embed.html', import.meta.url).href;
}

/**
 * Mount a Go interactive example embed into a container element.
 *
 * @param container - CSS selector or DOM element
 * @param options - Example configuration
 * @returns Control object to update or destroy the embed
 */
export function mount(
  container: string | HTMLElement,
  options: EmbedOptions,
): EmbedControl {
  const el =
    typeof container === 'string'
      ? document.querySelector<HTMLElement>(container)
      : container;

  if (!el) {
    throw new Error(`@lynx-js/go-web embed: container not found: ${container}`);
  }

  const embedUrl = new URL(getEmbedUrl());
  if (options.seamless) {
    embedUrl.searchParams.set('seamless', '1');
  }

  const iframe = document.createElement('iframe');
  iframe.src = embedUrl.href;
  iframe.style.cssText =
    'width: 100%; height: 100%; border: none; border-radius: 8px;';

  let currentOptions = { ...options };

  const handleMessage = (event: MessageEvent<unknown>): void => {
    if (event.source !== iframe.contentWindow) return;

    if (isEmbedReadyMessage(event.data)) {
      const initMessage: EmbedInitMessage = {
        type: 'go-embed:init',
        options: currentOptions,
      };
      iframe.contentWindow?.postMessage(initMessage, '*');
    }
  };

  window.addEventListener('message', handleMessage);

  el.innerHTML = '';
  el.appendChild(iframe);

  return {
    iframe,
    update(newOptions: Partial<EmbedOptions>): void {
      currentOptions = { ...currentOptions, ...newOptions };
      const updateMessage: EmbedUpdateMessage = {
        type: 'go-embed:update',
        options: newOptions,
      };
      iframe.contentWindow?.postMessage(updateMessage, '*');
    },
    destroy(): void {
      window.removeEventListener('message', handleMessage);
      el.innerHTML = '';
    },
  };
}
