import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { filtrerCatalogue } from '../lib/recettes-affichage.ts';
import { type FicheProduit } from '../lib/openfoodfacts.ts';
import { useRechercheOff } from '../hooks/useRechercheOff';
import { rayonDepuisLibelle, type CleRayon } from '../lib/rayons.ts';
import { useProducts, ajouterProduit, type Product } from '../stores/products';
import { PastilleNutri } from './PastilleNutri';
import { Photo, ui } from './MaisonUI';
import { colors } from '../lib/theme';
import { ScanRapide } from './ScanRapide';
import { ApercuOffre } from './ApercuOffre';
import { FicheOffre } from './FicheOffre';

export type ChoixIngredient = {
  name: string;
  product_id: string | null;
  unit: string;
  rayon: CleRayon;
};

type Props = {
  onChoisir: (choix: ChoixIngredient) => void;
  onFermer: () => void;
  /** Titre de la feuille (« Ajouter un ingrédient » par défaut). */
  titre?: string;
  /** Préciser : le chevron « point précédent ». Absent : pas de chevron ; null : premier point, chevron grisé. */
  onPrecedent?: (() => void) | null;
  libellePrecedent?: string;
  /** « Ajouter « x » sans produit » : faux pour une alternative, qui doit être un produit. */
  sansProduit?: boolean;
  /** Produits proposés avant la frappe, sous « Même type dans tes produits ». */
  suggestions?: Product[];
  /** Produits à ne pas proposer (déjà dans le classement). */
  exclure?: string[];
  /** Recherche de départ (le nom à préciser). */
  requeteInitiale?: string;
  /** Produits proches, toujours proposés en tête sous « Proches dans tes produits ». */
  proches?: Product[];
  /** Au-dessus du champ : ce qu'on est en train de préciser. */
  entete?: ReactNode;
  /** Remplace la sortie « sans produit » collée en bas. */
  pied?: ReactNode;
  /** Le bouton de scan du code-barres dans le champ (iPhone). */
  scan?: boolean;
  /** Verbe annoncé sur chaque résultat (« Ajouter », « Choisir »). */
  verbe?: string;
  /** Sous les résultats, dans le défilement : la recherche sur les drives. */
  apres?: ReactNode;
  /** Faux dans Préciser : on part des produits du drive, les bases ouvertes ne font que les enrichir. */
  basesOuvertes?: boolean;
};

const MAX_CATALOGUE = 8;
// Le champ porte déjà son contour vert à la saisie : pas de second cadre sur le web.
const sansCadreWeb = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;
/** Pause de frappe avant de chercher sur Open Food Facts, qui limite les recherches. */
const ATTENTE_OFF_MS = 700;

function depuisProduit(p: Product): ChoixIngredient {
  return { name: p.name, product_id: p.id, unit: p.unit ?? 'unité', rayon: rayonDepuisLibelle(p.category) };
}
const contenance = (g: number | null, ml: number | null) => ml ? (ml >= 1000 ? `${String(ml / 1000).replace('.', ',')} L` : `${ml} ml`) : g ? `${g} g` : null;

/** Hauteur du clavier, pour garder la sortie « sans produit » au-dessus. */
function useHauteurClavier() {
  const [h, setH] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const a = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', e => setH(e.endCoordinates.height));
    const b = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setH(0));
    return () => { a.remove(); b.remove(); };
  }, []);
  return h;
}

/**
 * Ajouter un ingrédient à une recette (variante I1) : une seule recherche,
 * deux sources. Tes produits d'abord ; Open Food Facts se cherche tout seul
 * après une pause de frappe. « Ajouter « x » sans produit » reste collé en
 * bas, au-dessus du clavier.
 */
export function SelecteurIngredient({ onChoisir, onFermer, titre = 'Ajouter un ingrédient', sansProduit = true, suggestions = [], exclure = [], requeteInitiale = '', proches = [], entete, pied, scan = Platform.OS !== 'web', verbe = 'Ajouter', apres, basesOuvertes = true, onPrecedent, libellePrecedent }: Props) {
  const { produits, recharger } = useProducts();
  const insets = useSafeAreaInsets(), clavier = useHauteurClavier();
  const [requete, setRequete] = useState(requeteInitiale), [focus, setFocus] = useState(false), [scanner, setScanner] = useState(false);
  // Résultat Open Food Facts dont on regarde la fiche complète (appui long).
  const [detail, setDetail] = useState<FicheProduit | null>(null), [largeur, setLargeur] = useState(0);
  const off = useRechercheOff();
  const [erreur, setErreur] = useState<string | null>(null), [ajout, setAjout] = useState<string | null>(null);
  // Le pied change de hauteur (état de l'extension) : la liste garde toujours sa fin visible au-dessus.
  const [hautPied, setHautPied] = useState(140);
  const texte = requete.trim();
  const exclus = new Set(exclure);
  const prochesVus = proches.filter(p => !exclus.has(p.id));
  const dejaProches = new Set(prochesVus.map(p => p.id));
  const duCatalogue = filtrerCatalogue(produits.filter(p => !exclus.has(p.id) && !dejaProches.has(p.id)), requete).slice(0, MAX_CATALOGUE);
  const memeType = texte ? [] : suggestions.filter(p => !exclus.has(p.id));

  useEffect(() => {
    off.reinitialiser();
    if (!basesOuvertes || texte.length < 3) return;
    const t = setTimeout(() => { void off.chercher(texte, { garderClavier: true }); }, ATTENTE_OFF_MS);
    return () => clearTimeout(t);
  }, [texte]);

  const choisirFiche = async (fiche: FicheProduit) => {
    // Un code-barres déjà connu ne crée pas de doublon : on rattache au produit existant.
    const existant = produits.find(p => p.ean13 && p.ean13 === fiche.ean13);
    if (existant) { onChoisir(depuisProduit(existant)); return; }
    setErreur(null); setAjout(fiche.ean13);
    const r = await ajouterProduit(fiche);
    setAjout(null);
    if (r.ok && r.produit) { await recharger(); onChoisir(depuisProduit(r.produit)); return; }
    if (r.doublon) { onChoisir(depuisProduit(r.doublon)); return; }
    setErreur(r.erreur ?? "Impossible d'ajouter ce produit à ton catalogue.");
  };

  const ligne = (cle: string, nom: string, detail: string | null, image: string | null, note: Product['nutriscore'], plein: boolean, onPress: () => void, occupe = false, onLongPress?: () => void) =>
    <Pressable key={cle} accessibilityRole="button" accessibilityLabel={`${verbe} ${nom}${detail ? `, ${detail}` : ''}`} accessibilityHint={onLongPress ? 'Appui long pour voir la fiche détaillée' : undefined} disabled={occupe} onPress={onPress} onLongPress={Platform.OS === 'ios' ? undefined : onLongPress} style={({ pressed }) => [s.ligne, pressed && { backgroundColor: colors.surface }]}>
      <View style={s.vignette}><Photo name={nom} url={image} style={s.photo} /></View>
      <View style={{ flex: 1, gap: 2 }}><Text style={ui.productName} numberOfLines={2}>{nom}</Text>{!!detail && <Text style={[ui.detail, { marginTop: 0 }]} numberOfLines={1}>{detail}</Text>}</View>
      <PastilleNutri note={note} />
      <View style={[s.plus, !plein && s.plusContour]}>{occupe ? <ActivityIndicator size="small" color={plein ? colors.accentContrast : colors.accent} /> : <Feather name="plus" size={18} color={plein ? colors.accentContrast : colors.accent} />}</View>
    </Pressable>;

  return (
    <View style={s.feuille} onLayout={e => setLargeur(e.nativeEvent.layout.width)}>
      <View style={s.entete}>
        {onPrecedent !== undefined && <Precedent onPress={onPrecedent} libelle={libellePrecedent} />}
        <Text style={[s.titre, onPrecedent !== undefined && { flex: 1 }]} accessibilityRole="header" numberOfLines={1}>{titre}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} style={s.fermer}><View style={s.fermerRond}><Feather name="x" size={18} color={colors.text} /></View></Pressable>
      </View>
      {entete}
      <View style={[s.champ, focus && s.champActif]}>
        <Feather name="search" size={18} color={colors.textMuted} />
        <TextInput style={[s.saisie, sansCadreWeb]} value={requete} onChangeText={t => { setRequete(t); setErreur(null); }} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          returnKeyType="search" placeholder="Lardons, crème, spaghetti…" placeholderTextColor={colors.textMuted} accessibilityLabel="Chercher un produit" autoFocus={!requeteInitiale} autoCorrect={false} />
        {!!requete && <Pressable accessibilityRole="button" accessibilityLabel="Effacer la recherche" onPress={() => setRequete('')} style={s.effacer}><Feather name="x-circle" size={18} color={colors.textMuted} /></Pressable>}
        {scan && <Pressable accessibilityRole="button" accessibilityLabel="Scanner un code-barres" onPress={() => { Keyboard.dismiss(); setScanner(true); }} style={s.scan}><Feather name="maximize" size={18} color={colors.accent} /></Pressable>}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: (pied ? hautPied + 16 : sansProduit ? 140 : 24) + clavier }} keyboardShouldPersistTaps="handled">
        {prochesVus.length > 0 && <><Text style={s.section}>Proches dans tes produits</Text>
          {prochesVus.map(p => ligne(`proche-${p.id}`, p.name, [p.brand, contenance(p.grammage_g, p.volume_ml)].filter(Boolean).join(' · ') || null, p.image_url, p.nutriscore, true, () => onChoisir(depuisProduit(p))))}</>}
        {memeType.length > 0 && <><Text style={s.section}>Même type dans tes produits</Text>
          {memeType.map(p => ligne(`type-${p.id}`, p.name, [p.brand, contenance(p.grammage_g, p.volume_ml)].filter(Boolean).join(' · ') || null, p.image_url, p.nutriscore, true, () => onChoisir(depuisProduit(p))))}</>}
        {/* Avec un en-tête (« Préciser »), « pas un de tes produits » est déjà dit : pas de section vide. */}
        {(duCatalogue.length > 0 || (!prochesVus.length && !entete)) && <Text style={s.section}>{memeType.length || prochesVus.length ? 'Tous tes produits' : 'Dans tes produits'}</Text>}
        {duCatalogue.length
          ? duCatalogue.map(p => ligne(p.id, p.name, [p.brand, contenance(p.grammage_g, p.volume_ml)].filter(Boolean).join(' · ') || null, p.image_url, p.nutriscore, true, () => onChoisir(depuisProduit(p))))
          : !prochesVus.length && !entete && <Text style={s.vide}>Aucun de tes produits ne correspond.</Text>}

        {/* Dans Préciser (en-tête), une section vide n'apprend rien : elle ne s'affiche qu'avec quelque chose dedans. */}
        {basesOuvertes && texte.length >= 3 && (!entete || off.enRecherche || !!off.erreur || !!off.resultats?.length) && <>
          <Text style={s.section}>Sur les bases ouvertes</Text>
          {off.enRecherche && <View style={s.attente} accessibilityLiveRegion="polite"><ActivityIndicator color={colors.accent} /><Text style={[ui.detail, { marginTop: 0 }]}>{off.progression}</Text></View>}
          {!!off.erreur && <Text accessibilityLiveRegion="polite" style={s.vide}>{off.erreur}</Text>}
          {off.resultats?.length === 0 && <Text style={s.vide}>Aucun produit trouvé pour « {texte} ».</Text>}
          {off.resultats?.map(f => {
            const deja = produits.some(p => p.ean13 && p.ean13 === f.ean13);
            const rang = ligne(f.ean13, f.name, [f.brand, contenance(f.grammageG, f.volumeMl), deja ? 'déjà dans tes produits' : null].filter(Boolean).join(' · ') || null, f.imageUrl, f.nutriscore, false, () => choisirFiche(f), ajout === f.ean13, () => setDetail(f));
            // Appui long : l'aperçu natif sur iPhone (FD2), la fiche complète ailleurs.
            return <ApercuOffre key={f.ean13} largeur={largeur} fiche={f} onChoisir={() => { void choisirFiche(f); }} onVoir={() => setDetail(f)}>{rang}</ApercuOffre>;
          })}
        </>}
        {apres}
        {!!erreur && <Text accessibilityLiveRegion="polite" style={[ui.error, { paddingHorizontal: 16 }]}>{erreur}</Text>}
      </ScrollView>

      {!!pied && <View onLayout={e => setHautPied(e.nativeEvent.layout.height)} style={[s.pied, { bottom: clavier, paddingBottom: clavier ? 10 : 10 + insets.bottom }]}>{pied}</View>}
      <FicheOffre fiche={detail} proches={[...(off.resultats ?? [])].filter(x => x.details).sort((a, b) => Number(b.productType === detail?.productType) - Number(a.productType === detail?.productType))} onFermer={() => setDetail(null)}
        onChoisir={f => { setDetail(null); void choisirFiche(f); }} />
      <ScanRapide visible={scanner} onFermer={() => setScanner(false)} onFiche={f => { setScanner(false); void choisirFiche(f); }} />
      {!pied && sansProduit && !!texte && <View style={[s.pied, { bottom: clavier, paddingBottom: clavier ? 10 : 10 + insets.bottom }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Ajouter « ${texte} » sans produit. L'extension le cherchera par son nom.`} onPress={() => onChoisir({ name: texte, product_id: null, unit: 'unité', rayon: 'autre' })} style={({ pressed }) => [s.sansProduit, pressed && { opacity: .85 }]}>
          <Feather name="edit-2" size={17} color={colors.accent} />
          <View style={{ flex: 1 }}><Text style={s.sansProduitTitre} numberOfLines={1}>Ajouter « {texte} » sans produit</Text><Text style={[ui.detail, { marginTop: 0 }]}>L’extension le cherchera par son nom</Text></View>
        </Pressable>
      </View>}
    </View>
  );
}

/** Le chevron qui ramène au point d'avant dans Préciser ; grisé au premier. */
export function Precedent({ onPress, libelle = 'Point précédent' }: { onPress: (() => void) | null; libelle?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={libelle} accessibilityState={{ disabled: !onPress }} disabled={!onPress} onPress={onPress ?? undefined}
    style={({ pressed }) => [s.precedent, pressed && { opacity: .7 }]}>
    <View style={[s.fermerRond, !onPress && { backgroundColor: 'transparent', opacity: .45 }]}><Feather name="chevron-left" size={20} color={onPress ? colors.text : colors.traitControle} /></View>
  </Pressable>;
}

const s = StyleSheet.create({
  feuille: { flex: 1, backgroundColor: colors.bg },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 8, paddingTop: 12, paddingBottom: 8 },
  titre: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  fermer: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  precedent: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -6, marginRight: 2 },
  fermerRond: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.off, alignItems: 'center', justifyContent: 'center' },
  champ: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.traitControle, backgroundColor: colors.surface },
  champActif: { borderWidth: 2, borderColor: colors.accent },
  saisie: { flex: 1, minHeight: 46, fontSize: 16, color: colors.text },
  effacer: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  scan: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginRight: -4 },
  section: { fontSize: 13, fontWeight: '600', color: colors.textMuted, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 8 },
  vignette: { width: 48, height: 48, borderRadius: 10, backgroundColor: 'white', borderWidth: 1, borderColor: colors.border, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photo: { width: 44, height: 44, borderRadius: 8 },
  plus: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  plusContour: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.accent },
  vide: { fontSize: 14, color: colors.textMuted, paddingHorizontal: 16, paddingVertical: 8 },
  attente: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  pied: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  sansProduit: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.accent },
  sansProduitTitre: { fontSize: 15, fontWeight: '600', color: colors.accent },
});
