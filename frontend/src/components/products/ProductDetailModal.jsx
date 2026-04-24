import { useEffect, useMemo, useState } from 'react';
import { ProductsAPI } from '../../api.js';
import { AsyncImage } from '../ui/AsyncImage.jsx';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { PriceHistoryChart } from './PriceHistoryChart.jsx';

const DRIVE_LABELS = { carrefour: 'Carrefour' };
function driveLabel(name) {
  if (!name) return '';
  if (DRIVE_LABELS[name]) return DRIVE_LABELS[name];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function fmtEuro(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return `${Number(v).toFixed(2)} €`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
}

const OVERLAY = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(26,26,26,0.55)',
  zIndex: 60,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  padding: 0,
};

const DRAWER = {
  background: '#FAFAF8',
  width: '100%',
  maxWidth: 640,
  maxHeight: '92vh',
  overflowY: 'auto',
  borderTopLeftRadius: 18,
  borderTopRightRadius: 18,
  boxShadow: '0 -10px 40px rgba(0,0,0,0.18)',
  display: 'flex',
  flexDirection: 'column',
};

const HEADER = {
  position: 'sticky',
  top: 0,
  background: '#FAFAF8',
  padding: '14px 16px',
  borderBottom: '1px solid #E8E8E6',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  zIndex: 1,
};

const BODY = {
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const TABLE_ROW = {
  display: 'grid',
  gridTemplateColumns: '1.1fr 1fr 0.9fr 0.6fr 0.9fr',
  gap: 8,
  padding: '10px 12px',
  fontSize: 13,
  alignItems: 'center',
};

export function ProductDetailModal({ product, onClose, onEdit }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!product) return;
      setLoading(true);
      setError(null);
      try {
        const data = await ProductsAPI.getPriceHistory(product.id);
        if (!cancelled) setHistory(data);
      } catch (e) {
        if (!cancelled) setError('Impossible de charger l\'historique.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [product]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const sortedPoints = useMemo(() => {
    if (!history?.points) return [];
    return [...history.points].sort((a, b) => {
      const da = a.purchase_date || '';
      const db = b.purchase_date || '';
      return db.localeCompare(da);
    });
  }, [history]);

  const stats = useMemo(() => {
    const points = history?.points || [];
    if (!points.length) return null;
    const prices = points.map((p) => Number(p.unit_price_ttc)).filter((v) => !Number.isNaN(v));
    if (!prices.length) return null;
    const totals = points.map((p) => Number(p.total_ttc || 0)).reduce((a, b) => a + b, 0);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
      totalSpent: totals,
      count: points.length,
    };
  }, [history]);

  if (!product) return null;

  const keyword = [product.name, product.category].filter(Boolean).join(' ');

  return (
    <div style={OVERLAY} onClick={onClose} role="presentation">
      <div
        style={DRAWER}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Détail du produit ${product.name}`}
      >
        <div style={HEADER}>
          <AsyncImage
            src={product.image_url || undefined}
            keyword={keyword}
            alt={product.name}
            className="item__image"
            rounded
            fallbackIcon="package"
            fallbackIconSize={18}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {product.name}
            </div>
            <div style={{ fontSize: 12, color: '#6B6B6B' }}>
              {product.brand && <>{product.brand} · </>}
              {product.category && <>{product.category} · </>}
              {product.default_quantity} {product.unit}
            </div>
          </div>
          {onEdit && (
            <Button
              variant="ghost"
              onClick={() => {
                onEdit(product);
                onClose();
              }}
              aria-label="Éditer"
            >
              <Icon name="edit" size={16} />
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} aria-label="Fermer">
            <Icon name="x" size={18} />
          </Button>
        </div>

        <div style={BODY}>
          {(product.drive_names || []).length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {product.drive_names.map((d) => (
                <span key={d} className="badge badge--primary">
                  {driveLabel(d)}
                </span>
              ))}
            </div>
          )}

          <section>
            <h3
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#6B6B6B',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                margin: '0 0 10px 0',
              }}
            >
              Évolution du prix
            </h3>

            {loading && (
              <div
                style={{
                  padding: 24,
                  textAlign: 'center',
                  color: '#6B6B6B',
                  fontSize: 14,
                }}
              >
                Chargement…
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: '#FBE5E5',
                  color: '#D62828',
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}

            {!loading && !error && (
              <PriceHistoryChart points={history?.points || []} />
            )}
          </section>

          {stats && (
            <section>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 8,
                }}
              >
                <StatTile label="Achats" value={stats.count} />
                <StatTile label="Prix min" value={fmtEuro(stats.min)} />
                <StatTile label="Prix moyen" value={fmtEuro(stats.avg)} />
                <StatTile label="Prix max" value={fmtEuro(stats.max)} />
                <StatTile label="Total dépensé" value={fmtEuro(stats.totalSpent)} />
              </div>
            </section>
          )}

          {sortedPoints.length > 0 && (
            <section>
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#6B6B6B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  margin: '0 0 8px 0',
                }}
              >
                Historique des achats
              </h3>
              <div
                style={{
                  border: '1px solid #E8E8E6',
                  borderRadius: 12,
                  background: '#FFFFFF',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    ...TABLE_ROW,
                    background: '#F3F1EC',
                    fontSize: 11,
                    color: '#6B6B6B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontWeight: 600,
                  }}
                >
                  <span>Date</span>
                  <span>Drive</span>
                  <span>PU TTC</span>
                  <span>Qté</span>
                  <span style={{ textAlign: 'right' }}>Total</span>
                </div>
                {sortedPoints.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      ...TABLE_ROW,
                      borderTop: '1px solid #E8E8E6',
                    }}
                  >
                    <span>{fmtDate(p.purchase_date)}</span>
                    <span style={{ color: '#1A1A1A' }}>{driveLabel(p.drive_name)}</span>
                    <span>{fmtEuro(p.unit_price_ttc)}</span>
                    <span>{p.quantity_ordered}</span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>
                      {fmtEuro(p.total_ttc)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        background: '#FFFFFF',
        border: '1px solid #E8E8E6',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: '#6B6B6B',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{value}</div>
    </div>
  );
}

export default ProductDetailModal;
