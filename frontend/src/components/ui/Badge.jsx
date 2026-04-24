const VARIANTS = {
  default: 'badge',
  primary: 'badge badge--primary',
  success: 'badge badge--success',
  warning: 'badge badge--warning',
  danger: 'badge badge--danger',
  muted: 'badge badge--muted',
};

export function Badge({ variant = 'default', className = '', children, ...rest }) {
  const classes = [VARIANTS[variant] ?? VARIANTS.default, className].filter(Boolean).join(' ');
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
