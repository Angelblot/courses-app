import { Icon } from './Icon.jsx';

export function EmptyState({ icon = 'sprout', title, children }) {
  return (
    <div className="empty">
      <div className="empty__illus" aria-hidden="true">
        <Icon name={icon} size={72} strokeWidth={1.25} />
      </div>
      {title && <div className="empty__title">{title}</div>}
      {children && <div className="empty__body">{children}</div>}
    </div>
  );
}
