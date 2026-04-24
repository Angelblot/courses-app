import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { MoreMenuSheet } from './MoreMenuSheet.jsx';

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
const CartIcon = (p) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 4h2l2.4 11.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.55L20.5 8H6.2" />
    <circle cx="10" cy="20" r="1.4" />
    <circle cx="17" cy="20" r="1.4" />
  </svg>
);
const GridIcon = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
);

export function Navigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = ['/', '/lists', '/categories', '/drives'].includes(pathname);

  return (
    <>
      <nav className="bottom-nav" aria-label="Navigation principale">
        <div className="bottom-nav__inner">
          <div className="bottom-nav__side bottom-nav__side--left">
            <NavLink
              to="/recipes"
              className={({ isActive }) =>
                `bottom-nav__btn ${isActive ? 'bottom-nav__btn--active' : ''}`
              }
            >
              <span className="bottom-nav__icon" aria-hidden="true"><BookIcon /></span>
              <span>Recettes</span>
            </NavLink>

            <NavLink
              to="/products"
              className={({ isActive }) =>
                `bottom-nav__btn ${isActive ? 'bottom-nav__btn--active' : ''}`
              }
            >
              <span className="bottom-nav__icon" aria-hidden="true"><BagIcon /></span>
              <span>Produits</span>
            </NavLink>
          </div>

          <div className="bottom-nav__side bottom-nav__side--right">
            <button
              type="button"
              className={`bottom-nav__btn ${isMoreActive ? 'bottom-nav__btn--active' : ''}`}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
            >
              <span className="bottom-nav__icon" aria-hidden="true"><GridIcon /></span>
              <span>Plus</span>
            </button>
          </div>

          <div className="bottom-nav__center">
            <button
              type="button"
              className="bottom-nav__action"
              aria-label="Lancer le wizard"
              onClick={() => navigate('/wizard')}
            >
              <CartIcon />
            </button>
            <span className="bottom-nav__action-label">Wizard</span>
          </div>
        </div>
      </nav>

      <MoreMenuSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
