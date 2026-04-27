import { useState, useEffect, useRef } from 'react';
import { ResolverAPI } from '../../api.js';
import { AsyncImage } from '../ui/AsyncImage.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Icon } from '../ui/Icon.jsx';

const PRODUCT_ICONS = ['package', 'bag', 'shopping-bag', 'box'];

function iconForProduct(p) {
  const key = String(p.product_id ?? p.id ?? p.name ?? '')
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  return PRODUCT_ICONS[key % PRODUCT_ICONS.length];
}

function ScoreDot({ score }) {
  // Score discret : pastille de couleur
  let color;
  if (score >= 0.3) color = '#22c55e';
  else if (score >= 0.15) color = '#eab308';
  else color = '#ef4444';

  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
      }}
      title={`Score: ${(score * 100).toFixed(0)}%`}
    />
  );
}

export function ProductSubstitutionSheet({
  isOpen,
  onClose,
  ingredientName,
  ingredientQty,
  ingredientUnit,
  categoryHint,
  onSelect,
}) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedId(null);
    setLoading(true);
    setCandidates([]);

    ResolverAPI.resolve({
      ingredient_name: ingredientName,
      ingredient_qty: ingredientQty || 0,
      ingredient_unit: ingredientUnit || 'unité',
      category_hint: categoryHint || null,
      limit: 3,
    })
      .then((data) => {
        setCandidates(data.candidates || []);
      })
      .catch(() => {
        setCandidates([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen, ingredientName, ingredientQty, ingredientUnit, categoryHint]);

  function handleSelect(candidate) {
    if (saving) return;
    setSelectedId(candidate.product_id);
    setSaving(true);

    ResolverAPI.select({
      ingredient_name: ingredientName,
      product_id: candidate.product_id,
      qty: candidate.pack_count,
    })
      .catch(() => {
        // Silently fail — preference is best-effort
      })
      .finally(() => {
        setSaving(false);
        if (onSelect) {
          onSelect(candidate);
        }
        onClose();
      });
  }

  if (!isOpen) return null;

  const bestScore = candidates.length > 0 ? candidates[0].score : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          zIndex: 999,
        }}
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: '#ffffff',
          borderRadius: '16px 16px 0 0',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.1)',
        }}
      >
        {/* Handle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px 0 4px',
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              backgroundColor: '#e2e8f0',
              borderRadius: 2,
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px 12px',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: '#0f172a',
                margin: 0,
              }}
            >
              Choisir un produit
            </h2>
            <p
              style={{
                fontSize: 13,
                color: '#64748b',
                margin: '2px 0 0',
              }}
            >
              {ingredientName}
              {ingredientQty > 0 && ` — ${ingredientQty}${ingredientUnit || ''}`}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: '#94a3b8',
            }}
            aria-label="Fermer"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 20px 20px' }}>
          {loading && (
            <div
              style={{
                textAlign: 'center',
                padding: '32px 0',
                color: '#94a3b8',
                fontSize: 14,
              }}
            >
              Recherche des produits...
            </div>
          )}

          {!loading && candidates.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '32px 0',
                color: '#94a3b8',
                fontSize: 14,
              }}
            >
              Aucun produit trouve pour cet ingredient.
            </div>
          )}

          {!loading &&
            candidates.map((candidate, index) => {
              const isBest = index === 0;
              const isSelected = selectedId === candidate.product_id;

              return (
                <button
                  key={candidate.product_id}
                  onClick={() => handleSelect(candidate)}
                  disabled={saving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '12px 16px',
                    marginBottom: 8,
                    border: `1px solid ${
                      isSelected ? '#3b82f6' : isBest ? '#e2e8f0' : '#f1f5f9'
                    }`,
                    borderRadius: 12,
                    backgroundColor: isSelected
                      ? '#eff6ff'
                      : isBest
                        ? '#fafafa'
                        : '#ffffff',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    position: 'relative',
                    opacity: saving && !isSelected ? 0.6 : 1,
                  }}
                >
                  {/* Product image */}
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      backgroundColor: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      overflow: 'hidden',
                    }}
                  >
                    {candidate.image_url ? (
                      <img
                        src={candidate.image_url}
                        alt={candidate.product_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = `<span style="color:#94a3b8;font-size:20px">📦</span>`;
                        }}
                      />
                    ) : (
                      <Icon
                        name={iconForProduct(candidate)}
                        size={22}
                        color="#94a3b8"
                      />
                    )}
                  </div>

                  {/* Product info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: '#0f172a',
                          lineHeight: 1.3,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {candidate.product_name}
                      </span>
                      <ScoreDot score={candidate.score} />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 4,
                        flexWrap: 'wrap',
                      }}
                    >
                      {candidate.brand && (
                        <span
                          style={{
                            fontSize: 12,
                            color: '#64748b',
                          }}
                        >
                          {candidate.brand}
                        </span>
                      )}
                      {candidate.grammage_g && (
                        <span
                          style={{
                            fontSize: 12,
                            color: '#94a3b8',
                          }}
                        >
                          {candidate.grammage_g}g
                        </span>
                      )}
                      {candidate.pack_count > 1 && (
                        <span
                          style={{
                            fontSize: 12,
                            color: '#64748b',
                          }}
                        >
                          x{candidate.pack_count}
                          {candidate.actual_grammage
                            ? ` (${candidate.actual_grammage}g)`
                            : ''}
                        </span>
                      )}
                      {candidate.pack_count === 1 &&
                        candidate.actual_grammage &&
                        ingredientQty > 0 &&
                        candidate.actual_grammage < ingredientQty && (
                          <span
                            style={{
                              fontSize: 12,
                              color: '#64748b',
                            }}
                          >
                            x2 pour couvrir {ingredientQty}
                            {ingredientUnit || 'g'}
                          </span>
                        )}
                    </div>
                  </div>

                  {/* Badges + arrow */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    {isBest && (
                      <Badge variant="primary" style={{ fontSize: 11 }}>
                        Recommande
                      </Badge>
                    )}
                    {candidate.store_brand_affinity && (
                      <Badge variant="secondary" style={{ fontSize: 11 }}>
                        Marque du magasin
                      </Badge>
                    )}
                    <Icon name="chevron-right" size={16} color="#cbd5e1" />
                  </div>
                </button>
              );
            })}

          {/* Grammage hint */}
          {candidates.length > 0 && candidates[0].pack_count > 1 && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 12px',
                backgroundColor: '#f8fafc',
                borderRadius: 8,
                fontSize: 12,
                color: '#64748b',
                lineHeight: 1.4,
              }}
            >
              Quantite ajustee : {candidates[0].pack_count} paquet
              {candidates[0].pack_count > 1 ? 's' : ''}
              {candidates[0].actual_grammage
                ? ` (${candidates[0].actual_grammage}g)`
                : ''}{' '}
              pour couvrir le besoin de la recette.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
