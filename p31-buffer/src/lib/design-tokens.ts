/**
 * design-tokens.ts — P31 Buffer Design System
 * Single source of truth. Components import from here, not magic strings.
 */

export const COLORS = {
  bg: {
    deep: '#050510',
    base: '#0a0a1a',
    raised: '#111122',
    border: 'rgba(255,255,255,0.06)',
  },
  text: {
    primary: 'rgba(255,255,255,0.87)',
    secondary: 'rgba(255,255,255,0.54)',
    dim: 'rgba(255,255,255,0.28)',
    inverse: '#050510',
  },
  accent: {
    primary: '#00E878',
    secondary: '#4ecdc4',
    warm: '#F0B547',
  },
  axis: {
    A: '#ff6b6b',
    B: '#4ecdc4',
    C: '#ffe66d',
    D: '#a29bfe',
  },
  tier: {
    FULL: '#00E878',
    ONLINE: '#4488ff',
    LOCAL: '#F0B547',
    OFFLINE: '#555555',
  },
  state: {
    green: '#00E878',
    yellow: '#F0B547',
    orange: '#FF8C42',
    red: '#FF4444',
  },
} as const;

export const FONTS = {
  mono: "'DM Mono', 'Fira Code', 'SF Mono', monospace",
  size: {
    micro: '8px',
    xs: '10px',
    sm: '12px',
    base: '14px',
    lg: '18px',
    xl: '24px',
    '2xl': '32px',
  },
  weight: {
    light: 300,
    normal: 400,
    medium: 500,
    bold: 700,
  },
  tracking: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.05em',
    wider: '0.1em',
    widest: '0.2em',
    micro: '0.02em',
  },
  leading: {
    tight: '1.2',
    normal: '1.5',
    relaxed: '1.7',
  },
} as const;

export const SPACE: Record<number | string, string> = {
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  3: '12px',
  4: '16px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
};

export const BORDER = {
  width: { thin: '1px', medium: '2px' },
  radius: { sm: '4px', md: '8px', lg: '12px', full: '9999px' },
} as const;

export const SHADOW = {
  panel: '-4px 0 24px rgba(0,0,0,0.5)',
  card: '0 2px 8px rgba(0,0,0,0.3)',
} as const;

export const TRANSITION = {
  fast: 'all 0.15s ease',
  normal: 'all 0.3s ease',
  slow: 'all 0.6s ease',
} as const;

export const Z = {
  base: 0,
  telemetry: 100,
  breathing: 50,
  deepLock: 200,
  devMenu: 300,
  overlay: 400,
  modal: 500,
} as const;

export const LAYOUT = {
  panelWidth: '380px',
  iconSize: '24px',
  copyMaxWidth: '480px',
} as const;

// Reusable style patterns
export const PATTERNS = {
  input: {
    width: '100%',
    padding: `${SPACE[2]} ${SPACE[3]}`,
    background: COLORS.bg.raised,
    border: `${BORDER.width.thin} solid ${COLORS.bg.border}`,
    borderRadius: BORDER.radius.md,
    color: COLORS.text.primary,
    fontFamily: FONTS.mono,
    fontSize: FONTS.size.sm,
    outline: 'none',
  } as React.CSSProperties,

  filterButton: {
    background: 'transparent',
    border: `${BORDER.width.thin} solid ${COLORS.bg.border}`,
    borderRadius: BORDER.radius.md,
    color: COLORS.text.secondary,
    fontFamily: FONTS.mono,
    fontSize: FONTS.size.xs,
    letterSpacing: FONTS.tracking.wider,
    cursor: 'pointer',
    padding: `${SPACE[1.5]} ${SPACE[3]}`,
    transition: TRANSITION.fast,
  } as React.CSSProperties,

  filterButtonActive: {
    borderColor: COLORS.accent.primary,
    color: COLORS.accent.primary,
    background: 'rgba(0,232,120,0.06)',
  } as React.CSSProperties,

  sectionLabel: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    letterSpacing: FONTS.tracking.widest,
    color: COLORS.text.dim,
    textTransform: 'uppercase' as const,
    fontFamily: FONTS.mono,
  } as React.CSSProperties,

  card: {
    background: COLORS.bg.raised,
    border: `${BORDER.width.thin} solid ${COLORS.bg.border}`,
    borderRadius: BORDER.radius.md,
    padding: SPACE[4],
  } as React.CSSProperties,
} as const;
