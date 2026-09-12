import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { AppState, Image } from 'react-native';
import { usePathname } from 'expo-router';
import { useProducts } from '../stores/products';
import { useRecipes } from '../stores/recipes';
import type { Etat } from '../contexts/WizardContext';
import { nativeInbox } from '../lib/native-inbox';
import { photoSecours } from '../lib/photos-maison';
import { widgetProducts } from '../lib/widget-products';

/** Never put an auth token in the widget. Only a local snapshot and thumbnails. */
export function WidgetSync({ account, state, writes }: { account: string; state: Etat; writes: MutableRefObject<Promise<void>> }) {
  const p = useProducts(), r = useRecipes(), path = usePathname();
  const lastPath = useRef(path);
  useEffect(() => {
    if (lastPath.current !== path) { void p.recharger(); void r.recharger(); lastPath.current = path; }
    const sub = AppState.addEventListener('change', value => { if (value === 'active') { void p.recharger(); void r.recharger(); } });
    return () => sub.remove();
  }, [path, p.recharger, r.recharger]);
  const payload = useMemo(() => JSON.stringify({
    products: widgetProducts(state, p.produits, r.recettes).map(p => ({...p,
      imageURL: p.imageURL || (photoSecours(p.name) ? Image.resolveAssetSource(photoSecours(p.name)).uri : null),
    })), imported: state.importsExternes ?? [],
  }), [state, p.produits, r.recettes]);
  useEffect(() => {
    if (p.chargement || r.chargement || p.erreur || r.erreur) return;
    let active = true;
    const timer = setTimeout(() => {
      // Commit the very same snapshot before clearing widget receipts.
      writes.current = writes.current.then(async () => {
        if (!active) return;
        const storage = (await import('@react-native-async-storage/async-storage')).default;
        await storage.setItem(`tablee-maison-v1:${account}`, JSON.stringify(state));
        if (active) await nativeInbox?.syncProducts(account, payload);
      }).catch(() => { /* Preserve the last working widget and retry on foreground. */ });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [account, payload, state, p.chargement, r.chargement, p.erreur, r.erreur, writes]);
  return null;
}
