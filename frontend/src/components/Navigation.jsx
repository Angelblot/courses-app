import { NavLink } from 'react-router-dom';

const HomeIcon = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10.5V20h14v-9.5" />
    <path d="M10 20v-5h4v5" />
  </svg>
);
const BookIcon = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" />
    <path d="M7 20a2 2 0 0 1 0-4h11" />
  </svg>
);
const BagIcon = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
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
const CarIcon = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 14h16l-1.5-5a2 2 0 0 0-1.9-1.4H7.4A2 2 0 0 0 5.5 9L4 14z" />
    <path d="M4 14v4h3v-2h10v2h3v-4" />
    <circle cx="8" cy="16" r="1.1" />
    <circle cx="16" cy="16" r="1.1" />
  </svg>
);

const TABS = [
  { to: '/', label: 'Accueil', Icon: HomeIcon, end: true },
  { to: '/recipes', label: 'Recettes', Icon: BookIcon },
  { to: '/products', label: 'Produits', Icon: BagIcon },
  { to: '/lists', label: 'Listes', Icon: ListIcon },
  { to: '/drives', label: 'Drives', Icon: CarIcon },
];

export function Navigation() {
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      <div className="bottom-nav__inner">
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `bottom-nav__btn ${isActive ? 'bottom-nav__btn--active' : ''}`
            }
          >
            <span className="bottom-nav__icon" aria-hidden="true">
              <Icon />
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
