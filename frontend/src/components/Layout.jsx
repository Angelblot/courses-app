import { useLocation } from 'react-router-dom';
import { Navigation } from './Navigation.jsx';
import { Toasts } from './ui/Toasts.jsx';

export function Layout({ children }) {
  const { pathname } = useLocation();
  const hideNav = pathname.startsWith('/wizard') || pathname.startsWith('/results');

  return (
    <div className="app app--light">
      <main className={`app__main ${hideNav ? 'app__main--focus' : ''}`}>
        <div className="container">{children}</div>
      </main>
      {!hideNav && <Navigation />}
      <Toasts />
    </div>
  );
}
