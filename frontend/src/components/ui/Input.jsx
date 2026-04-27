import { forwardRef } from 'react';

export const Input = forwardRef(function Input({ label, className = '', ...rest }, ref) {
  return (
    <label className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <span style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B', letterSpacing: '0.02em' }}>{label}</span>}
      <input ref={ref} className={`input ${className}`} {...rest} />
    </label>
  );
});

export function Textarea({ className = '', ...rest }) {
  return <textarea className={`textarea ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }) {
  return (
    <select className={`select ${className}`} {...rest}>
      {children}
    </select>
  );
}
