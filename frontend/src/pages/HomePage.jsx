import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useListsStore } from '../stores/listsStore.js';
import { useRecipesStore } from '../stores/recipesStore.js';
import { useProductsStore } from '../stores/productsStore.js';
import { useDrivesStore } from '../stores/drivesStore.js';
import { useWizardStore } from '../stores/wizardStore.js';
import { Card } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
);
const BookIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" />
    <path d="M7 20a2 2 0 0 1 0-4h11" />
  </svg>
);
const BagIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
);
const CarIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14h16l-1.5-5a2 2 0 0 0-1.9-1.4H7.4A2 2 0 0 0 5.5 9L4 14z" />
    <path d="M4 14v4h3v-2h10v2h3v-4" />
    <circle cx="8" cy="16" r="1.1" />
    <circle cx="16" cy="16" r="1.1" />
  </svg>
);
const ListIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="5" cy="6" r="1" fill="currentColor" />
    <circle cx="5" cy="12" r="1" fill="currentColor" />
    <circle cx="5" cy="18" r="1" fill="currentColor" />
  </svg>
);

export function HomePage() {
  const navigate = useNavigate();

  const lists = useListsStore((s) => s.lists);
  const loadLists = useListsStore((s) => s.load);
  const recipes = useRecipesStore((s) => s.items);
  const loadRecipes = useRecipesStore((s) => s.load);
  const products = useProductsStore((s) => s.items);
  const loadProducts = useProductsStore((s) => s.load);
  const configs = useDrivesStore((s) => s.configs);
  const loadDrives = useDrivesStore((s) => s.load);
  const resetWizard = useWizardStore((s) => s.reset);

  useEffect(() => {
    loadLists();
    loadRecipes();
    loadProducts();
    loadDrives();
  }, [loadLists, loadRecipes, loadProducts, loadDrives]);

  function startWizard() {
    resetWizard();
    navigate('/wizard/recipes');
  }

  const lastList = lists?.[lists.length - 1];

  return (
    <section className="stack stack--lg home">
      <header className="home__header">
        <div>
          <div className="home__greeting-eyebrow">Bonjour</div>
          <h1 className="home__greeting-title">Qu'est-ce qu'on mange&nbsp;?</h1>
        </div>
      </header>

      <article className="hero-card">
        <div className="hero-card__eyebrow">Prochaine phase</div>
        <h2 className="hero-card__title">Prépare tes courses de la semaine</h2>
        <p className="hero-card__body">
          Choisis tes recettes, valide ton quotidien, compare Carrefour et
          Leclerc en un instant.
        </p>
        <div className="hero-card__actions">
          <Button onClick={startWizard}>
            Commencer <ArrowRight />
          </Button>
        </div>
      </article>

      <div>
        <div className="section-title">
          <h3>Aperçu</h3>
        </div>
        <div className="home-stats">
          <StatCard label="Recettes" value={recipes.length} to="/recipes" Icon={BookIcon} />
          <StatCard label="Produits" value={products.length} to="/products" Icon={BagIcon} variant="coral" />
          <StatCard label="Drives" value={configs.length} to="/drives" Icon={CarIcon} variant="beige" />
          <StatCard label="Phases" value={lists.length} to="/lists" Icon={ListIcon} />
        </div>
      </div>

      {lastList && (
        <Card>
          <div className="row">
            <div style={{ flex: 1 }}>
              <div className="home__greeting-eyebrow">Dernière phase</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>{lastList.name}</div>
              <div className="text-muted" style={{ fontSize: 13 }}>
                {lastList.items?.length || 0} articles
              </div>
            </div>
            <Link to="/lists" className="btn btn--secondary btn--sm">Voir</Link>
          </div>
        </Card>
      )}
    </section>
  );
}

function StatCard({ label, value, to, Icon, variant }) {
  const iconClass =
    variant === 'coral' ? 'stat-card__icon--coral'
    : variant === 'beige' ? 'stat-card__icon--beige'
    : '';
  return (
    <Link to={to} className="stat-card">
      <span className={`stat-card__icon ${iconClass}`} aria-hidden="true">
        <Icon />
      </span>
      <span className="stat-card__value">{value}</span>
      <span className="stat-card__label">{label}</span>
    </Link>
  );
}
