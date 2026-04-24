import { useUIStore } from '../../stores/uiStore.js';
import { Icon } from './Icon.jsx';

const ICON_BY_VARIANT = {
  success: 'check',
  danger: 'alert',
  info: 'info',
};

export function Toasts() {
  const toasts = useUIStore((state) => state.toasts);
  const dismiss = useUIStore((state) => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          className={`toast toast--${t.variant}`}
          onClick={() => dismiss(t.id)}
          type="button"
        >
          <span className="toast__icon" aria-hidden="true">
            <Icon name={ICON_BY_VARIANT[t.variant] || 'info'} size={14} strokeWidth={2.5} />
          </span>
          <span className="toast__message">{t.message}</span>
        </button>
      ))}
    </div>
  );
}
