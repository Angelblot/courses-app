import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { FicheProduit } from '../lib/openfoodfacts.ts';
import { meilleurs, type Details, type Niveau } from '../lib/nutrition.ts';
import { PastilleNutri } from './PastilleNutri';
import { Photo, ui } from './MaisonUI';
import { colors } from '../lib/theme';

const NOTES: Record<string, string> = { a: colors.nutriA, b: colors.nutriB, c: colors.nutriC, d: colors.nutriD, e: colors.nutriE };
const NOVA = ['', colors.nutriA, colors.nutriB, colors.nutriD, colors.nutriE];
const NIVEAU: Record<Niveau, string> = { low: colors.nutriA, moderate: colors.nutriC, high: colors.nutriE };
const g = (v: number | null, u = 'g') => (v == null ? '—' : `${String(v).replace('.', ',')} ${u}`);
const contenance = (f: FicheProduit) => f.volumeMl ? (f.volumeMl >= 1000 ? `${String(f.volumeMl / 1000).replace('.', ',')} L` : `${f.volumeMl} ml`) : f.grammageG ? `${f.grammageG} g` : null;

/** Score en pastille de couleur : Nutri-Score, NOVA, Eco-Score. */
export function Score({ libelle, valeur, teinte }: { libelle: string; valeur: string | null; teinte?: string }) {
  return <View style={s.score}>
    <Text style={s.scoreLibelle}>{libelle}</Text>
    {valeur ? <Text style={[s.scoreValeur, { backgroundColor: teinte ?? colors.traitControle }, teinte === colors.nutriC && { color: '#3A2E00' }]}>{valeur}</Text> : <Text style={ui.detail}>inconnu</Text>}
  </View>;
}

/** Les quatre repères pour 100 g, avec leur niveau en couleur (l'aperçu de l'appui long). */
export function Reperes({ d }: { d: Details }) {
  const r: [string, number | null, Niveau | undefined][] = [['Gras', d.gras, d.niveaux.gras], ['Saturés', d.satures, d.niveaux.satures], ['Sucres', d.sucres, d.niveaux.sucres], ['Sel', d.sel, d.niveaux.sel]];
  return <View style={s.reperes}>{r.map(([l, v, n]) => <View key={l} style={s.repere}><View style={[s.point, { backgroundColor: n ? NIVEAU[n] : colors.border }]} /><Text style={s.repereTexte}>{l} {g(v)}</Text></View>)}</View>;
}

/**
 * Fiche complète d'un résultat Open Food Facts (« Voir la fiche complète »
 * de l'aperçu FD2) : scores, repères pour 100 g, allergènes, ingrédients,
 * puis un comparatif côte à côte avec des produits proches de la même
 * recherche (à la FD3), le meilleur de chaque ligne en vert.
 */
export function FicheOffre(props: { fiche: FicheProduit | null; proches: FicheProduit[]; onChoisir: (f: FicheProduit) => void; onFermer: () => void }) {
  if (!props.fiche) return null;
  // La modale a sa propre fenêtre : le fournisseur y rend les marges d'iOS (barre d'accueil).
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onFermer}>
    <SafeAreaProvider initialMetrics={initialWindowMetrics}><Contenu {...props} /></SafeAreaProvider>
  </Modal>;
}

function Contenu({ fiche, proches, onChoisir, onFermer }: { fiche: FicheProduit | null; proches: FicheProduit[]; onChoisir: (f: FicheProduit) => void; onFermer: () => void }) {
  const insets = useSafeAreaInsets();
  const [tout, setTout] = useState(false);
  if (!fiche) return null;
  const d = fiche.details;
  const colonnes = [fiche, ...proches.filter(p => p.ean13 !== fiche.ean13 && p.details).slice(0, 2)];
  const ingredients = d?.ingredients ?? null;

  return <SafeAreaView edges={['top']} style={s.ecran}>
      <View style={s.entete}><Text style={s.titre} numberOfLines={1} accessibilityRole="header">{fiche.name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} style={s.fermer}><View style={s.fermerRond}><Feather name="x" size={18} color={colors.text} /></View></Pressable></View>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 + insets.bottom, gap: 14 }}>
        <View style={s.heros}>
          <View style={s.cadre}><Photo name={fiche.name} url={fiche.imageUrl} style={s.photo} /></View>
          <View style={{ flex: 1, gap: 4 }}><Text style={s.nom}>{fiche.name}</Text>
            <Text style={ui.detail}>{[fiche.brand, contenance(fiche), d?.portion ? `portion ${d.portion}` : null].filter(Boolean).join(' · ')}</Text></View>
        </View>
        <View style={s.scores}>
          <Score libelle="Nutri-Score" valeur={fiche.nutriscore?.toUpperCase() ?? null} teinte={fiche.nutriscore ? NOTES[fiche.nutriscore] : undefined} />
          <Score libelle="Transformation" valeur={d?.nova ? `NOVA ${d.nova}` : null} teinte={d?.nova ? NOVA[d.nova] : undefined} />
          <Score libelle="Eco-Score" valeur={d?.ecoscore?.toUpperCase() ?? null} teinte={d?.ecoscore ? NOTES[d.ecoscore] : undefined} />
        </View>
        {d ? <>
          <Text style={s.section}>Pour 100 g</Text>
          <View style={s.tableau}>
            <Rang libelle="Énergie" valeur={d.kcal != null ? `${d.kcal} kcal` : '—'} />
            <Rang libelle="Matières grasses" valeur={g(d.gras)} niveau={d.niveaux.gras} />
            <Rang libelle="dont saturées" valeur={g(d.satures)} niveau={d.niveaux.satures} />
            <Rang libelle="Sucres" valeur={g(d.sucres)} niveau={d.niveaux.sucres} />
            <Rang libelle="Sel" valeur={g(d.sel)} niveau={d.niveaux.sel} />
            <Rang libelle="Fibres · Protéines" valeur={`${g(d.fibres)} · ${g(d.proteines)}`} derniere />
          </View>
          {(d.allergenes.length > 0 || ingredients) && <View style={s.texte}>
            {d.allergenes.length > 0 && <Text style={s.paragraphe}><Text style={s.gras}>Allergènes : </Text>{d.allergenes.join(', ')}.</Text>}
            {ingredients && <Text style={s.paragraphe} numberOfLines={tout ? undefined : 3}><Text style={s.gras}>Ingrédients : </Text>{ingredients}</Text>}
            {ingredients && ingredients.length > 140 && <Pressable accessibilityRole="button" onPress={() => setTout(!tout)} style={s.lien}><Text style={ui.link}>{tout ? 'Réduire' : 'Tout lire'}</Text></Pressable>}
          </View>}
        </> : <Text style={[ui.detail, { paddingHorizontal: 16 }]}>Open Food Facts n’a pas encore les repères nutritionnels de ce produit.</Text>}

        {colonnes.length > 1 && <>
          <Text style={s.section}>Comparé à des produits proches</Text>
          <TableauComparatif colonnes={colonnes} pied={(c, i) => i > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`Choisir ${c.name}`} onPress={() => onChoisir(c)} style={s.choisirPetit}><Text style={s.choisirPetitTexte}>Choisir</Text></Pressable>} />
          <Text style={[ui.detail, { textAlign: 'center' }]}>Pour 100 g · le meilleur de chaque ligne en vert</Text>
        </>}
      </ScrollView>
      <View style={[s.pied, { paddingBottom: 10 + insets.bottom }]}>
        <Pressable accessibilityRole="button" onPress={() => onChoisir(fiche)} style={({ pressed }) => [s.choisir, pressed && { opacity: .85 }]}><Text style={s.choisirTexte}>Choisir ce produit</Text></Pressable>
      </View>
    </SafeAreaView>;
}

/** Une ligne de comparatif : clé (pour le meilleur en vert), libellé, et le rendu d'une cellule. */
export type LigneComparatif = [string, string, (c: FicheProduit, i: number) => ReactNode];

/**
 * Le comparatif côte à côte (FD3) : une colonne par produit, la première
 * teintée, le meilleur de chaque ligne en vert. Au-delà de trois produits,
 * le tableau défile de côté. `avant` ajoute des lignes en tête (le prix,
 * par exemple), avec leurs propres gagnants ; `pied` une action par colonne.
 */
export function TableauComparatif({ colonnes, avant = [], meilleursAvant = {}, pied, enAvant = [0] }: {
  colonnes: FicheProduit[]; avant?: LigneComparatif[]; meilleursAvant?: Record<string, number[]>;
  pied?: (c: FicheProduit, i: number) => ReactNode;
  /** Colonnes teintées : la référence de l'ordre d'essai, ou les produits choisis. */
  enAvant?: number[];
}) {
  const m = { ...meilleurs(colonnes.map(c => ({ nutriscore: c.nutriscore, details: c.details ?? null }))), ...meilleursAvant };
  const vert = (cle: string, i: number) => m[cle]?.includes(i);
  const lignes: LigneComparatif[] = [...avant,
    ['nutriscore', 'Nutri-Score', c => c.nutriscore ? <PastilleNutri note={c.nutriscore} /> : <Text style={s.cellule}>—</Text>],
    ['ecoscore', 'Eco-Score', c => c.details?.ecoscore ? <Text style={[s.mini, { backgroundColor: NOTES[c.details.ecoscore] }]}>{c.details.ecoscore.toUpperCase()}</Text> : <Text style={s.cellule}>—</Text>],
    ['nova', 'NOVA', c => <Text style={s.cellule}>{c.details?.nova ?? '—'}</Text>],
    ['kcal', 'Énergie', c => <Text style={s.cellule}>{c.details?.kcal != null ? `${c.details.kcal} kcal` : '—'}</Text>],
    ['gras', 'Gras', c => <Text style={s.cellule}>{g(c.details?.gras ?? null)}</Text>],
    ['satures', 'Saturés', c => <Text style={s.cellule}>{g(c.details?.satures ?? null)}</Text>],
    ['sucres', 'Sucres', c => <Text style={s.cellule}>{g(c.details?.sucres ?? null)}</Text>],
    ['sel', 'Sel', c => <Text style={s.cellule}>{g(c.details?.sel ?? null)}</Text>],
    ['allergenes', 'Allergènes', c => <Text style={[s.cellule, { fontSize: 11 }]}>{c.details ? c.details.allergenes.join(', ') || 'aucun' : '—'}</Text>],
  ];
  // Une ligne vide pour tous (Nutri-Score d'un papier cuisson) n'apprend rien : on la retire.
  const connu: Record<string, (c: FicheProduit) => boolean> = {
    nutriscore: c => !!c.nutriscore, ecoscore: c => !!c.details?.ecoscore, nova: c => c.details?.nova != null,
    kcal: c => c.details?.kcal != null, gras: c => c.details?.gras != null, satures: c => c.details?.satures != null,
    sucres: c => c.details?.sucres != null, sel: c => c.details?.sel != null, allergenes: c => !!c.details,
  };
  const visibles = lignes.filter(([cle]) => !connu[cle] || colonnes.some(connu[cle]));
  const large = colonnes.length > 3, col = large ? s.colonneFixe : null;
  const tableau = <View style={[s.comparatif, large && { marginHorizontal: 0 }]}>
    <View style={s.ligneComp}><View style={s.libelleComp} />{colonnes.map((c, i) => <View key={c.ean13} style={[s.colonne, col, enAvant.includes(i) && s.colonneMoi]}><Photo name={c.name} url={c.imageUrl} style={s.mini52} /><Text style={s.nomComp} numberOfLines={3}>{c.name}</Text></View>)}</View>
    {visibles.map(([cle, libelle, rendu]) => <View key={cle} style={s.ligneComp}>
      <Text style={s.libelleComp}>{libelle}</Text>
      {colonnes.map((c, i) => <View key={c.ean13} style={[s.colonne, col, enAvant.includes(i) && s.colonneMoi, vert(cle, i) && s.mieux]}>{rendu(c, i)}</View>)}
    </View>)}
    {pied && <View style={[s.ligneComp, { borderBottomWidth: 0 }]}><View style={s.libelleComp} />{colonnes.map((c, i) => <View key={c.ean13} style={[s.colonne, col, enAvant.includes(i) && s.colonneMoi]}>{pied(c, i)}</View>)}</View>}
  </View>;
  return large ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>{tableau}</ScrollView> : tableau;
}

function Rang({ libelle, valeur, niveau, derniere = false }: { libelle: string; valeur: string; niveau?: Niveau; derniere?: boolean }) {
  return <View style={[s.rang, !derniere && s.separe]}>
    {niveau ? <View style={[s.point, { backgroundColor: NIVEAU[niveau] }]} accessibilityLabel={niveau === 'high' ? 'élevé' : niveau === 'moderate' ? 'modéré' : 'faible'} /> : <View style={s.pointVide} />}
    <Text style={s.rangLibelle}>{libelle}</Text><Text style={s.rangValeur}>{valeur}</Text>
  </View>;
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  entete: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, paddingTop: 12, paddingBottom: 8, gap: 8 },
  titre: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  fermer: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fermerRond: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.off, alignItems: 'center', justifyContent: 'center' },
  heros: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16 },
  cadre: { width: 104, height: 104, borderRadius: 16, backgroundColor: 'white', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  photo: { width: 92, height: 92, borderRadius: 10 },
  nom: { fontSize: 19, fontWeight: '700', color: colors.text, lineHeight: 24 },
  scores: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  score: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 10, alignItems: 'center', gap: 6 },
  scoreLibelle: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  scoreValeur: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 2, overflow: 'hidden' },
  section: { fontSize: 13, fontWeight: '600', color: colors.textMuted, paddingHorizontal: 16, marginBottom: -6 },
  tableau: { marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 12 },
  rang: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  separe: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  point: { width: 10, height: 10, borderRadius: 5 },
  pointVide: { width: 10 },
  rangLibelle: { flex: 1, fontSize: 15, color: colors.text },
  rangValeur: { fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  texte: { paddingHorizontal: 16, gap: 6 },
  paragraphe: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  gras: { fontWeight: '700', color: colors.text },
  lien: { minHeight: 36, justifyContent: 'center' },
  reperes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  repere: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, width: '48%' },
  repereTexte: { fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
  comparatif: { marginHorizontal: 12, backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden' },
  ligneComp: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, minHeight: 36 },
  libelleComp: { width: 92, fontSize: 12, fontWeight: '600', color: colors.textMuted, paddingHorizontal: 8, alignSelf: 'center' },
  colonne: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 4, gap: 4 },
  colonneMoi: { backgroundColor: '#F6F8F3' },
  mieux: { backgroundColor: '#E6F0DD' },
  cellule: { fontSize: 12, color: colors.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  mini: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  mini52: { width: 52, height: 52, borderRadius: 8 },
  colonneFixe: { flex: 0, width: 104 },
  nomComp: { fontSize: 11, fontWeight: '600', color: colors.text, textAlign: 'center' },
  choisirPetit: { minHeight: 36, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  choisirPetitTexte: { fontSize: 13, fontWeight: '700', color: colors.accent },
  pied: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: colors.bg },
  choisir: { minHeight: 50, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  choisirTexte: { fontSize: 16, fontWeight: '600', color: colors.accentContrast },
});
