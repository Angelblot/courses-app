import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const HomeIcon = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10.5V20h14v-9.5" />
    <path d="M10 20v-5h4v5" />
  </svg>
);
const ListIcon = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="5" cy="6" r="1" fill="currentColor" />
    <circle cx="5" cy="12" r="1" fill="currentColor" />
    <circle cx="5" cy="18" r="1" fill="currentColor" />
  </svg>
);
const CategoryIcon = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <path d="M17.5 4.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
);
const CarIcon = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 14h16l-1.5-5a2 2 0 0 0-1.9-1.4H7.4A2 2 0 0 0 5.5 9L4 14z" />
    <path d="M4 14v4h3v-2h10v2h3v-4" />
    <circle cx="8" cy="16" r="1.1" />
    <circle cx="16" cy="16" r="1.1" />
  </svg>
);

const ITEMS = [
  { to: '/', label: 'Accueil', Icon: HomeIcon },
  { to: '/lists', label: 'Listes', Icon: ListIcon },
  { to: '/categories', label: 'Catégories', Icon: CategoryIcon },
  { to: '/drives', label: 'Drives', Icon: CarIcon },
];

export function MoreMenuSheet({ open, onClose }) {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const touchStartY = useRef(null);
  const touchDeltaY = useRef(0);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const timer = setTimeout(() => setMounted(false), 260);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const handleItem = (to) => {
    navigate(to);
    onClose();
  };

  const onTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    touchDeltaY.current = 0;
  };
  const onTouchMove = (e) => {
    if (touchStartY.current == null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      touchDeltaY.current = delta;
      setDragY(delta);
    }
  };
  const onTouchEnd = () => {
    if (touchDeltaY.current > 80) {
      onClose();
    }
    touchStartY.current = null;
    touchDeltaY.current = 0;
    setDragY(0);
  };

  return (
    <div
      className={`more-sheet ${visible ? 'more-sheet--visible' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Plus d'options"
    >
      <button
        type="button"
        className="more-sheet__backdrop"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        className="more-sheet__panel"
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="more-sheet__handle" aria-hidden="true" />
        <ul className="more-sheet__list">
          {ITEMS.map(({ to, label, Icon }) => (
            <li key={to}>
              <button
                type="button"
                className="more-sheet__item"
                onClick={() => handleItem(to)}
              >
                <span className="more-sheet__item-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="more-sheet__item-label">{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
