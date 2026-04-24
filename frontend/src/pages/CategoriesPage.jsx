import { useEffect, useMemo, useState } from 'react';
import { CategoriesAPI } from '../api.js';
import { useProductsStore } from '../stores/productsStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { Button } from '../components/ui/Button.jsx';
import { Icon } from '../components/ui/Icon.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { CategoryFormModal, CATEGORY_ICON_CHOICES } from '../components/categories/CategoryFormModal.jsx';
import { categoryTint } from '../components/products/categoryTints.js';

const FAB_BASE = {
  position: 'fixed', right: 20, bottom: 92,
  width: 56, height: 56, borderRadius: '50%',
  color: '#FAFAF8', border: 'none',
  boxShadow: '0 10px 24px rgba(45,106,79,0.28), 0 2px 6px rgba(0,0,0,0.08)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', zIndex: 40,
  background: '#2D6A4F',
};

const GRID_STYLE = {
  display: 'grid',
  gap: 10,
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
};

const ROW_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 14,
  background: '#FFFFFF',
  border: '1px solid #E8E8E6',
  borderRadius: 16,
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
};

const ICON_TILE = {
  width: 44, height: 44,
  borderRadius: 12,
  display: 'grid', placeItems: 'center',
  color: '#1A1A1A',
  flexShrink: 0,
};

function parseErrorMessage(err) {
  const raw = err?.message || String(err);
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.detail) return parsed.detail;
  } catch (_e) {}
  return raw;
}

export function CategoriesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [modalState, setModalState] = useState(null); // null | { mode: 'create' } | { mode: 'edit', category }
  const reloadProductsCategories = useProductsStore((s) => s.reloadCategories);
  const notifyError = useUIStore((s) => s.notifyError);
  const notifySuccess = useUIStore((s) => s.notifySuccess);

  async function load() {
    setLoading(true);
    try {
      const data = await CategoriesAPI.list();
      setItems(data);
      setLoaded(true);
    } catch (err) {
      notifyError(new Error(parseErrorMessage(err)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return a.label.localeCompare(b.label);
    });
  }, [items]);

  async function handleCreate(payload) {
    try {
      await CategoriesAPI.create(payload);
      notifySuccess('Catégorie créée');
      setModalState(null);
      await load();
      reloadProductsCategories?.();
    } catch (err) {
      notifyError(new Error(parseErrorMessage(err)));
      throw err;
    }
  }

  async function handleUpdate(key, payload) {
    try {
      await CategoriesAPI.update(key, payload);
      notifySuccess('Catégorie mise à jour');
      setModalState(null);
      await load();
      reloadProductsCategories?.();
    } catch (err) {
      notifyError(new Error(parseErrorMessage(err)));
      throw err;
    }
  }

  async function handleDelete(cat) {
    if (cat.count > 0) {
      notifyError(
        new Error(
          `Impossible : ${cat.count} produit${cat.count > 1 ? 's utilisent' : ' utilise'} cette catégorie. Réassignez-les avant de supprimer.`,
        ),
      );
      return;
    }
    if (!confirm(`Supprimer la catégorie « ${cat.label} » ?`)) return;
    try {
      await CategoriesAPI.delete(cat.key);
      notifySuccess('Catégorie supprimée');
      await load();
      reloadProductsCategories?.();
    } catch (err) {
      notifyError(new Error(parseErrorMessage(err)));
    }
  }

  const usedKeys = useMemo(() => items.map((c) => c.key), [items]);

  return (
    <section className="stack stack--lg">
      <header className="page-header">
        <h2 className="page-header__title">Catégories</h2>
        <p className="page-header__subtitle">
          Organise ton catalogue : ordre d'affichage, icônes, libellés.
        </p>
      </header>

      <div className="section-header">
        <span className="section-header__count">
          {items.length} catégorie{items.length > 1 ? 's' : ''}
        </span>
      </div>

      {loaded && items.length === 0 ? (
        <EmptyState title="Aucune catégorie">
          Ajoute ta première catégorie pour organiser tes produits.
        </EmptyState>
      ) : (
        <div style={GRID_STYLE}>
          {sorted.map((cat) => (
            <div key={cat.key} style={ROW_STYLE}>
              <div style={{ ...ICON_TILE, background: categoryTint(cat.key) }}>
                <Icon name={cat.icon} size={22} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 15,
                    color: '#1A1A1A',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat.label}
                </div>
                <div style={{ fontSize: 12, color: '#6B6B6B' }}>
                  <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    {cat.key}
                  </span>
                  {' · '}
                  {cat.count} produit{cat.count > 1 ? 's' : ''}
                  {' · '}
                  ordre {cat.display_order}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <Button
                  variant="ghost"
                  onClick={() => setModalState({ mode: 'edit', category: cat })}
                  aria-label={`Éditer ${cat.label}`}
                >
                  <Icon name="edit" size={18} />
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDelete(cat)}
                  disabled={cat.count > 0}
                  aria-label={`Supprimer ${cat.label}`}
                  title={
                    cat.count > 0
                      ? 'Réassignez les produits avant de supprimer'
                      : 'Supprimer'
                  }
                >
                  <Icon name="trash" size={18} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalState && (
        <CategoryFormModal
          mode={modalState.mode}
          category={modalState.category}
          usedKeys={usedKeys}
          iconChoices={CATEGORY_ICON_CHOICES}
          onSubmit={
            modalState.mode === 'create'
              ? handleCreate
              : (payload) => handleUpdate(modalState.category.key, payload)
          }
          onClose={() => setModalState(null)}
        />
      )}

      <button
        type="button"
        onClick={() => setModalState({ mode: 'create' })}
        aria-label="Ajouter une catégorie"
        style={FAB_BASE}
        disabled={loading && !loaded}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </section>
  );
}
