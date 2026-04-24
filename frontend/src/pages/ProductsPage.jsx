import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProductsStore } from '../stores/productsStore.js';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ProductForm } from '../components/products/ProductForm.jsx';
import { ProductCard } from '../components/products/ProductCard.jsx';
import { ProductDetailModal } from '../components/products/ProductDetailModal.jsx';
import { CategoryChipBar } from '../components/products/CategoryChipBar.jsx';

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
  const categories = useProductsStore((s) => s.categories);
  const activeCategory = useProductsStore((s) => s.activeCategory);
  const setActiveCategory = useProductsStore((s) => s.setActiveCategory);
  const create = useProductsStore((s) => s.create);
  const update = useProductsStore((s) => s.update);
  const remove = useProductsStore((s) => s.remove);
  const toggleFavorite = useProductsStore((s) => s.toggleFavorite);

  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [inlineEditingId, setInlineEditingId] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);
  const [activeDrive, setActiveDrive] = useState('all');

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const fromUrl = searchParams.get('category');
    if (fromUrl) setActiveCategory(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (activeCategory) next.set('category', activeCategory);
        else next.delete('category');
        return next;
      },
      { replace: true },
    );
  }, [activeCategory, setSearchParams]);

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

  const rawCategoryLabels = useMemo(() => {
    const set = new Set();
    driveFiltered.forEach((p) => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set);
  }, [driveFiltered]);

  const canonicalCategoryLabels = useMemo(
    () => (categories || []).map((c) => c.label),
    [categories],
  );

  const categoriesWithCounts = useMemo(() => {
    const counts = {};
    driveFiltered.forEach((p) => {
      const key = p.category_key || 'autre';
      counts[key] = (counts[key] || 0) + 1;
    });
    return (categories || []).map((c) => ({ ...c, count: counts[c.key] || 0 }));
  }, [categories, driveFiltered]);

  const activeCategoryEntry = useMemo(
    () => (categories || []).find((c) => c.key === activeCategory) || null,
    [categories, activeCategory],
  );

  const filtered = useMemo(() => {
    if (!activeCategory) return driveFiltered;
    return driveFiltered.filter((p) => p.category_key === activeCategory);
  }, [driveFiltered, activeCategory]);

  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((p) => {
      const key = p.category_key || 'autre';
      const label = p.category_label || 'Autres';
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key).items.push(p);
    });
    const order = new Map((categories || []).map((c, idx) => [c.key, idx]));
    return Array.from(map.entries())
      .sort((a, b) => {
        const oa = order.has(a[0]) ? order.get(a[0]) : 999;
        const ob = order.has(b[0]) ? order.get(b[0]) : 999;
        return oa - ob;
      })
      .map(([key, { label, items: list }]) => ({
        key,
        label,
        items: list.sort((x, y) => x.name.localeCompare(y.name)),
      }));
  }, [filtered, categories]);

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

  function handleOpenCreate() { setShowForm(true); }
  function handleCloseForm() { setShowForm(false); }
  function handleEdit(product) { setInlineEditingId(product.id); }
  function handleInlineCancel() { setInlineEditingId(null); }
  async function handleInlineSave(id, patch) { await update(id, patch); }
  function handleViewDetails(product) { setDetailProduct(product); }
  function handleCloseDetails() { setDetailProduct(null); }
  function handleCategoryFilter(key) { setActiveCategory(key); }

  async function handleSubmit(payload) {
    await create(payload);
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce produit ?')) return;
    remove(id);
  }

  const formOpen = showForm;
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
          {activeCategoryEntry && ` · ${filtered.length} dans « ${activeCategoryEntry.label} »`}
        </span>
      </div>

      {formOpen && (
        <ProductForm
          key="new"
          categories={rawCategoryLabels}
          title="Nouveau produit"
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
        <CategoryChipBar
          categories={categoriesWithCounts}
          activeKey={activeCategory}
          onChange={handleCategoryFilter}
        />
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
            <section key={group.key} className="category-group">
              <header className="category-group__header">
                <h3 className="category-group__title">{group.label}</h3>
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
                    onCategoryClick={handleCategoryFilter}
                    isInlineEditing={inlineEditingId === p.id}
                    onInlineSave={handleInlineSave}
                    onInlineCancel={handleInlineCancel}
                    categoryLabels={canonicalCategoryLabels}
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
