/**
 * intake-schema.ts — Onboarding questionnaire structure
 * Organized by tetrahedral axes: A (Identity), B (Health), C (Obligations), D (Meta)
 */

export interface IntakeField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'textarea' | 'select' | 'multi_select' | 'scale' | 'boolean';
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
  min?: number;
  max?: number;
  unit?: string;
  rows?: number;
}

export interface IntakeSection {
  id: string;
  label: string;
  icon: string;
  axis: string; // A, B, C, D
  fields: IntakeField[];
}

export interface IntakeSchemaType {
  title: string;
  description: string;
  sections: IntakeSection[];
}

export const INTAKE_SCHEMA: IntakeSchemaType = {
  title: 'THE BUFFER — CALIBRATION',
  description: 'Answer what feels right. Skip what doesn\'t. This calibrates your ship.',
  sections: [
    {
      id: 'identity',
      label: 'IDENTITY',
      icon: '△',
      axis: 'A',
      fields: [
        { id: 'display_name', label: 'What should we call you?', type: 'text', placeholder: 'Name or handle', required: true },
        { id: 'role', label: 'Primary role right now', type: 'select', options: ['Parent', 'Caregiver', 'Student', 'Professional', 'Advocate', 'Other'], help: 'What hat do you wear most?' },
        { id: 'diagnoses', label: 'Neurotype / Diagnoses', type: 'multi_select', options: ['ADHD', 'Autism', 'AuDHD', 'PTSD', 'C-PTSD', 'Anxiety', 'Depression', 'Bipolar', 'OCD', 'Other', 'Prefer not to say'], help: 'Helps calibrate sensory and cognitive settings' },
      ],
    },
    {
      id: 'health',
      label: 'ENERGY & HEALTH',
      icon: '◇',
      axis: 'B',
      fields: [
        { id: 'initial_spoons', label: 'How many spoons do you start the day with?', type: 'scale', min: 1, max: 12, unit: 'spoons', help: 'Spoon Theory: a measure of daily cognitive/physical energy' },
        { id: 'sensory_prefs', label: 'Sensory sensitivities', type: 'multi_select', options: ['Light sensitivity', 'Sound sensitivity', 'Motion sensitivity', 'Reduce animations', 'High contrast needed', 'None / Low'] },
        { id: 'medications', label: 'Current medications (optional)', type: 'textarea', placeholder: 'Name, dose, timing — helps with reminders', rows: 2, help: 'Stored locally only. Never transmitted.' },
        { id: 'sleep_quality', label: 'Average sleep quality', type: 'scale', min: 1, max: 10, unit: '/ 10' },
      ],
    },
    {
      id: 'obligations',
      label: 'OBLIGATIONS',
      icon: '□',
      axis: 'C',
      fields: [
        { id: 'active_stressors', label: 'Active stressors', type: 'multi_select', options: ['Legal proceedings', 'Financial pressure', 'Housing instability', 'Caregiving demands', 'Employment issues', 'Relationship conflict', 'Health crisis', 'None currently'] },
        { id: 'support_level', label: 'Current support level', type: 'select', options: ['Strong support network', 'Some support', 'Limited support', 'Isolated'] },
      ],
    },
    {
      id: 'preferences',
      label: 'PREFERENCES',
      icon: '○',
      axis: 'D',
      fields: [
        { id: 'preferred_mode', label: 'Communication style', type: 'select', options: ['PLAIN', 'TECHNICAL', 'GENTLE', 'DIRECT'], help: 'How the system talks to you' },
        { id: 'breathing_enabled', label: 'Enable breathing pacer?', type: 'boolean', help: '4-2-6 guided breathing that recovers energy' },
        { id: 'deep_lock_enabled', label: 'Enable Deep Processing Lock?', type: 'boolean', help: 'Blocks new inputs when energy drops below 25%' },
      ],
    },
  ],
};
