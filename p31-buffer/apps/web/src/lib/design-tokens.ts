/**
 * P31 design tokens — shared by onboarding, connection panel, and UI.
 * Single source for colors, spacing, typography, and layout constants.
 */

export const COLORS = {
  text: {
    dim: '#6b7280',
    primary: '#111827',
    inverse: '#f9fafb',
    secondary: '#4b5563',
  },
  state: {
    green: '#22c55e',
    blue: '#3b82f6',
    yellow: '#eab308',
    orange: '#f97316',
    red: '#ef4444',
  },
  bg: {
    base: '#f9fafb',
    deep: '#111827',
    border: '#e5e7eb',
    surface: '#f3f4f6',
  },
  accent: {
    primary: '#3b82f6',
  },
  axis: {
    A: '#22c55e',
    B: '#3b82f6',
    C: '#eab308',
    D: '#f97316',
  },
  /** IVM node orbs: Identity / Health / Environment / Technical (r128 single-mesh colors) */
  ivmNode: {
    A: '#ff6b6b',
    B: '#4ecdc4',
    C: '#ffe66d',
    D: '#a29bfe',
  },
  tier: {
    FULL: '#22c55e',
    ONLINE: '#3b82f6',
    LOCAL: '#eab308',
    OFFLINE: '#f97316',
  },
} as const;

export const FONTS = {
  sans: 'system-ui, -apple-system, sans-serif',
  mono: 'ui-monospace, monospace',
  size: {
    micro: '0.375rem',
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    '2xl': '1.5rem',
  },
  weight: {
    light: 300,
    medium: 500,
    bold: 700,
  },
  tracking: {
    micro: '0.125em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.15em',
  },
  leading: {
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
  },
} as const;

export const SPACE: Record<string, string> = {
  0: '0',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  6: '1.5rem',
  8: '2rem',
};

export const BORDER = {
  radius: { sm: '4px', md: '8px', full: '9999px' },
  width: { thin: '1px', medium: '2px' },
} as const;

export const TRANSITION = {
  fast: '150ms ease',
  normal: '200ms ease',
  slow: '300ms ease',
} as const;

export const SHADOW = {
  panel: '-4px 0 24px rgba(0,0,0,0.4)',
} as const;

export const LAYOUT = {
  copyMaxWidth: '320px',
  iconSize: '20px',
  panelWidth: '380px',
} as const;

const baseInput = {
  fontFamily: 'ui-monospace, monospace',
  fontSize: '0.75rem',
  padding: '0.25rem 0.5rem',
  border: '1px solid #e5e7eb',
  borderRadius: '4px',
  color: '#111827',
  background: '#fff',
};

const baseButton = {
  fontFamily: 'ui-monospace, monospace',
  fontSize: '0.75rem',
  padding: '0.25rem 0.5rem',
  border: '1px solid #e5e7eb',
  borderRadius: '4px',
  background: '#f3f4f6',
  color: '#111827',
  cursor: 'pointer' as const,
};

export const PATTERNS = {
  sectionLabel: { fontSize: FONTS.size.xs, fontFamily: FONTS.mono, color: COLORS.text.dim },
  input: baseInput,
  filterButton: baseButton,
  filterButtonActive: { ...baseButton, background: COLORS.state.blue, color: '#fff', borderColor: COLORS.state.blue },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem' },
} as const;

export const Z = {
  dropdown: 100,
  overlay: 200,
  modal: 300,
} as const;
