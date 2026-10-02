import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { echelleTemps, reperesPrix, type Achat } from '../lib/historique-prix.ts';
import { useHistoriquePrix } from '../stores/historique';
import { ui } from './MaisonUI';
import { colors } from '../lib/theme';

const HAUTEUR = 130, AXE = 34, MARGE = 8, VISIBLES = 5;
const BAISSE = '#2F6B2F', HAUSSE = '#9A3A22', LECLERC = '#2E5683', POINTILLE = '#9AA394';
const euros = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;
const jour = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const mois = (iso: string, annee = true) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', annee ? { month: 'short', year: 'numeric' } : { month: 'short' });
const pourcent = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(Math.round(v * 100))} %`;

/** Un trait pointillé, fait de petits segments : les bordures pointillées d'iOS ne tiennent pas sur un seul côté. */
function Pointilles({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const horizontal = y1 === y2, longueur = horizontal ? Math.abs(x2 - x1) : Math.abs(y2 - y1);
  const n = Math.floor(longueur / 6);
  return <>{Array.from({ length: n + 1 }, (_, i) => {
    const d = Math.min(i * 6, longueur);
    return <View key={i} style={[s.tiret, horizontal
      ? { left: Math.min(x1, x2) + d, top: y1 - 0.75, width: Math.min(3, longueur - d), height: 1.5 }
      : { left: x1 - 0.75, top: Math.min(y1, y2) + d, width: 1.5, height: Math.min(3, longueur - d) }]} />;
  })}</>;
}

/**
 * Prix payé (variante EP1) : le dernier prix en grand et l'écart depuis le
 * premier achat, la courbe des achats — le prix affiché en pointillés,
 * chaque achat un point, cerclé quand il était en promotion — puis la
 * liste, remise comprise. Les longs trous coupent l'axe du temps.
 */
export function PrixPaye({ produitId, ean13 }: { produitId: string; ean13?: string | null }) {
  const { historique, chargement, erreur } = useHistoriquePrix(produitId, ean13);
  const [largeur, setLargeur] = useState(0), [tout, setTout] = useState(false);
  const { achats, dernier, ecart, depuis } = historique;
  const temps = useMemo(() => echelleTemps(achats.map(a => a.jour)), [achats]);
  const echelle = useMemo(() => achats.length ? reperesPrix(achats.flatMap(a => [a.paye, a.affiche])) : null, [achats]);

  if (chargement) return null;
  if (erreur) return <Text style={[ui.error, { alignSelf: 'stretch', marginTop: 20 }]}>{erreur}</Text>;
  if (!dernier || !echelle) return null;

  const zone = Math.max(0, largeur - AXE - MARGE * 2);
  const x = (a: Achat) => AXE + MARGE + temps.x(a.jour) * zone;
  const y = (v: number) => (HAUTEUR - 12) * (1 - (v - echelle.min) / Math.max(0.01, echelle.max - echelle.min)) + 6;
  const promo = achats.some(a => a.remise > 0), leclerc = achats.some(a => a.drive === 'leclerc');
  const stable = ecart != null && Math.abs(ecart) < 0.01;
  const recents = [...achats].reverse(), affiches = tout ? recents : recents.slice(0, VISIBLES);

  // Dates sous l'axe : la première, la dernière, et celle qui précède chaque coupure.
  const dates: { cle: string; texte: string; gauche: number; aligne: 'left' | 'right' }[] = [];
  if (achats.length > 1 && largeur > 0) {
    dates.push({ cle: 'debut', texte: mois(achats[0].jour), gauche: x(achats[0]) - 6, aligne: 'left' });
    temps.coupures.forEach((c, i) => {
      const avant = [...achats].reverse().find(a => temps.x(a.jour) < c);
      const position = avant ? x(avant) : 0;
      const fin = x(dernier), precedente = dates.at(-1)!;
      // Une date intermédiaire ne s'affiche que si elle a la place entre ses voisines.
      if (avant && position - (precedente.aligne === 'left' ? precedente.gauche + 70 : precedente.gauche) > 40 && fin - position > 80) dates.push({ cle: `c${i}`, texte: mois(avant.jour, false), gauche: position + 6, aligne: 'right' });
    });
    dates.push({ cle: 'fin', texte: mois(dernier.jour), gauche: x(dernier) + 6, aligne: 'right' });
  }
  const resume = `Dernier prix payé ${euros(dernier.paye)} le ${jour(dernier.jour)}`
    + (ecart != null && depuis ? `, ${stable ? 'stable' : pourcent(ecart)} depuis ${mois(depuis)}` : '')
    + `, ${achats.length} achat${achats.length > 1 ? 's' : ''}.`;

  return <View style={s.zone}>
    <View style={s.tete}><Text style={s.titre} accessibilityRole="header">Prix payé</Text><Text style={ui.detail}>{achats.length} achat{achats.length > 1 ? 's' : ''}</Text></View>
    <View style={s.carte}>
      <View style={s.kpi} accessible accessibilityLabel={resume}>
        <Text style={s.prix}>{euros(dernier.paye)}</Text>
        {ecart != null && depuis && <Text style={[s.ecart, { color: stable ? colors.textMuted : ecart < 0 ? BAISSE : HAUSSE }]}>{stable ? 'stable' : pourcent(ecart)} depuis {new Date(`${depuis}T12:00:00`).getFullYear()}</Text>}
        <Text style={s.quand}>{jour(dernier.jour)}</Text>
      </View>
      {achats.length > 1 && <>
        <View onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)} style={{ height: HAUTEUR }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {echelle.reperes.map(v => <View key={v} style={[s.repere, { top: y(v) }]}>
            <Text style={s.repereTexte}>{String(v).replace('.', ',')}</Text><View style={s.trait} /></View>)}
          {largeur > 0 && achats.slice(1).map((a, i) => {
            const p = achats[i];
            return <View key={`l${a.jour}${a.lieu}`} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Pointilles x1={x(p)} y1={y(p.affiche)} x2={x(a)} y2={y(p.affiche)} />
              {p.affiche !== a.affiche && <Pointilles x1={x(a)} y1={y(p.affiche)} x2={x(a)} y2={y(a.affiche)} />}
            </View>;
          })}
          {largeur > 0 && temps.coupures.map(c => <View key={c} style={[s.coupure, { left: AXE + MARGE + c * zone - 6 }]}>
            <View style={s.biais} /><View style={s.biais} /></View>)}
          {largeur > 0 && achats.map(a => {
            const enPromo = a.remise > 0, taille = enPromo ? 10 : 9;
            return <View key={`p${a.jour}${a.lieu}`} style={[s.point, {
              left: x(a) - taille / 2, top: y(a.paye) - taille / 2, width: taille, height: taille,
              borderRadius: a.drive === 'leclerc' ? 2 : taille / 2,
            }, enPromo ? s.pointPromo : { backgroundColor: a.drive === 'leclerc' ? LECLERC : colors.accent }]} />;
          })}
        </View>
        <View style={s.dates} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {dates.map(d => <Text key={d.cle} numberOfLines={1} style={[s.date, d.aligne === 'left' ? { left: Math.max(0, d.gauche) } : { right: Math.max(0, largeur - d.gauche) }]}>{d.texte}</Text>)}
        </View>
        <View style={s.legende} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={s.cle}><View style={[s.puce, { backgroundColor: colors.accent }]} /><Text style={s.cleTexte}>payé</Text></View>
          {promo && <View style={s.cle}><View style={[s.puce, s.pointPromo]} /><Text style={s.cleTexte}>payé en promo</Text></View>}
          {leclerc && <View style={s.cle}><View style={[s.puce, { backgroundColor: LECLERC, borderRadius: 2 }]} /><Text style={s.cleTexte}>E.Leclerc</Text></View>}
          <View style={s.cle}><View style={s.cleTiret}><View style={s.cleTiretBout} /><View style={s.cleTiretBout} /></View><Text style={s.cleTexte}>prix affiché</Text></View>
        </View>
      </>}
    </View>
    <View style={s.liste}>
      {affiches.map((a, i) => <View key={`${a.jour}${a.lieu}`} style={[s.ligne, i > 0 && s.separe]}
        accessible accessibilityLabel={`${jour(a.jour)}, ${a.lieu}, ${euros(a.paye)}${a.remise > 0 ? `, en promotion, ${pourcent(-a.remise)}, au lieu de ${euros(a.affiche)}` : ''}${a.releve ? ', prix relevé sur le drive' : ''}`}>
        <View style={s.ligneTexte}>
          <Text style={s.ligneDate}>{jour(a.jour)} · {a.lieu}</Text>
          {a.remise > 0 && <Text style={s.pastille}>{pourcent(-a.remise)}</Text>}
          {a.releve && <Text style={s.releve}>relevé sur le drive</Text>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.lignePrix}>{euros(a.paye)}</Text>
          {(a.remise > 0 || a.quantite > 1) && <Text style={s.ligneSous}>{a.remise > 0 ? `au lieu de ${euros(a.affiche)}` : `× ${a.quantite}`}</Text>}
        </View>
      </View>)}
      {recents.length > VISIBLES && <Pressable accessibilityRole="button" onPress={() => setTout(v => !v)} style={({ pressed }) => [s.ligne, s.separe, pressed && { backgroundColor: colors.off }]}>
        <Text style={s.plus}>{tout ? 'Voir moins' : `Voir les ${recents.length} achats`}</Text>
      </Pressable>}
    </View>
  </View>;
}

const s = StyleSheet.create({
  zone: { alignSelf: 'stretch', gap: 8, marginTop: 20 },
  tete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  titre: { fontSize: 18, fontWeight: '700', color: colors.text },
  carte: { backgroundColor: colors.surface, borderRadius: 16, padding: 12, gap: 6 },
  kpi: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 2, paddingBottom: 4 },
  prix: { fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  ecart: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  quand: { fontSize: 12, color: colors.textMuted, marginLeft: 'auto' },
  repere: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -7 },
  repereTexte: { width: AXE - 6, fontSize: 11, color: colors.textMuted, textAlign: 'right', fontVariant: ['tabular-nums'] },
  trait: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  tiret: { position: 'absolute', backgroundColor: POINTILLE },
  coupure: { position: 'absolute', bottom: -2, width: 12, height: 10, flexDirection: 'row', gap: 3, justifyContent: 'center' },
  biais: { width: 1.4, height: 10, backgroundColor: colors.textMuted, transform: [{ rotate: '35deg' }] },
  point: { position: 'absolute' },
  pointPromo: { backgroundColor: colors.surface, borderWidth: 2.2, borderColor: BAISSE },
  dates: { height: 16 },
  date: { position: 'absolute', top: 0, fontSize: 11, color: colors.textMuted },
  legende: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 2 },
  cle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  puce: { width: 9, height: 9, borderRadius: 5 },
  cleTiret: { width: 14, flexDirection: 'row', gap: 3 },
  cleTiretBout: { width: 5, height: 2, backgroundColor: POINTILLE },
  cleTexte: { fontSize: 12, color: colors.textMuted },
  liste: { backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, paddingVertical: 6 },
  separe: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  ligneTexte: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  ligneDate: { fontSize: 14, color: colors.text },
  pastille: { fontSize: 11, fontWeight: '700', color: BAISSE, backgroundColor: '#E6F0DD', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
  releve: { fontSize: 12, color: colors.textMuted },
  lignePrix: { fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  ligneSous: { fontSize: 12, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  plus: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.accent },
});
