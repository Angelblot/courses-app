import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useWizard } from '../contexts/WizardContext';
import { useProducts, type Product } from '../stores/products';
import { garderOffres } from '../stores/recherches-drive';
import { rattacherIngredient } from '../stores/recipes';
import type { LigneMaison } from '../lib/liste-maison';
import type { Manque } from '../lib/session-courses';
import { sources } from './Manques';
import { Precedent, SelecteurIngredient } from './SelecteurIngredient';
import { RechercheDrives, Recapitulatif, type Affinage, type Comparaison } from './RechercheDrives';
import { FeuilleType } from './FeuilleType';
import { EtatExtension } from './EtatExtension';
import { useExtension } from '../stores/extension';
import { DRIVES_RECHERCHE, NOMS_DRIVE, prixLisible, type ChoixOffres, type OffreRelevee, type phase as Phase } from '../lib/recherche-drive.ts';
import { nomCourt } from '../lib/analyse-comparatif.ts';
import { precedentDe, rangDans, visiter } from '../lib/parcours-preciser.ts';
import { Photo, ui } from './MaisonUI';
import { colors } from '../lib/theme';

/**
 * Relie (ou délie) des ingrédients de recette, dans l'ordre des demandes :
 * « Lier » puis « Modifier » ne doivent pas se croiser en base. Un échec
 * laisse le lien valable pour la liste en cours ; il est journalisé.
 */
let fileRattache: Promise<unknown> = Promise.resolve();
function rattacher(ids: string[], productId: string | null, rayon: LigneMaison['rayon'] | undefined) {
 if (!ids.length || !rayon) return;
 fileRattache = fileRattache.then(async () => {
  const r = await Promise.all(ids.map(i => rattacherIngredient(i, productId, rayon)));
  if (r.some(x => !x.ok)) console.error('[rattacher] lien de recette non enregistré', ids);
 });
}

type Doublon = { id: string; a: LigneMaison; b: LigneMaison };
type Point = { type: 'manque'; key: string; manque: Manque } | { type: 'doublon'; doublon: Doublon } | { type: 'ingredient'; key: string; ligne: LigneMaison };
/** Ce qui a été décidé pour un point, en lignes « qui : quoi », pour le revoir. */
type Resume = {
 qui: string; quoi: string; vide?: boolean;
 /** Le produit retenu pour une enseigne : de quoi le montrer en carte quand on revoit le point. */
 produit?: { nom: string; image: string | null; prix: string | null; unite: string | null; histoire: string | null };
}[];
type Regle = { nom: string; type: Point['type']; resume: Resume; annuler: () => void; choix?: ChoixOffres };
type OnRegle = (resume: Resume, annuler: () => void, choix?: ChoixOffres) => void;

/**
 * « Préciser » au bilan (variante PR1) : un manque ou un doublon à la fois,
 * toujours nommé en haut, avec ses issues juste dessous. Un manque se
 * précise avec la recherche commune (tes produits, Open Food Facts, scan),
 * se garde sous son nom ou se retire ; un doublon se règle en gardant l'un
 * des deux (DB1). On passe tout seul au suivant ; le bilan ferme la feuille
 * dès qu'il ne reste plus rien. Le chevron de l'en-tête remonte les points
 * déjà vus : réglé, un point s'affiche en résumé et peut être rouvert.
 */
export function ReglerSheet({ visible, onFermer, manques, doublons, ingredients = [], depart = 'manques', products, onRetrait, toast }: { visible: boolean; onFermer: () => void; manques: [string, Manque][]; doublons: Doublon[];
 /** Les ingrédients de repas sans produit, et par quoi commencer (la ligne du bilan touchée). */
 ingredients?: LigneMaison[]; depart?: 'manques' | 'ingredients';
 products: Product[]; onRetrait: (texte: string, annuler: () => void) => void; toast?: ReactNode }) {
 // « Passer au suivant » range un point en fin de file, le temps que l'extension cherche.
 const [reportes, setReportes] = useState<string[]>([]);
 // L'ordre de visite, ce qui a été réglé, et le point revu par « Précédent » (null : la tête de file).
 const [parcours, setParcours] = useState<string[]>([]);
 const [regles, setRegles] = useState<Record<string, Regle>>({});
 const [focus, setFocus] = useState<string | null>(null);
 // « Modifier » rouvre un point avec les produits qu'il avait retenus, déjà cochés.
 const [reprises, setReprises] = useState<Record<string, ChoixOffres>>({});
 const cle = (p: Point) => p.type === 'doublon' ? p.doublon.id : p.key;
 const pointsManques: Point[] = [...manques.map(([key, manque]) => ({ type: 'manque' as const, key, manque })), ...doublons.map(doublon => ({ type: 'doublon' as const, doublon }))];
 const pointsIngredients: Point[] = ingredients.map(ligne => ({ type: 'ingredient' as const, key: ligne.key, ligne }));
 const tous: Point[] = depart === 'ingredients' ? [...pointsIngredients, ...pointsManques] : [...pointsManques, ...pointsIngredients];
 const points = [...tous.filter(p => !reportes.includes(cle(p))), ...reportes.flatMap(k => tous.filter(p => cle(p) === k))];
 const tete = points[0], cleTete = tete ? cle(tete) : null;
 const focusOuvert = focus ? points.find(p => cle(p) === focus) : undefined;
 const focusRegle = focus && !focusOuvert ? regles[focus] : undefined;
 const courant = focusOuvert ?? (focusRegle ? undefined : tete);
 const affiche = focusRegle ? focus : courant ? cle(courant) : null;
 // Plus rien d'ouvert mais des points réglés ici : le récapitulatif, d'où l'on revoit chacun.
 const fin = !courant && !focusRegle && Object.keys(regles).length > 0;
 const vide = !courant && !focusRegle && !fin;
 useEffect(() => { if (visible && vide) onFermer(); }, [visible, vide]);

 useEffect(() => { if (visible && !focus && cleTete) setParcours(p => visiter(p, cleTete)); }, [visible, focus, cleTete]);
 // Une nouvelle ouverture repart de zéro : les réglages d'avant sont dans la liste.
 useEffect(() => { if (!visible) { setParcours([]); setRegles({}); setFocus(null); setReprises({}); } }, [visible]);

 // La file entière, dans l'ordre de visite : « 3 sur 19 » ne bouge pas quand un point est réglé.
 const ordre = [...parcours, ...points.map(cle).filter(k => !parcours.includes(k))];
 const n = Math.max(ordre.length, 1), position = affiche ? Math.min(n, rangDans(parcours, affiche)) : 1;
 const titre = fin ? 'Préciser' : `Préciser · ${position} sur ${n}`;
 const ouverts = new Set(points.map(cle));
 const progression = n > 1 ? <View style={s.pas} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
  {ordre.map(k => <View key={k} style={[s.segment, k === affiche && s.segmentCourant, !ouverts.has(k) && !!regles[k] && s.segmentFait]} />)}
 </View> : null;

 const nomDe = (k: string) => { const p = points.find(x => cle(x) === k);
  return p ? (p.type === 'manque' ? p.manque.name : p.type === 'ingredient' ? p.ligne.name : `${p.doublon.a.name} ou ${p.doublon.b.name}`) : regles[k]?.nom ?? ''; };
 const reglesDansLOrdre = ordre.filter(k => regles[k] && !ouverts.has(k)).map(k => ({ cle: k, regle: regles[k] }));
 const avant = affiche ? precedentDe(parcours, affiche) : fin ? reglesDansLOrdre[reglesDansLOrdre.length - 1]?.cle ?? null : null;
 const onPrecedent = avant ? () => setFocus(avant) : null;
 const libellePrecedent = avant ? `Revenir à « ${nomDe(avant)} »` : 'Point précédent';
 // VoiceOver suit le changement de point : le contenu de la feuille est remplacé d'un bloc.
 useEffect(() => {
  if (visible && affiche) AccessibilityInfo.announceForAccessibility(`${titre}. ${nomDe(affiche)}${focusRegle ? ', déjà réglé' : ''}`);
  else if (visible && fin) AccessibilityInfo.announceForAccessibility('Tout est réglé');
 }, [visible, affiche, !!focusRegle, fin]);
 const regle = (k: string, nom: string, type: Point['type']): OnRegle => (resume, annuler, choix) => {
  setRegles(r => ({ ...r, [k]: { nom, type, resume, annuler, choix } }));
  // Réglé à nouveau : l'ancien choix ne reviendra plus pré-coché.
  setReprises(x => { if (!(k in x)) return x; const { [k]: _, ...reste } = x; return reste; });
  setFocus(null);
 };

 return <Modal visible={visible && !vide} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFermer}>
  {fin
   ? <ToutRegle progression={progression} points={reglesDansLOrdre} toast={toast} onFermer={onFermer} onPrecedent={onPrecedent} libellePrecedent={libellePrecedent} onRevoir={setFocus} />
   : focusRegle && focus
   ? <PointRegle titre={titre} progression={progression} regle={focusRegle} onFermer={onFermer} onPrecedent={onPrecedent}
     suite={cleTete ? { rang: rangDans(parcours, cleTete), nom: nomDe(cleTete) } : null} libellePrecedent={libellePrecedent}
     onContinuer={() => setFocus(null)}
     onChanger={() => { focusRegle.annuler(); const choix = focusRegle.choix; if (choix) setReprises(x => ({ ...x, [focus]: choix }));
      setRegles(r => { const { [focus]: _, ...reste } = r; return reste; }); }} />
   : courant?.type === 'ingredient'
   ? <PreciserManque key={courant.key} titre={titre} progression={progression} lineKey={courant.key} manque={{ name: courant.ligne.name, source: 'manuel' }} ingredient={courant.ligne} products={products} onFermer={onFermer} onRetrait={onRetrait} toast={toast}
     autres={[]} onPrecedent={onPrecedent} libellePrecedent={libellePrecedent} onRegle={regle(courant.key, courant.ligne.name, 'manque')} choixInitial={reprises[courant.key]}
     onPasser={points.length > 1 ? () => { setFocus(null); setReportes(r => [...r.filter(k => k !== courant.key), courant.key]); } : undefined} />
   : courant?.type === 'manque'
   ? <PreciserManque key={courant.key} titre={titre} progression={progression} lineKey={courant.key} manque={courant.manque} products={products} onFermer={onFermer} onRetrait={onRetrait} toast={toast}
     autres={manques.filter(([k]) => k !== courant.key).map(([, m]) => m.name)} onPrecedent={onPrecedent} libellePrecedent={libellePrecedent}
     onRegle={regle(courant.key, courant.manque.name, 'manque')} choixInitial={reprises[courant.key]}
     onPasser={points.length > 1 ? () => { setFocus(null); setReportes(r => [...r.filter(k => k !== courant.key), courant.key]); } : undefined} />
   : courant?.type === 'doublon'
    ? <GarderUn key={courant.doublon.id} titre={titre} progression={progression} doublon={courant.doublon} products={products} onFermer={onFermer} onRetrait={onRetrait} toast={toast}
      onPrecedent={onPrecedent} libellePrecedent={libellePrecedent} onRegle={regle(courant.doublon.id, `${courant.doublon.a.name} ou ${courant.doublon.b.name}`, 'doublon')} />
    : null}
 </Modal>;
}

/** L'en-tête commun : chevron « précédent », titre, fermer. */
function Entete({ titre, onFermer, onPrecedent, libellePrecedent }: { titre: string; onFermer: () => void; onPrecedent: (() => void) | null; libellePrecedent: string }) {
 return <View style={s.entete}>
  <Precedent onPress={onPrecedent} libelle={libellePrecedent} />
  <Text style={s.titre} accessibilityRole="header" numberOfLines={1}>{titre}</Text>
  <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} style={s.fermer}><View style={s.fermerRond}><Feather name="x" size={18} color={colors.text} /></View></Pressable>
 </View>;
}

/** Une décision en une ligne lisible : « Carrefour : … », « Retiré de ta liste », « Gardé sans produit… ». */
function decision(resume: Resume): string {
 const pleines = resume.filter(l => !l.vide);
 return (pleines.length ? pleines.map(l => `${l.qui} : ${l.quoi}`) : resume.slice(0, 1).map(l => `${l.qui} ${l.quoi}`)).join('\n');
}

/**
 * Tout est réglé : la feuille reste ouverte sur le récapitulatif. Chaque point
 * se revoit d'un tap (puis « Changer »), le chevron remonte au dernier.
 */
function ToutRegle({ progression, points, onFermer, onPrecedent, libellePrecedent, onRevoir, toast }: { toast?: ReactNode; progression: ReactNode; points: { cle: string; regle: Regle }[]; onFermer: () => void; onPrecedent: (() => void) | null; libellePrecedent: string; onRevoir: (cle: string) => void }) {
 const insets = useSafeAreaInsets();
 return <SafeAreaView edges={['top']} style={s.ecran}>
  <Entete titre="Préciser" onFermer={onFermer} onPrecedent={onPrecedent} libellePrecedent={libellePrecedent} />
  <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
   {progression}
   <View style={s.heros}>
    <View style={s.statutRegle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Feather name="check" size={24} color={colors.accentContrast} /></View>
    <View style={{ flex: 1, gap: 2 }}><Text style={s.nom} accessibilityRole="header">Tout est réglé</Text><Text style={[ui.detail, { marginTop: 0 }]}>{points.length} point{points.length > 1 ? 's' : ''}. Touche-en un pour le revoir.</Text></View>
   </View>
   <View style={s.recap}>
    {points.map(({ cle, regle }, i) => <Pressable key={cle} accessibilityRole="button" accessibilityLabel={`Revoir « ${regle.nom} ». ${decision(regle.resume).split('\n').join('. ')}`} onPress={() => onRevoir(cle)}
     style={({ pressed }) => [s.recapLigne, i > 0 && s.ligneRegleTrait, pressed && { backgroundColor: colors.off }]}>
     <View style={{ flex: 1, gap: 2 }}>
      <Text style={ui.productName} numberOfLines={1}>« {regle.nom} »</Text>
      <Text style={[ui.detail, { marginTop: 0 }, regle.resume[0]?.qui === 'Retiré' && { color: colors.danger }]} numberOfLines={2}>{decision(regle.resume)}</Text>
     </View>
     <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>)}
   </View>
  </ScrollView>
  <View style={[s.basDoublon, s.piedFin, { paddingBottom: 12 + insets.bottom }]}>
   {toast}
   <Pressable accessibilityRole="button" onPress={onFermer} style={({ pressed }) => [s.valider, pressed && { opacity: .85 }]}>
    <Text style={s.validerTexte}>Terminer</Text>
   </Pressable>
  </View>
 </SafeAreaView>;
}

/**
 * Un point déjà réglé, revu par « Précédent » : ce qui a été décidé, puis
 * « Continuer » vers le premier point ouvert ou « Changer » pour le rouvrir.
 */
function PointRegle({ titre, progression, regle, onFermer, onPrecedent, libellePrecedent, suite, onContinuer, onChanger }: { titre: string; progression: ReactNode; regle: Regle; onFermer: () => void; onPrecedent: (() => void) | null; libellePrecedent: string; suite: { rang: number; nom: string } | null; onContinuer: () => void; onChanger: () => void }) {
 const insets = useSafeAreaInsets();
 // Des produits retenus par enseigne : une carte chacune. Sinon (gardé sans produit, retiré, doublon), une ligne.
 const parEnseigne = regle.resume.some(l => l.produit), retenus = regle.resume.filter(l => l.produit).length;
 return <SafeAreaView edges={['top']} style={s.ecran}>
  <Entete titre={titre} onFermer={onFermer} onPrecedent={onPrecedent} libellePrecedent={libellePrecedent} />
  {progression}
  <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 12 }}>
   <View style={{ paddingHorizontal: 4, gap: 2 }}>
    <Text style={s.nomRegle} accessibilityRole="header" numberOfLines={2}>« {regle.nom} »</Text>
    <Text style={s.dejaRegle}>{parEnseigne ? `Réglé · ${retenus} produit${retenus > 1 ? 's' : ''} retenu${retenus > 1 ? 's' : ''}` : 'Réglé'}</Text>
   </View>
   {parEnseigne ? regle.resume.map((l, i) => <View key={i} style={s.carteEnseigne} accessible
    accessibilityLabel={l.produit ? `${l.qui} : ${l.produit.nom}, ${[l.produit.prix, l.produit.unite, l.produit.histoire].filter(Boolean).join(', ')}` : `${l.qui} : aucun produit choisi`}>
    <Text style={s.enseigne}>{l.qui}</Text>
    {l.produit ? <View style={s.produitRetenu}>
     <Photo name={l.produit.nom} url={l.produit.image} style={s.photoRetenu} />
     <View style={{ flex: 1, gap: 3 }}>
      <Text style={ui.productName} numberOfLines={2}>{l.produit.nom}</Text>
      {!!l.produit.histoire && <Text style={s.histoireRetenu} numberOfLines={2}>{l.produit.histoire}</Text>}
     </View>
     <View style={{ alignItems: 'flex-end', gap: 2 }}>
      <Text style={s.prixRetenu}>{l.produit.prix ?? 'n.c.'}</Text>
      {!!l.produit.unite && <Text style={[ui.detail, { marginTop: 0 }]}>{l.produit.unite}</Text>}
     </View>
    </View> : <Text style={[ui.detail, { marginTop: 0 }]}>Aucun produit choisi : l’extension cherchera « {regle.nom} » par son nom.</Text>}
   </View>)
   : <View style={s.carteRegle} accessible accessibilityLabel={regle.resume.map(l => `${l.qui} : ${l.quoi}`).join('. ')}>
    {regle.resume.map((l, i) => <View key={i} style={[s.ligneRegle, i > 0 && s.ligneRegleTrait]}>
     <Text style={s.qui}>{l.qui}</Text>
     <Text style={[s.quoi, l.vide && { color: colors.textMuted, fontWeight: '400' }]} numberOfLines={2}>{l.quoi}</Text>
    </View>)}
   </View>}
  </ScrollView>
  <View style={[s.piedRegle, { paddingBottom: 12 + insets.bottom }]}>
   <Pressable accessibilityRole="button" accessibilityLabel={`Modifier « ${regle.nom} »`} onPress={onChanger} style={({ pressed }) => [s.modifier, pressed && { opacity: .7 }]}>
    <Text style={s.garderNomTexte}>Modifier</Text>
   </Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel={suite ? `Valider, point suivant : ${suite.rang}, « ${suite.nom} »` : 'Valider, revenir au récapitulatif'} onPress={onContinuer} style={({ pressed }) => [s.valider, { flex: 1.6 }, pressed && { opacity: .85 }]}>
    <Text style={s.validerTexte}>{suite ? 'Valider, point suivant' : 'Valider'}</Text>
   </Pressable>
  </View>
 </SafeAreaView>;
}

/**
 * Un manque : tes produits proches, puis « Chercher sur les drives » par
 * l'extension. Avec des résultats, on choisit un produit par enseigne et le
 * pied récapitule et valide ; rien ne passe au point suivant avant « Valider ».
 * Sinon, en bas, « garder sans produit » ou « retirer ».
 */
function PreciserManque({ titre, progression, lineKey, manque, products, onFermer, onRetrait, toast, autres, onPasser, onPrecedent, libellePrecedent, onRegle, choixInitial, ingredient }: { titre: string; progression: ReactNode; lineKey: string; manque: Manque; products: Product[]; onFermer: () => void; onRetrait: (texte: string, annuler: () => void) => void; toast?: ReactNode; autres: string[]; onPasser?: () => void; onPrecedent: (() => void) | null; libellePrecedent: string; onRegle: OnRegle; choixInitial?: ChoixOffres;
 /** Un ingrédient de repas sans produit : le lier vaut pour ses recettes, pas seulement pour cette liste. */
 ingredient?: LigneMaison }) {
 const w = useWizard(), extension = useExtension();
 const [etape, setEtape] = useState<ReturnType<typeof Phase>>('aucune');
 const { recharger } = useProducts();
 const [choix, setChoix] = useState<ChoixOffres>(choixInitial ?? {}), [occupe, setOccupe] = useState(false), [erreur, setErreur] = useState<string | null>(null);
 const [comparaison, setComparaison] = useState<Comparaison>(null);
 const [nombres, setNombres] = useState<Record<'carrefour' | 'leclerc', number>>({ carrefour: 0, leclerc: 0 });
 // « Quel type ? » : le type ou la marque choisis, et ce que la recherche en propose.
 const [filtre, setFiltre] = useState<string | null>(null), [feuilleType, setFeuilleType] = useState(false);
 const [affinage, setAffinage] = useState<Affinage | null>(null);
 const typeVisible = !!affinage?.actif && (affinage.types.length > 0 || affinage.marques.length > 0);
 // Valider : chaque produit choisi rejoint « Mes produits », relié à son drive ; le point est réglé.
 const valider = async (offres: OffreRelevee[]) => {
  if (!offres.length || occupe) return;
  // L'état d'avant, pour « Changer » : capturé avant toute attente.
  const avant = w;
  setOccupe(true); setErreur(null);
  const r = await garderOffres(offres, nom);
  if (!r.ok || !r.productId) { setOccupe(false); setErreur(r.erreur ?? 'Impossible d’ajouter ce produit. Réessaie.'); return; }
  // Occupé jusqu'au règlement : le chevron reste inactif pendant le rechargement.
  await recharger();
  setOccupe(false);
  setComparaison(null);
  const productId = r.productId;
  onRegle(DRIVES_RECHERCHE.map(d => { const o = offres.find(x => x.drive === d);
   return o ? { qui: NOMS_DRIVE[d], quoi: `${nomCourt(o.libelle)} · ${prixLisible(o.prix) ?? 'n.c.'}`,
    produit: { nom: o.libelle, image: o.image_url, prix: prixLisible(o.prix), unite: o.prix_unitaire != null && o.unite_prix ? prixLisible(o.prix_unitaire, o.unite_prix) : null, histoire: o.histoire ?? null } }
    : { qui: NOMS_DRIVE[d], quoi: 'non choisi', vide: true }; }),
   ingredient ? () => delier(productId) : () => avant.rouvrirManque(lineKey, avant, productId), Object.fromEntries(offres.map(o => [o.drive, o])) as ChoixOffres);
  if (ingredient) lier(productId); else w.validerManque(lineKey, qty, productId);
 };
 const choisies = [choix.carrefour, choix.leclerc].filter((o): o is OffreRelevee => !!o);
 const id = lineKey.startsWith('produit:') ? lineKey.slice(8) : undefined, extra = w.extras.find(x => `extra:${x.id}` === lineKey);
 const qty = id ? w.quotidienQty[id] ?? 1 : extra?.quantity ?? 1, nom = extra?.name ?? manque.name;
 const disparu = !!id && !products.some(p => p.id === id);
 const recettes = ingredient ? [...new Set(ingredient.sources.map(x => x.label))].join(', ') : '';
 const origine = ingredient ? [ingredient.besoin, recettes].filter(Boolean).join(' · ')
  : [sources[manque.source], disparu ? 'produit retiré de ton catalogue' : 'pas encore un de tes produits'].filter(Boolean).join(' · ');
 // Un ingrédient lié l'est pour ses recettes (les fois suivantes aussi) et pour la liste en cours.
 const ck = ingredient?.choixKey ?? '';
 const lier = (productId: string) => { w.choisirProduit(ck, productId); rattacher(ingredient?.ingredientIds ?? [], productId, ingredient?.rayon); };
 const delier = (productId: string) => { void productId; w.oublierChoixProduit(ck); rattacher(ingredient?.ingredientIds ?? [], null, ingredient?.rayon); };
 const retirer = () => { const avant = w.ligneQuantites[lineKey];
  onRegle([{ qui: 'Retiré', quoi: 'de ta liste', vide: true }], () => w.restaurerLigne(lineKey, avant));
  w.modifierLigne(lineKey, 0); onRetrait(`${nom} retiré de ta liste`, () => w.restaurerLigne(lineKey, avant)); };
 const garderSansProduit = () => {
  if (ingredient) { onRegle([{ qui: 'Gardé', quoi: 'sans produit, cherché par son nom', vide: true }], () => w.garderIngredient(ck, false)); w.garderIngredient(ck, true); return; }
  onRegle([{ qui: 'Gardé', quoi: 'sans produit, cherché par son nom', vide: true }], () => w.rouvrirManque(lineKey, w)); w.validerManque(lineKey, qty); };
 const entete = <View style={{ gap: 10, paddingBottom: 10 }}>
  {progression}
  <View style={s.heros}>
   <View style={s.inconnu}><Feather name={ingredient ? 'book-open' : manque.source === 'siri' ? 'mic' : manque.source === 'rappels' ? 'check-circle' : 'edit-2'} size={20} color={colors.attentionText} /></View>
   <View style={{ flex: 1, gap: 2 }}>
    <View style={s.nomLigne}><Text style={[s.nom, { flexShrink: 1 }]} numberOfLines={2}>« {nom} »</Text>{!ingredient && <Text style={s.qteDiscrete}>× {qty}</Text>}</View>
    <Text style={[ui.detail, { marginTop: 0 }, !!filtre && s.sousFiltre]} accessibilityLiveRegion="polite">{filtre
     ? `${filtre} · ${affinage?.trouves ?? 0} trouvé${(affinage?.trouves ?? 0) > 1 ? 's' : ''}` : origine}</Text>
    {!!filtre && <Pressable accessibilityRole="button" onPress={() => setFiltre(null)} hitSlop={8} style={s.toutVoir}><Text style={s.toutVoirTexte}>Voir tous les « {nom} »</Text></Pressable>}
   </View>
   {typeVisible && <Pressable accessibilityRole="button" accessibilityLabel={filtre ? `Type : ${filtre}. Changer de type` : `Quel type de ${nom} ?`} onPress={() => setFeuilleType(true)}
    style={({ pressed }) => [s.type, !!filtre && s.typeActif, pressed && { opacity: .8 }]}>
    <Text style={[s.typeTexte, !!filtre && { color: colors.accentContrast }]} numberOfLines={1}>{filtre ?? 'Quel type ?'}</Text>
    <Feather name="chevron-down" size={15} color={filtre ? colors.accentContrast : colors.accent} />
   </Pressable>}
  </View>
  <FeuilleType visible={feuilleType} onFermer={() => setFeuilleType(false)} nom={nom} types={affinage?.types ?? []} marques={affinage?.marques ?? []} filtre={filtre} onFiltre={setFiltre} />
 </View>;
 const nCoches = comparaison?.coches.length ?? 0;
 // En comparaison, le pied fixe garde « Comparer » à portée du pouce, quelle que soit la longueur de la liste.
 const pied = etape === 'resultats' && comparaison ? <View style={{ gap: 8 }}>
  {toast}
  <Text style={s.coches} accessibilityLiveRegion="polite">{nCoches === 0 ? 'Coche au moins deux produits' : `${nCoches} produit${nCoches > 1 ? 's' : ''} coché${nCoches > 1 ? 's' : ''}`}</Text>
  <Pressable accessibilityRole="button" accessibilityLabel={`Comparer les ${nCoches} produits cochés`} disabled={nCoches < 2} onPress={() => setComparaison({ ...comparaison, ouvert: true })} style={[s.valider, nCoches < 2 && s.validerInactif]}>
   <Text style={[s.validerTexte, nCoches < 2 && { color: colors.offText }]}>Comparer</Text>
  </Pressable>
  <View style={s.liensPied}>
   <Pressable accessibilityRole="button" onPress={() => setComparaison(null)} hitSlop={6} style={s.lienPied}><Text style={s.lienPiedTexte}>Annuler</Text></Pressable>
  </View>
 </View>
 // Des résultats : le pied récapitule le choix par enseigne et valide ; garder sans produit et retirer restent à portée.
 : etape === 'resultats' ? <View style={{ gap: 8 }}>
  {toast}
  <Recapitulatif choix={choix} />
  {!!erreur && <Text accessibilityLiveRegion="polite" style={[ui.error, { textAlign: 'center' }]}>{erreur}</Text>}
  {/* Une enseigne encore à choisir alors qu'elle a des produits : valider sans elle reste possible, sans y pousser. */}
  {(() => { const manquante = choisies.length === 1 ? DRIVES_RECHERCHE.find(d => !choix[d] && nombres[d] > 0) : undefined;
   return <Pressable accessibilityRole="button" disabled={!choisies.length || occupe} onPress={() => { void valider(choisies); }}
    style={[manquante ? s.garderNom : s.valider, manquante && { flex: 0 }, (!choisies.length || occupe) && s.validerInactif]}>
    {occupe ? <ActivityIndicator color={manquante ? colors.accent : colors.accentContrast} /> : <Text style={[manquante ? s.garderNomTexte : s.validerTexte, !choisies.length && { color: colors.offText }]}>
     {choisies.length === 2 ? 'Valider les 2 produits' : manquante ? `Valider sans ${NOMS_DRIVE[manquante]}` : choisies.length === 1 ? 'Valider ce seul produit' : 'Choisis un produit'}</Text>}
   </Pressable>; })()}
  <View style={s.liensPied}>
   <Pressable accessibilityRole="button" accessibilityLabel={`Garder « ${nom} » sans produit. L’extension le cherchera par son nom.`} onPress={garderSansProduit} hitSlop={6} style={s.lienPied}><Text style={s.lienPiedTexte}>Garder sans produit</Text></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${nom} de ta liste`} onPress={retirer} hitSlop={6} style={s.lienPied}><Text style={[s.lienPiedTexte, { color: colors.danger }]}>Retirer</Text></Pressable>
  </View>
 </View>
 // Recherche confiée à l'extension : le pied dit où elle en est, et l'on peut passer au point suivant.
 : etape === 'attente' ? <View style={{ gap: 8 }}>
  {toast}
  <EtatExtension etat={extension} attendu="recherches" compact />
  <View style={s.issues}>
   {onPasser && <Pressable accessibilityRole="button" onPress={onPasser} style={({ pressed }) => [s.garderNom, pressed && { opacity: .85 }]}>
    <Text style={s.garderNomTexte}>Passer au suivant</Text>
   </Pressable>}
   <Pressable accessibilityRole="button" accessibilityLabel={`Garder « ${nom} » sans produit. L’extension le cherchera par son nom.`} onPress={garderSansProduit} style={({ pressed }) => [onPasser ? s.lienPied : s.garderNom, pressed && { opacity: .85 }]}>
    <Text style={onPasser ? s.lienPiedTexte : s.garderNomTexte} numberOfLines={2}>Garder sans produit</Text>
   </Pressable>
  </View>
 </View> : <View style={{ gap: 6 }}>
  {toast}
  <View style={s.issues}>
   {/* Le nom est déjà en tête de l'écran ; ce que fait l'extension sans produit passe dans l'aide VoiceOver. */}
   <Pressable accessibilityRole="button" accessibilityLabel={`Garder « ${nom} » sans produit. L’extension le cherchera par son nom.`} onPress={garderSansProduit} style={({ pressed }) => [s.garderNom, pressed && { opacity: .85 }]}>
    <Text style={s.garderNomTexte} numberOfLines={1}>Garder sans produit</Text>
   </Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${nom} de ta liste`} onPress={retirer} style={({ pressed }) => [s.retirer, pressed && { opacity: .85 }]}>
    <Feather name="trash-2" size={17} color={colors.danger} /><Text style={s.retirerTexte}>Retirer</Text>
   </Pressable>
  </View>
 </View>;
 return <SelecteurIngredient titre={titre} verbe="Choisir" sansProduit={false} requeteInitiale={nom} catalogue={false} entete={entete} pied={pied}
  onFermer={onFermer} onPrecedent={occupe ? null : onPrecedent} libellePrecedent={libellePrecedent}
  onChoisir={c => { const productId = c.product_id; if (!productId) return;
   onRegle([{ qui: 'Produit', quoi: c.name }], () => w.rouvrirManque(lineKey, w, productId)); w.validerManque(lineKey, qty, productId); }}
  basesOuvertes={false}
  apres={<RechercheDrives requete={nom} autres={autres} onPhase={setEtape} choix={choix} onChoix={c => { setChoix(c); setErreur(null); }}
   onValider={o => { void valider(o); }} occupe={occupe} erreurValider={erreur} comparaison={comparaison} onComparaison={setComparaison} onNombres={setNombres} filtre={filtre} onAffinage={setAffinage} />} />;
}

/** Un doublon possible (DB1) : « Garder celui-ci » sous chaque photo ; l'autre est retiré, annulable. */
function GarderUn({ titre, progression, doublon, products, onFermer, onRetrait, toast, onPrecedent, libellePrecedent, onRegle }: { titre: string; progression: ReactNode; doublon: Doublon; products: Product[]; onFermer: () => void; onRetrait: (texte: string, annuler: () => void) => void; toast?: ReactNode; onPrecedent: (() => void) | null; libellePrecedent: string; onRegle: OnRegle }) {
 const w = useWizard(), insets = useSafeAreaInsets();
 const retirer = (l: LigneMaison, garde: LigneMaison) => { const avant = w.ligneQuantites[l.key];
  onRegle([{ qui: 'Gardé', quoi: garde.name }, { qui: 'Retiré', quoi: l.name, vide: true }], () => w.restaurerLigne(l.key, avant));
  w.modifierLigne(l.key, 0); onRetrait(`${l.name} retiré de ta liste`, () => w.restaurerLigne(l.key, avant)); };
 const { a, b } = doublon;
 // Ni l'un ni l'autre : les deux lignes quittent la liste, « Annuler » les remet.
 const retirerLesDeux = () => {
  const avantA = w.ligneQuantites[a.key], avantB = w.ligneQuantites[b.key];
  const remettre = () => { w.restaurerLigne(a.key, avantA); w.restaurerLigne(b.key, avantB); };
  onRegle([{ qui: 'Retirés', quoi: `${a.name} et ${b.name}`, vide: true }], remettre);
  w.modifierLigne(a.key, 0); w.modifierLigne(b.key, 0);
  onRetrait(`${a.name} et ${b.name} retirés de ta liste`, remettre);
 };
 const tuile = (garde: LigneMaison, autre: LigneMaison) => {
  const produit = products.find(p => p.id === garde.product_id), origine = [...new Set(garde.sources.map(x => x.label))].join(' · ');
  return <View style={s.tuile}>
   <View style={s.image}><Photo name={garde.name} url={produit?.image_url} style={s.photo} /></View>
   <View style={s.texte}><Text style={ui.productName} numberOfLines={3}>{garde.name}</Text><Text style={[ui.detail, { marginTop: 2 }]} numberOfLines={1}>{[origine, garde.unit && garde.unit !== 'unité' ? `${garde.totalQuantity.toLocaleString('fr-FR')} ${garde.unit}` : `× ${garde.totalQuantity}`].filter(Boolean).join(' · ')}</Text></View>
   <Pressable accessibilityRole="button" accessibilityLabel={`Garder ${garde.name}, ${garde.totalQuantity} article${garde.totalQuantity > 1 ? 's' : ''}. ${autre.name} sera retiré`} onPress={() => retirer(autre, garde)} style={({ pressed }) => [s.garder, pressed && { opacity: .85 }]}>
    <Text style={s.garderTexte}>Garder celui-ci</Text>
   </Pressable>
  </View>;
 };
 return <SafeAreaView edges={['top']} style={s.ecran}>
  <Entete titre={titre} onFermer={onFermer} onPrecedent={onPrecedent} libellePrecedent={libellePrecedent} />
  {progression}
  <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 14, flex: 1 }}>
   <Text style={s.question}>Le même achat, noté deux fois ?</Text>
   <View style={s.duo}>{tuile(a, b)}<Text style={s.ou}>ou</Text>{tuile(b, a)}</View>
  </View>
  <View style={[s.basDoublon, { paddingBottom: 12 + insets.bottom }]}>
   {toast}
   <Pressable accessibilityRole="button" onPress={() => { onRegle([{ qui: 'Gardés', quoi: 'deux achats différents' }], () => w.oublierDistinct(a.name, b.name)); w.declarerDistinct(a.name, b.name); }} style={({ pressed }) => [s.differents, pressed && { opacity: .85 }]}><Text style={s.garderNomTexte}>Ce sont deux achats différents</Text></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${a.name} et ${b.name} de ta liste`} onPress={retirerLesDeux} style={({ pressed }) => [s.lienPied, pressed && { opacity: .6 }]}><Text style={[s.lienPiedTexte, { color: colors.danger }]}>Retirer les deux</Text></Pressable>
   <Text style={s.explication}>Garder l’un retire l’autre de ta liste ; « Annuler » reste possible.</Text>
  </View>
 </SafeAreaView>;
}

const s = StyleSheet.create({
 ecran: { flex: 1, backgroundColor: colors.bg },
 entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 8, paddingTop: 12, paddingBottom: 8 },
 titre: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
 fermer: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
 fermerRond: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.off, alignItems: 'center', justifyContent: 'center' },
 pas: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, minHeight: 6 },
 segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
 segmentFait: { backgroundColor: colors.accent },
 segmentCourant: { height: 6, borderRadius: 3, backgroundColor: colors.text },
 carteRegle: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 4 },
 ligneRegle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44, paddingVertical: 8 },
 ligneRegleTrait: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
 recap: { marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' },
 recapLigne: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10 },
 piedFin: { backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
 statutRegle: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
 nomRegle: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
 carteEnseigne: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
 enseigne: { fontSize: 12, fontWeight: '700', letterSpacing: .5, color: colors.textMuted, textTransform: 'uppercase' },
 produitRetenu: { flexDirection: 'row', alignItems: 'center', gap: 12 },
 photoRetenu: { width: 64, height: 64, borderRadius: 12 },
 histoireRetenu: { fontSize: 12, fontWeight: '600', color: colors.accent },
 prixRetenu: { fontSize: 16, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
 piedRegle: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
 modifier: { flex: 1, minHeight: 50, borderRadius: 12, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
 nomLigne: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
 qteDiscrete: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
 toutVoir: { minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' },
 toutVoirTexte: { fontSize: 14, fontWeight: '600', color: colors.accent },
 sousFiltre: { color: colors.accent, fontWeight: '600' },
 type: { maxWidth: 140, minHeight: 44, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderColor: colors.accent, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 4 },
 typeActif: { backgroundColor: colors.accent },
 typeTexte: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: colors.accent },
 dejaRegle: { fontSize: 13, fontWeight: '600', color: colors.accent },
 qui: { fontSize: 15, fontWeight: '600', color: colors.text },
 quoi: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text, textAlign: 'right' },
 heros: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surface },
 inconnu: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.attentionSoft, alignItems: 'center', justifyContent: 'center' },
 nom: { fontSize: 17, fontWeight: '700', color: colors.text },
 qte: { fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
 issues: { flexDirection: 'row', gap: 8 },
 garderNom: { flex: 1, minHeight: 50, borderRadius: 12, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, backgroundColor: colors.surface },
 garderNomTexte: { fontSize: 15, fontWeight: '600', color: colors.accent, textAlign: 'center' },
 retirer: { minHeight: 50, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12 },
 retirerTexte: { fontSize: 15, fontWeight: '600', color: colors.danger },
 lienPied: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
 liensPied: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
 coches: { fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'center' },
 valider: { minHeight: 50, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
 validerInactif: { backgroundColor: colors.off },
 validerTexte: { fontSize: 15, fontWeight: '600', color: colors.accentContrast },
 lienPiedTexte: { fontSize: 15, fontWeight: '600', color: colors.accent, textAlign: 'center' },
 explication: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
 question: { fontSize: 17, fontWeight: '700', color: colors.text },
 duo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
 ou: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
 tuile: { flex: 1, alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
 image: { height: 112, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
 photo: { width: 92, height: 92, borderRadius: 8 },
 // flexGrow et non flex : sur iPhone, flex: 1 écrasait le texte à zéro dans une carte sans hauteur fixe.
 texte: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8, flexGrow: 1 },
 garder: { margin: 8, marginTop: 0, minHeight: 44, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
 garderTexte: { fontSize: 15, fontWeight: '700', color: colors.accent },
 basDoublon: { paddingHorizontal: 16, paddingTop: 10, gap: 6 },
 differents: { minHeight: 50, borderRadius: 12, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
