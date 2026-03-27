// D3.3 + D3.4: Srcdoc iframe sandbox with PostMessage telemetry bus
// User-compiled cartridges run in double-wrapped srcdoc iframes.
// Console output, errors, and telemetry relay back via postMessage.

export interface CartridgeTelemetry {
  type: 'log' | 'warn' | 'error' | 'uncaught' | 'unhandled' | 'ready' | 'render';
  payload: string;
  timestamp: number;
}

export type TelemetryHandler = (msg: CartridgeTelemetry) => void;

// ── PostMessage telemetry script injected into srcdoc ──
// Hijacks console.log/warn/error + window.onerror + unhandledrejection
const TELEMETRY_SCRIPT = `
<script>
(function() {
  var _post = function(type, payload) {
    try {
      window.parent.postMessage({
        channel: 'P31_CARTRIDGE',
        type: type,
        payload: String(payload).slice(0, 4096),
        timestamp: Date.now()
      }, '*');
    } catch(e) {}
  };

  // Hijack console
  var _log = console.log, _warn = console.warn, _error = console.error;
  console.log = function() {
    _log.apply(console, arguments);
    _post('log', Array.from(arguments).map(String).join(' '));
  };
  console.warn = function() {
    _warn.apply(console, arguments);
    _post('warn', Array.from(arguments).map(String).join(' '));
  };
  console.error = function() {
    _error.apply(console, arguments);
    _post('error', Array.from(arguments).map(String).join(' '));
  };

  // Uncaught errors
  window.onerror = function(msg, src, line, col, err) {
    _post('uncaught', msg + ' at ' + (src || '?') + ':' + line + ':' + col);
  };
  window.addEventListener('unhandledrejection', function(e) {
    _post('unhandled', e.reason ? String(e.reason) : 'Unhandled promise rejection');
  });

  // Signal ready
  _post('ready', 'Cartridge sandbox initialized');
})();
</script>`;

// ── CDN dependencies for srcdoc ──
const REACT_CDN = 'https://unpkg.com/react@19/umd/react.production.min.js';
const REACT_DOM_CDN = 'https://unpkg.com/react-dom@19/umd/react-dom.production.min.js';
const TAILWIND_CDN = 'https://cdn.tailwindcss.com';

/**
 * Build a complete srcdoc HTML string for a compiled cartridge.
 * The compiled code should be ES2015-compatible (already transpiled from JSX).
 */
export function buildSrcdoc(compiledCode: string, title: string = 'Cartridge'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <script src="${TAILWIND_CDN}"><\/script>
  <script src="${REACT_CDN}"><\/script>
  <script src="${REACT_DOM_CDN}"><\/script>
  <style>
    body { margin: 0; background: #000; color: #e0e0e0; font-family: system-ui, sans-serif; }
  </style>
  ${TELEMETRY_SCRIPT}
</head>
<body>
  <div id="root"></div>
  <script>
  (function() {
    try {
      var React = window.React;
      var useState = React.useState;
      var useEffect = React.useEffect;
      var useRef = React.useRef;
      var useMemo = React.useMemo;
      var useCallback = React.useCallback;

      ${compiledCode}

      // Find the component
      var Component = (typeof App !== 'undefined') ? App
        : (typeof Component !== 'undefined') ? Component
        : (typeof Default !== 'undefined') ? Default
        : null;

      if (Component && typeof Component === 'function') {
        var root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(Component));
        window.parent.postMessage({
          channel: 'P31_CARTRIDGE', type: 'render',
          payload: 'Component mounted', timestamp: Date.now()
        }, '*');
      } else {
        console.error('No component found. Define App, Component, or Default.');
      }
    } catch(e) {
      console.error('Cartridge error: ' + e.message);
    }
  })();
  <\/script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * D3.6: Validate a p31app.json manifest against the schema.
 */
export interface P31AppManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  permissions: P31Permission[];
  antiFeatures: P31AntiFeature[];
}

export type P31Permission =
  | 'p31:spoons'        // Read/write spoon count
  | 'p31:mode'          // Read/write skin theme
  | 'p31:love'          // Read LOVE balance
  | 'p31:telemetry'     // Write telemetry events
  | 'p31:audio';        // Play audio

export type P31AntiFeature =
  | 'has_chat'          // Contains chat/messaging
  | 'collects_data'     // Sends data externally
  | 'has_time_pressure' // Uses timers/countdowns
  | 'has_ads'           // Contains advertising
  | 'has_tracking';     // Analytics/tracking

const VALID_PERMISSIONS = new Set<string>([
  'p31:spoons', 'p31:mode', 'p31:love', 'p31:telemetry', 'p31:audio',
]);

const VALID_ANTI_FEATURES = new Set<string>([
  'has_chat', 'collects_data', 'has_time_pressure', 'has_ads', 'has_tracking',
]);

export function validateManifest(manifest: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be a JSON object'] };
  }

  const m = manifest as Record<string, unknown>;

  if (typeof m.name !== 'string' || m.name.length === 0) {
    errors.push('name: required string');
  }
  if (typeof m.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(m.version)) {
    errors.push('version: required semver string (e.g., "1.0.0")');
  }

  if (!Array.isArray(m.permissions)) {
    errors.push('permissions: required array');
  } else {
    for (const p of m.permissions) {
      if (!VALID_PERMISSIONS.has(p as string)) {
        errors.push(`permissions: unknown "${p}". Valid: ${[...VALID_PERMISSIONS].join(', ')}`);
      }
    }
  }

  if (!Array.isArray(m.antiFeatures)) {
    errors.push('antiFeatures: required array');
  } else {
    for (const af of m.antiFeatures) {
      if (!VALID_ANTI_FEATURES.has(af as string)) {
        errors.push(`antiFeatures: unknown "${af}". Valid: ${[...VALID_ANTI_FEATURES].join(', ')}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
