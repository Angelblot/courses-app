export function Card({ size, className = '', children, ...rest }) {
  const classes = ['card', size === 'sm' && 'card--sm', size === 'lg' && 'card--lg', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
