const VARIANTS = {
  primary: 'btn',
  secondary: 'btn btn--secondary',
  ghost: 'btn btn--ghost',
  danger: 'btn btn--danger',
  coral: 'btn btn--coral',
  icon: 'btn btn--secondary btn--icon',
};

export function Button({
  variant = 'primary',
  size,
  full,
  className = '',
  type = 'button',
  children,
  ...rest
}) {
  const base = VARIANTS[variant] ?? VARIANTS.primary;
  const classes = [
    base,
    size === 'sm' && 'btn--sm',
    size === 'lg' && 'btn--lg',
    full && 'btn--full',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
