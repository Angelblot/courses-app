import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ENSEIGNES, type ComparaisonDrives } from '../lib/commandes.ts';
import { euros, pourcent, teinteDrive, teinteEcart } from '../lib/format-commande.ts';
import { colors } from '../lib/theme';

const nom = (d: string) => ENSEIGNES[d] ?? d;
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/**
 * Le verdict entre drives (variante CM1) : le moins cher et de combien, sur
 * les produits trouvés partout ; les totaux côte à côte avec les produits
 * introuvables ; combien de produits chaque drive gagne. Dessous, l'écart
 * de chaque drive avec les achats précédents.
 */
export function VerdictDrives({ comparaison: c, introuvables, historique, onDrive }: {
  comparaison: ComparaisonDrives;
  introuvables: Record<string, number>;
  historique: { drive: string; ecart: number | null; communs: number }[];
  onDrive: (drive: string) => void;
}) {
  const n = c.communs.length, deux = c.drives.length === 2;
  const egalites = n - c.drives.reduce((s, d) => s + (c.victoires[d] ?? 0), 0);
  const titre = `Sur les ${pluriel(n, 'produit')} trouvé${n > 1 ? 's' : ''} ${deux ? 'des deux côtés' : 'partout'}`;
  const verdict = !n ? 'Aucun produit trouvé partout : rien à comparer.'
    : c.moinsCher ? `${nom(c.moinsCher)} est moins cher de ${euros(c.economie)}` : 'Même total partout';
  const part = (v: number) => `${(v / Math.max(1, n)) * 100}%` as const;
  const ordre = deux ? [c.drives[0], null, c.drives[1]] : [...c.drives, null];
  return <View style={{ gap: 10 }}>
    <View style={s.verdict} accessible accessibilityLabel={`${n ? `${titre} : ` : ''}${verdict}. ${c.drives.map(d => `${nom(d)} ${euros(c.totaux[d] ?? 0)}, ${pluriel(introuvables[d] ?? 0, 'introuvable')}, ${pluriel(c.victoires[d] ?? 0, 'produit')} moins cher${(c.victoires[d] ?? 0) > 1 ? 's' : ''}`).join('. ')}${egalites ? `. ${pluriel(egalites, 'produit')} au même prix` : ''}.`}>
      {!!n && <Text style={s.petit}>{titre}</Text>}
      <Text style={s.grand}>{verdict}</Text>
      {!!n && <>
        <View style={s.tuiles}>
          {c.drives.map(d => { const gagne = d === c.moinsCher; return <View key={d} style={[s.tuile, gagne && s.tuileGagne]}>
            <Text style={[s.tuileNom, { color: gagne ? teinteDrive(d).fonce : '#CFE0BF' }]}>{nom(d)}</Text>
            <Text style={[s.tuileTotal, gagne && { color: colors.text }]}>{euros(c.totaux[d] ?? 0)}</Text>
            <Text style={[s.tuileDetail, gagne && { color: colors.textMuted }]}>{introuvables[d] ? pluriel(introuvables[d], 'introuvable') : 'tout trouvé'}</Text>
          </View>; })}
        </View>
        <View style={s.barre}>
          {ordre.map((d, i) => { const v = d ? c.victoires[d] ?? 0 : egalites; return v ? <View key={d ?? `eg${i}`} style={{ width: part(v), backgroundColor: d ? teinteDrive(d).clair : 'rgba(255,255,255,0.35)' }} /> : null; })}
        </View>
        <View style={s.gains}>
          {c.drives.map((d, i) => <Text key={d} style={s.gain}>{i === 0 ? `${pluriel(c.victoires[d] ?? 0, 'moins cher')} chez ${nom(d)}` : `${c.victoires[d] ?? 0} chez ${nom(d)}`}</Text>)}
        </View>
      </>}
    </View>
    <View style={s.carte}>
      <Text style={s.carteTitre}>Par rapport à tes achats précédents</Text>
      {historique.map((h, i) => <Pressable key={h.drive} accessibilityRole="button" onPress={() => onDrive(h.drive)}
        accessibilityLabel={`${nom(h.drive)} : ${h.communs ? `${h.ecart != null && Math.abs(h.ecart) >= 0.01 ? pourcent(h.ecart) : 'stable'} sur ${pluriel(h.communs, 'produit')} déjà acheté${h.communs > 1 ? 's' : ''}` : 'premiers achats'}. Voir le détail.`}
        style={({ pressed }) => [s.ligne, i > 0 && s.separe, pressed && { backgroundColor: colors.off }]}>
        <Text style={[s.etiquette, { backgroundColor: teinteDrive(h.drive).fonce }]}>{nom(h.drive)}</Text>
        <Text style={s.ligneDetail}>{h.communs ? `sur ${pluriel(h.communs, 'produit')} déjà acheté${h.communs > 1 ? 's' : ''}` : 'premiers achats'}</Text>
        {!!h.communs && <Text style={[s.ecart, { color: teinteEcart(h.ecart, colors.textMuted) }]}>{h.ecart != null && Math.abs(h.ecart) >= 0.01 ? pourcent(h.ecart) : 'stable'}</Text>}
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </Pressable>)}
    </View>
  </View>;
}

const s = StyleSheet.create({
  verdict: { backgroundColor: colors.text, borderRadius: 18, padding: 14, gap: 8 },
  petit: { fontSize: 12, fontWeight: '600', color: '#CFE0BF' },
  grand: { fontSize: 23, lineHeight: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.3 },
  tuiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tuile: { flexGrow: 1, flexBasis: '45%', borderRadius: 12, padding: 10, gap: 2, backgroundColor: 'rgba(255,255,255,0.08)' },
  tuileGagne: { backgroundColor: '#FFFFFF' },
  tuileNom: { fontSize: 12, fontWeight: '700' },
  tuileTotal: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  tuileDetail: { fontSize: 12, color: '#DDE6D4' },
  barre: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.15)' },
  gains: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  gain: { fontSize: 12, color: '#DDE6D4' },
  carte: { backgroundColor: colors.surface, borderRadius: 16, paddingTop: 12, overflow: 'hidden' },
  carteTitre: { fontSize: 12, fontWeight: '600', color: colors.textMuted, paddingHorizontal: 14, paddingBottom: 4 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 14 },
  separe: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  etiquette: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  ligneDetail: { flex: 1, fontSize: 13, color: colors.textMuted },
  ecart: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
