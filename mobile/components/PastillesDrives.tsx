import { StyleSheet, Text, View } from 'react-native';
import { DRIVES_LIENS, etatDrive, type FaitsLiens } from '../lib/liens';
import type { Enseigne } from '../lib/references';
import type { Product } from '../stores/products';
import { colors } from '../lib/theme';

export const NOMS_DRIVES: Record<Enseigne, string> = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' };

/** Les drives où le produit est disponible, c'est-à-dire reliés. */
function drivesDisponibles(produit: Product, faits: FaitsLiens | undefined): Enseigne[] {
  return DRIVES_LIENS.filter(d => etatDrive(produit, d, faits) === 'relie');
}

/** Où trouver le produit, en une phrase, pour les lecteurs d'écran. */
export function phraseLiens(produit: Product, faits: FaitsLiens | undefined): string {
  if (produit.vendu_chez === 'ailleurs') return `Hors drive${produit.lieu_achat ? `, ${produit.lieu_achat}` : ''}`;
  const drives = drivesDisponibles(produit, faits);
  return drives.length ? `Disponible chez ${drives.map(d => NOMS_DRIVES[d]).join(' et ')}` : 'Aucun drive relié';
}

/**
 * Une pastille verte par drive où le produit est disponible, partout la même.
 * Rien pour un drive qui ne le connaît pas ou ne le vend pas. « Hors drive »
 * pour un produit acheté ailleurs. Toujours sur une ligne : les lignes de
 * hauteur fixe (ordre d'essai) n'ont pas la place d'une seconde.
 */
export function PastillesDrives({ produit, faits }: { produit: Product; faits: FaitsLiens | undefined }) {
  if (produit.vendu_chez === 'ailleurs') return <View style={s.puces} accessible={false}>
    <Text style={[s.puce, s.hors]} numberOfLines={1}>Hors drive{produit.lieu_achat ? ` · ${produit.lieu_achat}` : ''}</Text>
  </View>;
  const drives = drivesDisponibles(produit, faits);
  if (!drives.length) return null;
  return <View style={s.puces} accessible={false}>
    {drives.map(d => <Text key={d} style={[s.puce, s.relie]} numberOfLines={1}>{NOMS_DRIVES[d]}</Text>)}
  </View>;
}

const s = StyleSheet.create({
  puces: { flexDirection: 'row', gap: 6, overflow: 'hidden' },
  puce: { flexShrink: 1, fontSize: 11, fontWeight: '700', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  relie: { color: '#2F6B2F', backgroundColor: '#E7F0E1' },
  hors: { color: colors.textMuted, backgroundColor: colors.bg },
});
