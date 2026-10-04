import { StyleSheet, Text, View } from 'react-native';
import { DRIVES_LIENS, etatDrive, type EtatDrive, type FaitsLiens } from '../lib/liens';
import type { Enseigne } from '../lib/references';
import type { Product } from '../stores/products';
import { colors } from '../lib/theme';

export const NOMS_DRIVES: Record<Enseigne, string> = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' };
export const MOTS_LIENS: Record<EtatDrive, string> = { relie: 'relié', absent: 'absent', aucun: 'pas de lien', hors: '' };

/** L'état de chaque drive en une phrase, pour les lecteurs d'écran. */
export function phraseLiens(produit: Product, faits: FaitsLiens | undefined): string {
  if (produit.vendu_chez === 'ailleurs') return `Hors drive${produit.lieu_achat ? `, ${produit.lieu_achat}` : ''}`;
  return DRIVES_LIENS.map(d => ({ d, e: etatDrive(produit, d, faits) })).filter(x => x.e !== 'hors')
    .map(x => `${NOMS_DRIVES[x.d]} : ${MOTS_LIENS[x.e]}`).join(', ');
}

/**
 * Une pastille par drive, partout la même : verte quand le drive connaît le
 * produit, ambre sans lien, grise quand il y est absent ; un drive sans objet
 * (produit réservé à l'autre) n'apparaît pas. « Hors drive » pour un produit
 * acheté ailleurs.
 */
export function PastillesDrives({ produit, faits }: { produit: Product; faits: FaitsLiens | undefined }) {
  if (produit.vendu_chez === 'ailleurs') return <View style={s.puces} accessible={false}><Text style={[s.puce, s.aucun]}>Hors drive{produit.lieu_achat ? ` · ${produit.lieu_achat}` : ''}</Text></View>;
  const etats = DRIVES_LIENS.map(d => ({ d, e: etatDrive(produit, d, faits) })).filter(x => x.e !== 'hors');
  return <View style={s.puces} accessible={false}>
    {etats.map(x => <Text key={x.d} style={[s.puce, x.e === 'relie' ? s.relie : x.e === 'absent' ? s.absent : s.aucun]}>
      {x.e === 'relie' ? NOMS_DRIVES[x.d] : `${NOMS_DRIVES[x.d]} · ${MOTS_LIENS[x.e]}`}</Text>)}
  </View>;
}

const s = StyleSheet.create({
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  puce: { fontSize: 11, fontWeight: '700', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  relie: { color: '#2F6B2F', backgroundColor: '#E7F0E1' },
  absent: { color: colors.textMuted, backgroundColor: colors.bg },
  aucun: { color: colors.attentionText, backgroundColor: colors.attentionSoft },
});
