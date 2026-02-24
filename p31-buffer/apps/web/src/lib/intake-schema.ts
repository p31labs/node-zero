/**
 * P31 INTAKE PROTOCOL — Form schema for questionnaire.
 * Each field maps to an axis and voltage weight for GraphNode generation.
 */
import type { Axis } from '@p31-buffer/graph-schema';

export interface IntakeField {
  id: string;
  type: 'text' | 'email' | 'select' | 'multi_select' | 'scale' | 'boolean' | 'textarea' | 'date';
  label: string;
  placeholder?: string;
  help?: string;
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  unit?: string;
  rows?: number;
  voltageWeight: number;
  invertVoltage?: boolean;
}

export interface IntakeSection {
  id: string;
  axis: Axis;
  label: string;
  icon: string;
  fields: IntakeField[];
}

export interface IntakeSchema {
  title: string;
  subtitle: string;
  description: string;
  version: string;
  sections: IntakeSection[];
}

export const INTAKE_SCHEMA: IntakeSchema = {
  title: 'P31 INTAKE PROTOCOL',
  subtitle: 'Universal Data Point Retrieval System',
  description: 'Each question maps to a coordinate in your personal IVM. Answer honestly — the geometry holds.',
  version: 'v1.0',
  sections: [
    {
      id: 'identity',
      axis: 'A',
      label: 'AXIS A — IDENTITY',
      icon: '◆',
      fields: [
        { id: 'name', type: 'text', label: 'What should we call you?', placeholder: 'Your preferred name', required: true, voltageWeight: 0.1 },
        { id: 'email', type: 'email', label: 'Contact frequency', placeholder: 'email@example.com', required: true, help: 'Used for system notifications only. Never shared.', voltageWeight: 0.1 },
        { id: 'pronouns', type: 'select', label: 'Pronouns', options: ['he/him', 'she/her', 'they/them', 'xe/xem', 'Other', 'Prefer not to say'], required: false, voltageWeight: 0 },
        { id: 'neurotype', type: 'multi_select', label: 'Neurotype (select all that apply)', options: ['ADHD', 'Autism', 'Dyslexia', 'Dyspraxia', 'Dyscalculia', 'Tourette\'s', 'OCD', 'PTSD/C-PTSD', 'Anxiety', 'Depression', 'Bipolar', 'Other', 'Undiagnosed but suspected', 'Neurotypical'], required: false, help: 'This shapes your interface. No diagnosis required.', voltageWeight: 0.3 },
        { id: 'diagnosed', type: 'boolean', label: 'Do you have a formal diagnosis?', required: false, voltageWeight: 0.1 },
      ],
    },
    {
      id: 'health',
      axis: 'B',
      label: 'AXIS B — HEALTH',
      icon: '◇',
      fields: [
        { id: 'energy_baseline', type: 'scale', label: 'Typical daily energy level', min: 1, max: 12, unit: 'spoons', required: true, help: '12 = fully charged. 1 = barely functional. Most neurodivergent people run 6-8.', voltageWeight: 0.5, invertVoltage: true },
        { id: 'sleep_quality', type: 'scale', label: 'Average sleep quality this week', min: 1, max: 10, required: true, voltageWeight: 0.4, invertVoltage: true },
        { id: 'medications', type: 'boolean', label: 'Currently taking prescribed medications?', required: false, voltageWeight: 0.1 },
        { id: 'med_notes', type: 'textarea', label: 'Anything we should know about your health?', placeholder: 'Conditions, triggers, accommodations needed...', required: false, help: 'Optional. Stored locally only.', rows: 3, voltageWeight: 0.2 },
        { id: 'exercise', type: 'select', label: 'Physical activity level', options: ['Sedentary', 'Light (walks, stretching)', 'Moderate (3-4x/week)', 'Active (daily)', 'Variable (depends on spoons)'], required: false, voltageWeight: 0.2, invertVoltage: true },
      ],
    },
    {
      id: 'environment',
      axis: 'C',
      label: 'AXIS C — ENVIRONMENT',
      icon: '◈',
      fields: [
        { id: 'living', type: 'select', label: 'Current living situation', options: ['Alone', 'With partner', 'With family', 'With roommates', 'Transitional/unstable', 'Prefer not to say'], required: false, voltageWeight: 0.3 },
        { id: 'support_level', type: 'scale', label: 'How supported do you feel right now?', min: 1, max: 10, required: true, help: '1 = completely isolated, 10 = strong support network', voltageWeight: 0.5, invertVoltage: true },
        { id: 'stressors', type: 'multi_select', label: 'Active stressors (select all that apply)', options: ['Financial', 'Legal', 'Medical', 'Relationship', 'Workplace', 'Housing', 'Childcare', 'Grief/Loss', 'Identity', 'None currently'], required: false, voltageWeight: 0.8 },
        { id: 'safe_space', type: 'boolean', label: 'Do you have a physical space where you feel safe?', required: true, voltageWeight: 0.4, invertVoltage: true },
        { id: 'goals', type: 'textarea', label: 'What brought you to P31?', placeholder: 'What are you hoping this system can help with?', required: false, rows: 4, voltageWeight: 0.1 },
      ],
    },
    {
      id: 'technical',
      axis: 'D',
      label: 'AXIS D — TECHNICAL',
      icon: '◊',
      fields: [
        { id: 'tech_comfort', type: 'scale', label: 'Comfort with technology', min: 1, max: 10, required: true, help: '1 = what\'s a browser?, 10 = I write firmware', voltageWeight: 0.1, invertVoltage: true },
        { id: 'devices', type: 'multi_select', label: 'Devices you use daily', options: ['Smartphone', 'Laptop', 'Desktop', 'Tablet', 'Smartwatch', 'Smart home devices', 'None'], required: false, voltageWeight: 0 },
        { id: 'comm_preference', type: 'select', label: 'Preferred communication style', options: ['Text/chat (async)', 'Email (formal async)', 'Voice call', 'Video call', 'In person', 'Varies by spoon level'], required: true, voltageWeight: 0.1 },
        { id: 'sensory_prefs', type: 'multi_select', label: 'Sensory preferences for interfaces', options: ['Dark mode only', 'Large text', 'Minimal animations', 'Haptic feedback', 'Sound alerts', 'Visual-only alerts', 'High contrast', 'Low contrast', 'No preferences'], required: false, voltageWeight: 0 },
        { id: 'feedback', type: 'textarea', label: 'Anything else?', placeholder: 'Questions, concerns, things we missed...', required: false, rows: 3, voltageWeight: 0 },
      ],
    },
  ],
};
