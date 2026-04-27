import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';

const OVERLAY_STYLE = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  background: 'rgba(0,0,0,0.32)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  animation: 'fadeIn 200ms ease',
};

const SHEET_STYLE = {
  background: '#FFFFFF',
  borderRadius: '20px 20px 0 0',
  padding: '24px 20px',
  paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
  maxWidth: 440,
  width: '100%',
  margin: '0 auto',
  animation: 'slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1)',
  boxShadow: '0 -8px 30px rgba(0,0,0,0.12)',
};

const HANDLE_STYLE = {
  width: 36,
  height: 4,
  borderRadius: 2,
  background: '#D8D6D2',
  margin: '0 auto 20px',
};

export function GrammageBottomSheet({ product, onSave, onClose }) {
  const [grammageG, setGrammageG] = useState('');
  const [volumeMl, setVolumeMl] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (product.grammage_g != null) setGrammageG(String(product.grammage_g));
    if (product.volume_ml != null) setVolumeMl(String(product.volume_ml));
    // Auto-focus on mount
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 350);
  }, [product]);

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleSave() {
    const g = grammageG.trim() ? parseInt(grammageG, 10) : null;
    const v = volumeMl.trim() ? parseInt(volumeMl, 10) : null;
    if (g == null && v == null) return;
    onSave(product.id, g, v);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave();
  }

  const hasGrammage = product.grammage_g != null || product.volume_ml != null;

  return (
    <div style={OVERLAY_STYLE} onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-label="Indiquer le grammage">
      <div style={SHEET_STYLE}>
        <div style={HANDLE_STYLE} />
        <div className="stack stack--md">
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{product.name}</h3>
            <p style={{ fontSize: 13, color: '#6B6B6B' }}>
              {hasGrammage
                ? 'Modifie le poids ou le volume de ce produit.'
                : 'Indique le poids ou le volume de ce produit pour permettre les calculs de quantites dans les recettes.'}
            </p>
          </div>

          <div className="stack stack--sm">
            <Input
              ref={inputRef}
              label="Poids (en grammes)"
              type="number"
              min={0}
              placeholder="Ex: 200"
              value={grammageG}
              onChange={(e) => setGrammageG(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div style={{ textAlign: 'center', fontSize: 13, color: '#9A9A97', padding: '4px 0' }}>ou</div>
            <Input
              label="Volume (en ml)"
              type="number"
              min={0}
              placeholder="Ex: 330"
              value={volumeMl}
              onChange={(e) => setVolumeMl(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={!grammageG.trim() && !volumeMl.trim()}
              style={{ flex: 1 }}
            >
              Enregistrer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
