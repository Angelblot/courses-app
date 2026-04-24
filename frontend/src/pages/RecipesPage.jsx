import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecipesStore } from '../stores/recipesStore.js';
import { useWizardStore } from '../stores/wizardStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { RecipesAPI } from '../api.js';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { RecipeCard } from '../components/recipes/RecipeCard.jsx';
import { RecipeForm } from '../components/recipes/RecipeForm.jsx';

const FAB_BASE = {
  position: 'fixed',
  right: 20,
  bottom: 92,
  width: 56,
  height: 56,
  borderRadius: '50%',
  color: '#FAFAF8',
  border: 'none',
  boxShadow: '0 10px 24px rgba(45,106,79,0.28), 0 2px 6px rgba(0,0,0,0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: 40,
  transition: 'transform 150ms ease, background 150ms ease',
};
const FAB_OPEN = { ...FAB_BASE, background: '#2D6A4F' };
const FAB_CLOSE = { ...FAB_BASE, background: '#1A1A1A' };

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const XIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const GRID_STYLE = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
};

export function RecipesPage() {
  const items = useRecipesStore((s) => s.items);
  const loaded = useRecipesStore((s) => s.loaded);
  const load = useRecipesStore((s) => s.load);
  const create = useRecipesStore((s) => s.create);
  const remove = useRecipesStore((s) => s.remove);
  const toggleRecipe = useWizardStore((s) => s.toggleRecipe);
  const notifySuccess = useUIStore((s) => s.notifySuccess);
  const notifyError = useUIStore((s) => s.notifyError);

  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, [load]);

  function handleOpenCreate() { setEditing(null); setShowForm(true); }
  function handleCloseForm() { setShowForm(false); setEditing(null); }
  function handleEdit(recipe) { setEditing(recipe); setShowForm(true); }

  async function handleSubmit(payload) {
    if (editing) {
      try {
        await RecipesAPI.update(editing.id, payload);
        await load();
        notifySuccess('Recette mise à jour');
      } catch (err) {
        notifyError(err);
        throw err;
      }
    } else {
      await create(payload);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette recette ?')) return;
    remove(id);
  }

  function handleUse(recipe) {
    toggleRecipe(recipe);
    navigate('/wizard/recipes');
  }

  const formOpen = showForm || Boolean(editing);

  return (
    <section className="stack stack--lg">
      <header className="page-header">
        <h2 className="page-header__title">Mes recettes</h2>
        <p className="page-header__subtitle">
          Ton catalogue personnel. Il alimente les listes du wizard.
        </p>
      </header>

      <div className="section-header">
        <span className="section-header__count">
          {items.length} recette{items.length > 1 ? 's' : ''}
        </span>
      </div>

      {formOpen && (
        <RecipeForm
          key={editing?.id || 'new'}
          initialValue={editing}
          title={editing ? `Éditer « ${editing.name} »` : 'Nouvelle recette'}
          onSubmit={handleSubmit}
          onCancel={handleCloseForm}
        />
      )}

      {loaded && items.length === 0 ? (
        <EmptyState title="Aucune recette">
          Ajoute ta première pour alimenter tes phases de courses.
        </EmptyState>
      ) : (
        <div style={GRID_STYLE}>
          {items.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              onDelete={handleDelete}
              onUse={handleUse}
              onEdit={handleEdit}
              isEditing={editing?.id === r.id}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={formOpen ? handleCloseForm : handleOpenCreate}
        aria-label={formOpen ? 'Fermer le formulaire' : 'Ajouter une recette'}
        style={formOpen ? FAB_CLOSE : FAB_OPEN}
      >
        {formOpen ? <XIcon /> : <PlusIcon />}
      </button>
    </section>
  );
}
