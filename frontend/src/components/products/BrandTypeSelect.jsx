import { Select } from '../ui/Input.jsx';

export const BRAND_TYPE_OPTIONS = [
  { value: 'common', label: 'Marque commune' },
  { value: 'store_brand', label: 'Marque distributeur' },
  { value: 'generic', label: 'Générique / sans marque' },
];

export function BrandTypeSelect({ value, onChange, ...rest }) {
  return (
    <Select
      value={value || 'common'}
      onChange={(e) => onChange?.(e.target.value)}
      aria-label="Typologie de marque"
      {...rest}
    >
      {BRAND_TYPE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </Select>
  );
}
