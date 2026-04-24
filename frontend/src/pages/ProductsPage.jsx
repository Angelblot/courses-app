import { useEffect, useMemo, useState } from 'react';
import { useProductsStore } from '../stores/productsStore.js';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ProductForm } from '../components/products/ProductForm.jsx';
import { ProductCard } from '../components/products/ProductCard.jsx';
import { ProductDetailModal } from '../components/products/ProductDetailModal.jsx';

const UNCATEGORIZED = 'Sans catégorie';

const DRIVE_LABELS = {
  carrefour: 'Carrefour',
};

function driveLabel(name) {
  if (!name) return '';
  if (DRIVE_LABELS[name]) return DRIVE_LABELS[name];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const FAB_BASE = {
  position: 'fixed', right: 20, bottom: 92,
  width: 56, height: 56, borderRadius: '50%',
  color: '#FAFAF8', border: 'none',
  boxShadow: '0 10px 24px rgba(45,106,79,0.28), 0 2px 6px rgba(0,0,0,0.08)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', zIndex: 40,
  transition: 'transform 150ms ease, background 150ms ease',
};
const FAB_OPEN = { ...FAB_BASE, background: '#2D6A4F' };
const FAB_CLOSE = { ...FAB_BASE, background: '#1A1A1A' };

const GRID_STYLE = {
  display: 'grid',
  gap: 10,
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
};

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

export function ProductsPage() {
  const items = useProductsStore((s) => s.items);
  const loaded = useProductsStore((s) => s.loaded);
  const load = useProductsStore((s) => s.load);
  const create = useProductsStore((s) => s.create);
  const update = useProductsStore((s) => s.update);
  const remove = useProductsStore((s) => s.remove);
  const toggleFavorite = useProductsStore((s) => s.toggleFavorite);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeDrive, setActiveDrive] = useState('all');

  useEffect(() => { load(); }, [load]);

  const drives = useMemo(() => {
    const set = new Set();
    items.forEach((p) => {
      (p.drive_names || []).forEach((d) => set.add(d));
    });
    return Array.from(set).sort();
  }, [items]);

  const driveFiltered = useMemo(() => {
    if (activeDrive === 'all') return items;
    return items.filter((p) => (p.drive_names || []).includes(activeDrive));
  }, [items, activeDrive]);

  const categories = useMemo(() => {
    const set = new Set();
    driveFiltered.forEach((p) => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [driveFiltered]);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return driveFiltered;
    if (activeCategory === UNCATEGORIZED) {
      return driveFiltered.filter((p) => !p.category || !p.category.trim());
    }
    return driveFiltered.filter((p) => p.category === activeCategory);
  }, [driveFiltered, activeCategory]);

  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((p) => {
      const cat = p.category && p.category.trim() ? p.category.trim() : UNCATEGORIZED;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(p);
    });
    return Array.from(map.entries())
      .sort((a, b) => {
        if (a[0] === UNCATEGORIZED) return 1;
        if (b[0] === UNCATEGORIZED) return -1;
        return a[0].localeCompare(b[0]);
      })
      .map(([category, list]) => ({
        category,
        items: list.sort((x, y) => x.name.localeCompare(y.name)),
      }));
  }, [filtered]);

  const chipData = useMemo(() => {
    const byCat = {};
    driveFiltered.forEach((p) => {
      const cat = p.category && p.category.trim() ? p.category.trim() : UNCATEGORIZED;
      byCat[cat] = (byCat[cat] || 0) + 1;
    });
    return {
      all: driveFiltered.length,
      perCategory: [...categories, ...(byCat[UNCATEGORIZED] ? [UNCATEGORIZED] : [])].map(
        (c) => ({ label: c, count: byCat[c] || 0 }),
      ),
    };
  }, [driveFiltered, categories]);

  const driveChipData = useMemo(() => {
    const byDrive = {};
    items.forEach((p) => {
      (p.drive_names || []).forEach((d) => {
        byDrive[d] = (byDrive[d] || 0) + 1;
      });
    });
    return {
      all: items.length,
      perDrive: drives.map((d) => ({ name: d, label: driveLabel(d), count: byDrive[d] || 0 })),
    };
  }, [items, drives]);

  function handleOpenCreate() { setEditing(null); setShowForm(true); }
  function handleCloseForm() { setShowForm(false); setEditing(null); }
  function handleEdit(product) { setEditing(product); setShowForm(true); }
  function handleViewDetails(product) { setDetailProduct(product); }
  function handleCloseDetails() { setDetailProduct(null); }

  async function handleSubmit(payload) {
    if (editing) await update(editing.id, payload);
    else await create(payload);
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce produit ?')) return;
    remove(id);
  }

  const formOpen = showForm || Boolean(editing);
  const showDriveFilter = drives.length > 1;

  return (
    <section className="stack stack--lg">
      <header className="page-header">
        <h2 className="page-header__title">Mes produits</h2>
        <p className="page-header__subtitle">
          Ton catalogue. Tape une carte pour voir l'évolution du prix.
        </p>
      </header>

      <div className="section-header">
        <span className="section-header__count">
          {items.length} produit{items.length > 1 ? 's' : ''}
          {activeDrive !== 'all' && ` · drive ${driveLabel(activeDrive)}`}
          {activeCategory !== 'all' && ` · ${filtered.length} dans « ${activeCategory} »`}
        </span>
      </div>

      {formOpen && (
        <ProductForm
          key={editing?.id || 'new'}
          initialValue={editing}
          categories={categories}
          title={editing ? `Éditer « ${editing.name} »` : 'Nouveau produit'}
          onSubmit={handleSubmit}
          onCancel={handleCloseForm}
        />
      )}

      {showDriveFilter && (
        <div className="filter-chips" role="tablist" aria-label="Filtrer par drive">
          <button
            type="button"
            role="tab"
            aria-selected={activeDrive === 'all'}
            className={`filter-chip ${activeDrive === 'all' ? 'filter-chip--active' : ''}`}
            onClick={() => setActiveDrive('all')}
          >
            Tous drives <span className="filter-chip__count">{driveChipData.all}</span>
          </button>
          {driveChipData.perDrive.map((d) => (
            <button
              key={d.name}
              type="button"
              role="tab"
              aria-selected={activeDrive === d.name}
              className={`filter-chip ${activeDrive === d.name ? 'filter-chip--active' : ''}`}
              onClick={() => setActiveDrive(d.name)}
            >
              {d.label} <span className="filter-chip__count">{d.count}</span>
            </button>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="filter-chips" role="tablist" aria-label="Filtrer par catégorie">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'all'}
            className={`filter-chip ${activeCategory === 'all' ? 'filter-chip--active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            Tous <span className="filter-chip__count">{chipData.all}</span>
          </button>
          {chipData.perCategory.map((c) => (
            <button
              key={c.label}
              type="button"
              role="tab"
              aria-selected={activeCategory === c.label}
              className={`filter-chip ${activeCategory === c.label ? 'filter-chip--active' : ''}`}
              onClick={() => setActiveCategory(c.label)}
            >
              {c.label} <span className="filter-chip__count">{c.count}</span>
            </button>
          ))}
        </div>
      )}

      {loaded && items.length === 0 ? (
        <EmptyState title="Aucun produit">
          Ajoute ton premier produit pour démarrer ton catalogue.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState title="Rien dans cette catégorie">
          Change de filtre ou ajoute un produit à cette catégorie.
        </EmptyState>
      ) : (
        <div className="stack stack--lg">
          {groups.map((group) => (
            <section key={group.category} className="category-group">
              <header className="category-group__header">
                <h3 className="category-group__title">{group.category}</h3>
                <span className="category-group__count">
                  {group.items.length} produit{group.items.length > 1 ? 's' : ''}
                </span>
              </header>
              <div style={GRID_STYLE}>
                {group.items.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onToggleFavorite={toggleFavorite}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onViewDetails={handleViewDetails}
                    isEditing={editing?.id === p.id}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          onClose={handleCloseDetails}
          onEdit={handleEdit}
        />
      )}

      <button
        type="button"
        onClick={formOpen ? handleCloseForm : handleOpenCreate}
        aria-label={formOpen ? 'Fermer le formulaire' : 'Ajouter un produit'}
        style={formOpen ? FAB_CLOSE : FAB_OPEN}
      >
        {formOpen ? <XIcon /> : <PlusIcon />}
      </button>
    </section>
  );
}
