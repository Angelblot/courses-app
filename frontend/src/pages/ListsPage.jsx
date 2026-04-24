import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useListsStore } from '../stores/listsStore.js';
import { useProductsStore } from '../stores/productsStore.js';
import { useWizardStore } from '../stores/wizardStore.js';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ListsSidebar } from '../components/lists/ListsSidebar.jsx';
import { ListDetail } from '../components/lists/ListDetail.jsx';

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
);

export function ListsPage() {
  const lists = useListsStore((s) => s.lists);
  const selected = useListsStore((s) => s.selected);
  const loadLists = useListsStore((s) => s.load);
  const selectList = useListsStore((s) => s.select);
  const createList = useListsStore((s) => s.create);
  const addItem = useListsStore((s) => s.addItem);
  const toggleItem = useListsStore((s) => s.toggleItem);
  const removeItem = useListsStore((s) => s.removeItem);
  const generateFromFavorites = useListsStore((s) => s.generateFromFavorites);

  const products = useProductsStore((s) => s.items);
  const loadProducts = useProductsStore((s) => s.load);
  const resetWizard = useWizardStore((s) => s.reset);

  const navigate = useNavigate();
  const [newListName, setNewListName] = useState('');

  useEffect(() => {
    loadLists();
    loadProducts();
  }, [loadLists, loadProducts]);

  async function handleCreate(e) {
    e.preventDefault();
    const created = await createList(newListName);
    if (created) setNewListName('');
  }

  function handleStartWizard() {
    resetWizard();
    navigate('/wizard/recipes');
  }

  return (
    <section className="stack stack--lg">
      <header className="page-header">
        <h2 className="page-header__title">Mes phases de courses</h2>
        <p className="page-header__subtitle">
          Historique de tes listes. Rejoue-les ou crées-en une nouvelle.
        </p>
      </header>

      <Card className="list-start-card">
        <div className="list-start-card__body">
          <strong>Nouvelle phase&nbsp;?</strong>
          <span className="list-start-card__hint">
            Lance le wizard en 4 étapes.
          </span>
        </div>
        <Button onClick={handleStartWizard}>
          Démarrer <ArrowRight />
        </Button>
      </Card>

      <form onSubmit={handleCreate} className="inline-form">
        <Input
          placeholder="Nom d'une liste manuelle…"
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
          aria-label="Nom de la liste"
        />
        <Button variant="secondary" type="submit">Créer</Button>
      </form>

      {lists.length === 0 ? (
        <EmptyState title="Aucune phase">
          <Link to="/" className="text-accent">Lance-en une</Link> pour démarrer ton historique.
        </EmptyState>
      ) : (
        <div className="lists-layout">
          <ListsSidebar
            lists={lists}
            selectedId={selected?.id}
            onSelect={selectList}
          />
          <ListDetail
            list={selected}
            products={products}
            onAddItem={addItem}
            onToggleItem={toggleItem}
            onRemoveItem={removeItem}
            onGenerateFromFavorites={generateFromFavorites}
          />
        </div>
      )}
    </section>
  );
}
