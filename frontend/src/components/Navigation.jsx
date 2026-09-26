import { NavLink } from 'react-router-dom';
import { Icon } from './ui/Icon.jsx';
const ITEMS = [{ to: '/', label: 'Courses', icon: 'cart' }, { to: '/meals', label: 'Recettes', icon: 'chef' }, { to: '/settings', label: 'Réglages', icon: 'settings' }];
export function Navigation() {
  return <nav className="bottom-nav" aria-label="Navigation principale"><div className="simple-nav">{ITEMS.map(({to, label, icon}) => <NavLink key={to} to={to} end={to === '/'} className={({isActive}) => `bottom-nav__btn ${isActive ? 'bottom-nav__btn--active' : ''}`}><Icon name={icon} size={22}/><span>{label}</span></NavLink>)}</div></nav>;
}
