export const INPUT_LABELS: Record<string, string> = {
  SELECT: 'Pick one',
  MULTISELECT: 'Pick several',
  SWATCH_COLOR: 'Colour swatch',
  SWATCH_IMAGE: 'Image swatch',
  TEXT: 'Short text',
  TEXTAREA: 'Long text',
  NUMBER: 'Number',
  BOOLEAN: 'Yes / no',
};

export const INPUT_OPTIONS = Object.entries(INPUT_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** Inputs whose answers come from a list of values. */
export const HAS_VALUES = new Set(['SELECT', 'MULTISELECT', 'SWATCH_COLOR', 'SWATCH_IMAGE']);

export const DATA_TYPE_OPTIONS = [
  { value: 'STRING', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'BOOLEAN', label: 'Yes / no' },
];

/** "Solid Oak" → "SOLID_OAK": a suggestion for the code field, editable by the admin. */
export function codeFrom(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .toUpperCase()
    .slice(0, 64);
}
