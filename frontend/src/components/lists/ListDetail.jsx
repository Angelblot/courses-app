import { Button } from '../ui/Button.jsx';
import { Select } from '../ui/Input.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';

export function ListDetail({
  list,
  products,
  onAddItem,
  onToggleItem,
  onRemoveItem,
  onGenerateFromFavorites,
}) {
  if (!list) {
    return <EmptyState>Sélectionne une liste pour voir son contenu</EmptyState>;
  }

  function handleSelect(e) {
    const id = parseInt(e.target.value, 10);
    if (id) onAddItem(id);
    e.target.value = '';
  }

  return (
    <section className="stack stack--lg">
      <div className="section-header">
        <h2>{list.name}</h2>
        <Button variant="secondary" size="sm" onClick={onGenerateFromFavorites}>
          ⭐ Favoris
        </Button>
      </div>

      <Select onChange={handleSelect} aria-label="Ajouter un produit">
        <option value="">+ Ajouter un produit à la liste…</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.brand || 'sans marque'})
          </option>
        ))}
      </Select>

      {list.items?.length === 0 ? (
        <EmptyState>Liste vide. Ajoute des produits !</EmptyState>
      ) : (
        <div className="stack stack--sm">
          {list.items?.map((item) => (
            <article key={item.id} className={`item ${item.checked ? 'item--checked' : ''}`}>
              <input
                type="checkbox"
                className="checkbox"
                checked={item.checked}
                onChange={() => onToggleItem(item)}
                aria-label={`Cocher ${item.product.name}`}
              />
              <div className="item__body">
                <div className="item__title">{item.product.name}</div>
                <div className="item__meta">
                  Qté : {item.quantity} {item.product.unit}
                  {item.price_found != null && ` • ${item.price_found.toFixed(2)} €`}
                  {item.drive_name && ` • ${item.drive_name}`}
                </div>
              </div>
              <div className="item__actions">
                <Button
                  variant="danger"
                  onClick={() => onRemoveItem(item.id)}
                  aria-label="Retirer"
                >
                  🗑️
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
