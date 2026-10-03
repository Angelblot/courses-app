import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ComparaisonHistorique, Evolution } from '../lib/commandes.ts';
import { ENSEIGNES } from '../lib/commandes.ts';
import { euros, moisCourt, pourcent, teinteEcart, BAISSE, HAUSSE } from '../lib/format-commande.ts';
import { Photo } from './MaisonUI';
import { appuiLongFiche } from './FicheAppuiLong';
import { colors } from '../lib/theme';

/**
 * Comparaison d'une commande avec les achats précédents (variante EP2a) :
 * l'écart en grand sur les produits déjà achetés, la part qui baisse, reste
 * stable ou monte, les deux plus fortes hausses et la plus forte baisse.
 */
export function ComparaisonCommande({ comparaison: c, drive, image, onVoir }: {
  comparaison: ComparaisonHistorique;
  /** Précisé quand le panier couvre plusieurs drives. */
  drive?: string;
  image: (e: Evolution) => string | null;
  onVoir: () => void;
}) {
  const titre = `${drive ? `${ENSEIGNES[drive] ?? drive}, par` : 'Par'} rapport à tes achats précédents`;
  if (!c.communs) return <View style={s.carte}>
    <Text style={s.titre}>{titre}</Text>
    <Text style={s.vide}>Aucun de ces produits n’avait encore été acheté : la comparaison viendra à la prochaine commande.</Text>
  </View>;
  const changes = c.evolutions.filter(e => e.ecart != null && Math.abs(e.ligne.prix! - e.avant!.prix) >= 0.01);
  const hausses = changes.filter(e => e.ecart! > 0).slice(0, 2), baisses = changes.filter(e => e.ecart! < 0).reverse();
  const montres = [...hausses, ...baisses.slice(0, Math.max(1, 3 - hausses.length))];
  const part = (n: number) => `${(n / c.communs) * 100}%` as const;
  const resume = `${c.communs} produit${c.communs > 1 ? 's' : ''} · ${euros(c.totalAvant)} → ${euros(c.totalMaintenant)}`;
  return <View style={s.carte}>
    <Text style={s.titre}>{titre}</Text>
    <View style={s.grand} accessible accessibilityLabel={`${c.ecart != null && Math.abs(c.ecart) >= 0.01 ? pourcent(c.ecart) : 'Stable'} sur ${c.communs} produits déjà achetés : ${euros(c.totalAvant)} la dernière fois, ${euros(c.totalMaintenant)} cette fois. ${c.baisses} en baisse, ${c.stables} stables, ${c.hausses} en hausse.`}>
      <Text style={[s.ecart, { color: teinteEcart(c.ecart, colors.text) }]}>{c.ecart != null && Math.abs(c.ecart) >= 0.01 ? pourcent(c.ecart) : 'Stable'}</Text>
      <Text style={s.resume}>{resume}</Text>
    </View>
    <View style={s.barre} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {!!c.baisses && <View style={{ width: part(c.baisses), backgroundColor: BAISSE }} />}
      {!!c.stables && <View style={{ width: part(c.stables), backgroundColor: '#C9CEC4' }} />}
      {!!c.hausses && <View style={{ width: part(c.hausses), backgroundColor: HAUSSE }} />}
    </View>
    {montres.map(e => <Pressable key={`${e.ligne.drive}${e.ligne.libelle}`} {...appuiLongFiche({ id: e.ligne.product_id, ean13: e.ligne.ean13 })} style={({ pressed }) => [s.ligne, pressed && { backgroundColor: colors.off }]} accessible
      accessibilityLabel={`${e.ligne.libelle}, ${euros(e.avant!.prix)} puis ${euros(e.ligne.prix!)}, ${pourcent(e.ecart!)}`}>
      <Photo name={e.ligne.libelle} url={image(e)} style={s.photo} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={s.nom} numberOfLines={1}>{e.ligne.libelle}</Text>
        <Text style={s.detail}>{euros(e.avant!.prix)} → {euros(e.ligne.prix!)} · {moisCourt(e.avant!.jour)}</Text>
      </View>
      <Text style={[s.delta, { color: e.ecart! > 0 ? HAUSSE : BAISSE }]}>{pourcent(e.ecart!)}</Text>
    </Pressable>)}
    <Pressable accessibilityRole="button" onPress={onVoir} style={({ pressed }) => [s.lien, pressed && { backgroundColor: colors.off }]}>
      <Text style={s.lienTexte}>Voir les {c.communs + c.nouveaux} produits</Text>
    </Pressable>
  </View>;
}

const s = StyleSheet.create({
  carte: { backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: 14, paddingTop: 14, gap: 2, overflow: 'hidden' },
  titre: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  vide: { fontSize: 14, lineHeight: 20, color: colors.text, paddingVertical: 10 },
  grand: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  ecart: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  resume: { fontSize: 13, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  barre: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.off, marginTop: 8, marginBottom: 6 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  photo: { width: 36, height: 36, borderRadius: 6 },
  nom: { fontSize: 14, fontWeight: '600', color: colors.text },
  detail: { fontSize: 12, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  delta: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 48, textAlign: 'right' },
  lien: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginHorizontal: -14 },
  lienTexte: { fontSize: 15, fontWeight: '600', color: colors.accent },
});
