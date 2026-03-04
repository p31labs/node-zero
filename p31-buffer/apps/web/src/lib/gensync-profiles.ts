import { FONTS, COLORS } from './design-tokens';

/**
 * GenSync: Generational Impedance Matching Profiles.
 * Maps communication styles to UI presentation.
 */

export type HumanOS = 'TECHNICAL' | 'EMPATHIC' | 'EXECUTIVE' | 'PLAIN';

export interface GenSyncProfile {
  os: HumanOS;
  label: string;
  description: string;
  font: string;
  colors: {
    accent: string;
    bg: string;
  };
  labels: {
    spoons: string;
    heartbeat: string;
    voltage: string;
    breathing: string;
  };
  voiceTone: string; // guidance for AI temperature/style
}

export const GENSYNC_PROFILES: Record<HumanOS, GenSyncProfile> = {
  TECHNICAL: {
    os: 'TECHNICAL',
    label: 'Technical',
    description: 'Systems language. Direct. Minimal abstraction.',
    font: FONTS.mono,
    colors: { accent: COLORS.accent.primary, bg: COLORS.bg.deep },
    labels: { spoons: '🥄', heartbeat: 'HEARTBEAT', voltage: 'VOLTAGE', breathing: 'BREATHE' },
    voiceTone: 'precise, terse, data-first',
  },
  EMPATHIC: {
    os: 'EMPATHIC',
    label: 'Empathic',
    description: 'Warm language. Feelings acknowledged. Gentle pacing.',
    font: FONTS.sans,
    colors: { accent: COLORS.axis.B, bg: COLORS.bg.base },
    labels: { spoons: '💛 Energy', 'heartbeat': 'How you\'re doing', voltage: 'Emotional weight', breathing: 'Take a breath' },
    voiceTone: 'warm, validating, unhurried',
  },
  EXECUTIVE: {
    os: 'EXECUTIVE',
    label: 'Executive',
    description: 'Bottom-line first. ROI framing. Action items.',
    font: FONTS.sans,
    colors: { accent: COLORS.axis.C, bg: COLORS.bg.surface },
    labels: { spoons: '⚡ Capacity', heartbeat: 'STATUS', voltage: 'PRIORITY', breathing: 'RESET' },
    voiceTone: 'concise, outcome-oriented, no preamble',
  },
  PLAIN: {
    os: 'PLAIN',
    label: 'Plain English',
    description: 'Simple words. Short sentences. No jargon.',
    font: FONTS.sans,
    colors: { accent: COLORS.state.blue, bg: COLORS.bg.base },
    labels: { spoons: 'Energy left', heartbeat: 'Feeling', voltage: 'How hard', breathing: 'Breathe' },
    voiceTone: 'simple, clear, supportive',
  },
};
