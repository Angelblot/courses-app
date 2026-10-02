import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { comparer, nuage, type Ligne } from '../lib/comparateur';
import { classement, reordonner } from '../lib/references';
import { useOffres } from '../stores/offres';
import { ajouterProduit, enregistrerAlternatives, type Product } from '../stores/products';
import { PastilleNutri } from './PastilleNutri';
import { Photo, ui } from './MaisonUI';
import { colors } from '../lib/theme';

const HAUTEUR = 180, AXE = 40, NOTES = ['A', 'B', 'C', 'D', 'E', '?'];
const TEINTE_NOTE = [colors.nutriA, colors.nutriB, colors.nutriC, colors.nutriD, colors.nutriE, colors.traitControle];
const DRIVES = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' } as const;
const euros = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;
const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/**
 * Comparatif d'un produit (variante CP3) : chaque produit vu sur les drives
 * est un point, prix au kilo en hauteur, Nutri-Score en largeur ; la
 * référence est le gros point. En bas à gauche, c'est mieux sur les deux
 * plans. Toucher un point affiche sa ligne dessous.
 */
export function NuagePrix({ reference, produits, onChange }: { reference: Product; produits: Product[]; onChange?: () => void }) {
  const { offres, chargement, erreur } = useOffres(reference.id);
  const lignes = useMemo(() => comparer(offres, reference), [offres, reference]);
  const { points, reperes, unite } = useMemo(() => nuage(lignes), [lignes]);
  const [largeur, setLargeur] = useState(0);
  const ref = points.find(p => p.ligne.reference);
  const meilleur = points.find(p => !p.ligne.reference && p.ligne.ecartPrix != null && p.ligne.ecartPrix < 0) ?? ref ?? points[0];
  const [choisi, setChoisi] = useState<string | null>(null);
  const courant = points.find(p => p.ligne.cle === choisi) ?? meilleur;

  if (chargement) return null;
  if (erreur) return <Text style={[ui.error, { alignSelf: 'stretch', marginTop: 20 }]}>{erreur}</Text>;
  if (points.length < 2) return null;

  const colonnes = points.some(p => p.colonne === 5) ? 6 : 5;
  const zone = Math.max(0, largeur - AXE);
  const x = (c: number) => AXE + (zone / colonnes) * (c + 0.5);
  const y = (h: number) => (HAUTEUR - 14) * (1 - h) + 7;
  // Deux produits de même note et de prix voisin se décalent pour rester touchables.
  const decalage = new Map<string, number>();
  const placer = (cle: string, c: number, h: number) => {
    const tranche = `${c}:${Math.round(h * 8)}`, n = decalage.get(tranche) ?? 0;
    decalage.set(tranche, n + 1);
    return n === 0 ? 0 : (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 12;
  };
  const teinte = (l: Ligne) => l.reference ? colors.accent
    : l.ecartPrix != null && l.ecartPrix < 0 && (!l.nutriscore || !ref?.ligne.nutriscore || l.nutriscore <= ref.ligne.nutriscore) ? '#2F6B2F'
    : l.nutriscore && ref?.ligne.nutriscore && l.nutriscore < ref.ligne.nutriscore ? '#2E5683' : '#9AA394';
  const vuLe = lignes.reduce((m, l) => (l.vu_le > m ? l.vu_le : m), lignes[0].vu_le);
  const parUnite = unite === 'l' ? '€/L' : unite === 'kg' ? '€/kg' : '€/pièce';

  return <View style={s.zone}>
    <View style={s.tete}><Text style={s.titre} accessibilityRole="header">Prix et Nutri-Score</Text><Text style={ui.detail}>{points.length} produits vus · le {date(vuLe)}</Text></View>
    <View style={s.carte}>
      <View onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)} style={{ height: HAUTEUR }}>
        {reperes.map((v, i) => { const h = (i / Math.max(1, reperes.length - 1)); return <View key={v} style={[s.repere, { top: y(h) }]}>
          <Text style={s.repereTexte}>{String(v).replace('.', ',')}</Text><View style={s.trait} /></View>; })}
        {largeur > 0 && points.map(p => {
          const dx = placer(p.ligne.cle, p.colonne, p.hauteur), taille = p.ligne.reference ? 22 : 16, actif = p === courant;
          return <Pressable key={p.ligne.cle} hitSlop={8} onPress={() => setChoisi(p.ligne.cle)}
            accessibilityRole="button" accessibilityState={{ selected: actif }}
            accessibilityLabel={`${p.ligne.reference ? 'Ta référence, ' : ''}${p.ligne.libelle}, ${euros(p.ligne.prix_unitaire!)} par ${unite === 'l' ? 'litre' : unite === 'kg' ? 'kilo' : 'pièce'}${p.ligne.nutriscore ? `, Nutri-Score ${p.ligne.nutriscore.toUpperCase()}` : ''}`}
            style={[s.point, { width: taille, height: taille, borderRadius: taille / 2, left: x(p.colonne) + dx - taille / 2, top: y(p.hauteur) - taille / 2, backgroundColor: teinte(p.ligne) }, p.ligne.reference && s.pointRef, actif && s.pointActif]} />;
        })}
        {largeur > 0 && ref && <Text style={[s.toi, { left: x(ref.colonne) - 30, top: y(ref.hauteur) - 30 }]} accessibilityElementsHidden importantForAccessibility="no">Toi</Text>}
      </View>
      <View style={[s.notes, { paddingLeft: AXE }]}>{NOTES.slice(0, colonnes).map((n, i) => <View key={n} style={s.colonne}><View style={[s.note, { backgroundColor: TEINTE_NOTE[i] }]}><Text style={s.noteTexte}>{n}</Text></View></View>)}</View>
      <Text style={s.legende}>{parUnite} selon le Nutri-Score · en bas à gauche : moins cher et mieux noté</Text>
    </View>
    {courant && <Detail key={courant.ligne.cle} ligne={courant.ligne} reference={reference} produits={produits} unite={parUnite} onChange={onChange} />}
  </View>;
}

/** La ligne du point touché : prix, écart, et ce qu'on peut en faire. */
function Detail({ ligne, reference, produits, unite, onChange }: { ligne: Ligne; reference: Product; produits: Product[]; unite: string; onChange?: () => void }) {
  const [envoi, setEnvoi] = useState(false), [message, setMessage] = useState<string | null>(null), [ajoute, setAjoute] = useState(false);
  const existant = ligne.ean13 ? produits.find(p => p.ean13 === ligne.ean13) : undefined;
  const ordre = classement(reference, produits).map(p => p.id);
  const dejaDansOrdre = !!existant && ordre.includes(existant.id);
  const ajouter = async () => {
    setEnvoi(true); setMessage(null);
    let id = existant?.id;
    if (!id && ligne.ean13) {
      const r = await ajouterProduit({ ean13: ligne.ean13, name: ligne.libelle, brand: ligne.marque ?? null, imageUrl: ligne.image_url ?? null,
        grammageG: ligne.grammage_g ?? null, volumeMl: ligne.volume_ml ?? null, productType: reference.product_type, categoryKey: null, nutriscore: ligne.nutriscore }, false);
      id = r.produit?.id ?? r.doublon?.id;
    }
    const r = id ? await enregistrerAlternatives(reordonner(reference.id, [...ordre, id])) : { ok: false };
    setEnvoi(false);
    if (r.ok) { setAjoute(true); setMessage('Ajouté à ton ordre d’essai.'); onChange?.(); } else setMessage('Impossible de l’ajouter. Réessaie.');
  };
  return <View style={s.detail}>
    <View style={s.ligne}>
      <Photo name={ligne.libelle} url={ligne.image_url} style={s.photo} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={ui.productName} numberOfLines={2}>{ligne.libelle}</Text>
        <View style={s.puces}><Text style={s.drive}>{DRIVES[ligne.drive]}</Text><PastilleNutri note={ligne.nutriscore} />{ligne.reference && <Text style={s.refPuce}>Ta référence</Text>}{!!ligne.promotion && <Text style={s.promo}>{ligne.promotion}</Text>}</View>
      </View>
      <View style={s.prix}>
        {ligne.prix != null && <Text style={s.prixTexte}>{euros(ligne.prix)}</Text>}
        <Text style={[ui.detail, { marginTop: 0 }, ligne.ecartPrix != null && ligne.ecartPrix < 0 && s.moins, ligne.ecartPrix != null && ligne.ecartPrix > 0 && s.plus]}>{euros(ligne.prix_unitaire!)} {unite.replace('€', '').trim()}</Text>
        {ligne.ecartPrix != null && !ligne.reference && <Text style={[s.ecart, ligne.ecartPrix < 0 ? s.moins : s.plus]}>{ligne.ecartPrix < 0 ? '−' : '+'}{Math.abs(Math.round(ligne.ecartPrix * 100))} %</Text>}
      </View>
    </View>
    {!ligne.reference && <View style={s.actions}>
      {!!ligne.ean13 && !dejaDansOrdre && !ajoute && <Pressable accessibilityRole="button" disabled={envoi} onPress={() => { void ajouter(); }} style={({ pressed }) => [s.bouton, pressed && { opacity: .85 }]}>
        {envoi ? <ActivityIndicator color={colors.accent} /> : <><Feather name="plus" size={16} color={colors.accent} /><Text style={s.boutonTexte}>Ajouter à mon ordre d’essai</Text></>}
      </Pressable>}
      {dejaDansOrdre && !ajoute && <Text style={[ui.detail, { marginTop: 0 }]}>Déjà dans ton ordre d’essai.</Text>}
      {!!ligne.url && <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(ligne.url!); }} style={s.lien}><Text style={ui.link}>Voir sur le drive</Text></Pressable>}
    </View>}
    {!!message && <Text accessibilityLiveRegion="polite" style={[ui.detail, { marginTop: 0 }]}>{message}</Text>}
  </View>;
}

const s = StyleSheet.create({
  zone: { alignSelf: 'stretch', gap: 8, marginTop: 20 },
  tete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  titre: { fontSize: 18, fontWeight: '700', color: colors.text },
  carte: { backgroundColor: colors.surface, borderRadius: 16, padding: 12, gap: 8 },
  repere: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -7 },
  repereTexte: { width: AXE - 6, fontSize: 11, color: colors.textMuted, textAlign: 'right', fontVariant: ['tabular-nums'] },
  trait: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  point: { position: 'absolute' },
  pointRef: { borderWidth: 3, borderColor: colors.surface },
  pointActif: { borderWidth: 3, borderColor: colors.text },
  toi: { position: 'absolute', width: 60, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.accent },
  notes: { flexDirection: 'row' },
  colonne: { flex: 1, alignItems: 'center' },
  note: { width: 22, height: 18, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  noteTexte: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  legende: { fontSize: 12, color: colors.textMuted },
  detail: { backgroundColor: colors.surface, borderRadius: 14, padding: 12, gap: 10 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 48, height: 48, borderRadius: 8 },
  puces: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  drive: { fontSize: 11, fontWeight: '700', color: '#4E564A', backgroundColor: colors.bg, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
  refPuce: { fontSize: 11, fontWeight: '700', color: colors.accentContrast, backgroundColor: colors.accent, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
  promo: { fontSize: 11, fontWeight: '700', color: colors.danger },
  prix: { alignItems: 'flex-end', gap: 2 },
  prixTexte: { fontSize: 16, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  ecart: { fontSize: 12, fontWeight: '700' },
  moins: { color: '#2F6B2F' },
  plus: { color: '#9A3A22' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  bouton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.accent },
  boutonTexte: { fontSize: 14, fontWeight: '600', color: colors.accent },
  lien: { minHeight: 44, justifyContent: 'center' },
});
