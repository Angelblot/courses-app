import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useWizard } from '../contexts/WizardContext';
import { useProducts, type Product } from '../stores/products';
import { garderOffres } from '../stores/recherches-drive';
import type { LigneMaison } from '../lib/liste-maison';
import { produitsProches, type Manque } from '../lib/session-courses';
import { sources } from './Manques';
import { Precedent, SelecteurIngredient } from './SelecteurIngredient';
import { RechercheDrives, Recapitulatif, type Comparaison } from './RechercheDrives';
import { EtatExtension } from './EtatExtension';
import { useExtension } from '../stores/extension';
import { DRIVES_RECHERCHE, NOMS_DRIVE, prixLisible, type ChoixOffres, type OffreRelevee, type phase as Phase } from '../lib/recherche-drive.ts';
import { nomCourt } from '../lib/analyse-comparatif.ts';
import { precedentDe, rangDans, visiter } from '../lib/parcours-preciser.ts';
import { Photo, ui } from './MaisonUI';
import { colors } from '../lib/theme';

type Doublon = { id: string; a: LigneMaison; b: LigneMaison };
type Point = { type: 'manque'; key: string; manque: Manque } | { type: 'doublon'; doublon: Doublon };
/** Ce qui a été décidé pour un point, en lignes « qui : quoi », pour le revoir. */
type Resume = { qui: string; quoi: string; vide?: boolean }[];
type Regle = { nom: string; type: Point['type']; resume: Resume; annuler: () => void };
type OnRegle = (resume: Resume, annuler: () => void) => void;

/**
 * « Préciser » au bilan (variante PR1) : un manque ou un doublon à la fois,
 * toujours nommé en haut, avec ses issues juste dessous. Un manque se
 * précise avec la recherche commune (tes produits, Open Food Facts, scan),
 * se garde sous son nom ou se retire ; un doublon se règle en gardant l'un
 * des deux (DB1). On passe tout seul au suivant ; le bilan ferme la feuille
 * dès qu'il ne reste plus rien. Le chevron de l'en-tête remonte les points
 * déjà vus : réglé, un point s'affiche en résumé et peut être rouvert.
 */
export function ReglerSheet({ visible, onFermer, manques, doublons, products, onRetrait, toast }: { visible: boolean; onFermer: () => void; manques: [string, Manque][]; doublons: Doublon[]; products: Product[]; onRetrait: (texte: string, annuler: () => void) => void; toast?: ReactNode }) {
 // « Passer au suivant » range un point en fin de file, le temps que l'extension cherche.
 const [reportes, setReportes] = useState<string[]>([]);
 // L'ordre de visite, ce qui a été réglé, et le point revu par « Précédent » (null : la tête de file).
 const [parcours, setParcours] = useState<string[]>([]);
 const [regles, setRegles] = useState<Record<string, Regle>>({});
 const [focus, setFocus] = useState<string | null>(null);
 const cle = (p: Point) => p.type === 'manque' ? p.key : p.doublon.id;
 const tous: Point[] = [...manques.map(([key, manque]) => ({ type: 'manque' as const, key, manque })), ...doublons.map(doublon => ({ type: 'doublon' as const, doublon }))];
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
 useEffect(() => { if (!visible) { setParcours([]); setRegles({}); setFocus(null); } }, [visible]);

 // La file entière, dans l'ordre de visite : « 3 sur 19 » ne bouge pas quand un point est réglé.
 const ordre = [...parcours, ...points.map(cle).filter(k => !parcours.includes(k))];
 const n = Math.max(ordre.length, 1), position = affiche ? Math.min(n, rangDans(parcours, affiche)) : 1;
 const titre = fin ? 'Préciser' : `Préciser · ${position} sur ${n}`;
 const ouverts = new Set(points.map(cle));
 const progression = n > 1 ? <View style={s.pas} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
  {ordre.map(k => <View key={k} style={[s.segment, k === affiche && s.segmentCourant, !ouverts.has(k) && !!regles[k] && s.segmentFait]} />)}
 </View> : null;

 const nomDe = (k: string) => { const p = points.find(x => cle(x) === k);
  return p ? (p.type === 'manque' ? p.manque.name : `${p.doublon.a.name} ou ${p.doublon.b.name}`) : regles[k]?.nom ?? ''; };
 const reglesDansLOrdre = ordre.filter(k => regles[k] && !ouverts.has(k)).map(k => ({ cle: k, regle: regles[k] }));
 const avant = affiche ? precedentDe(parcours, affiche) : fin ? reglesDansLOrdre[reglesDansLOrdre.length - 1]?.cle ?? null : null;
 const onPrecedent = avant ? () => setFocus(avant) : null;
 const libellePrecedent = avant ? `Revenir à « ${nomDe(avant)} »` : 'Point précédent';
 // VoiceOver suit le changement de point : le contenu de la feuille est remplacé d'un bloc.
 useEffect(() => {
  if (visible && affiche) AccessibilityInfo.announceForAccessibility(`${titre}. ${nomDe(affiche)}${focusRegle ? ', déjà réglé' : ''}`);
  else if (visible && fin) AccessibilityInfo.announceForAccessibility('Tout est réglé');
 }, [visible, affiche, !!focusRegle, fin]);
 const regle = (k: string, nom: string, type: Point['type']): OnRegle => (resume, annuler) => {
  setRegles(r => ({ ...r, [k]: { nom, type, resume, annuler } }));
  setFocus(null);
 };

 return <Modal visible={visible && !vide} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFermer}>
  {fin
   ? <ToutRegle progression={progression} points={reglesDansLOrdre} toast={toast} onFermer={onFermer} onPrecedent={onPrecedent} libellePrecedent={libellePrecedent} onRevoir={setFocus} />
   : focusRegle && focus
   ? <PointRegle titre={titre} progression={progression} regle={focusRegle} onFermer={onFermer} onPrecedent={onPrecedent}
     suite={cleTete ? { rang: rangDans(parcours, cleTete), nom: nomDe(cleTete) } : null} libellePrecedent={libellePrecedent}
     onContinuer={() => setFocus(null)}
     onChanger={() => { focusRegle.annuler(); setRegles(r => { const { [focus]: _, ...reste } = r; return reste; }); }} />
   : courant?.type === 'manque'
   ? <PreciserManque key={courant.key} titre={titre} progression={progression} lineKey={courant.key} manque={courant.manque} products={products} onFermer={onFermer} onRetrait={onRetrait} toast={toast}
     autres={manques.filter(([k]) => k !== courant.key).map(([, m]) => m.name)} onPrecedent={onPrecedent} libellePrecedent={libellePrecedent}
     onRegle={regle(courant.key, courant.manque.name, 'manque')}
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
 return <SafeAreaView edges={['top']} style={s.ecran}>
  <Entete titre={titre} onFermer={onFermer} onPrecedent={onPrecedent} libellePrecedent={libellePrecedent} />
  <View style={{ gap: 10, paddingBottom: 10 }}>
   {progression}
   <View style={s.heros}>
    <View style={s.statutRegle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Feather name="check" size={24} color={colors.accentContrast} /></View>
    <View style={{ flex: 1, gap: 2 }}><Text style={s.nom} numberOfLines={2}>« {regle.nom} »</Text><Text style={s.dejaRegle}>Déjà réglé</Text></View>
   </View>
  </View>
  <View style={{ paddingHorizontal: 16, gap: 10, flex: 1 }}>
   <View style={s.carteRegle} accessible accessibilityLabel={regle.resume.map(l => `${l.qui} : ${l.quoi}`).join('. ')}>
    {regle.resume.map((l, i) => <View key={i} style={[s.ligneRegle, i > 0 && s.ligneRegleTrait]}>
     <Text style={s.qui}>{l.qui}</Text>
     <Text style={[s.quoi, l.vide && { color: colors.textMuted, fontWeight: '400' }]} numberOfLines={2}>{l.quoi}</Text>
    </View>)}
   </View>
   <Text style={[s.explication, { textAlign: 'left', paddingHorizontal: 4 }]}>{regle.type === 'manque'
    ? '« Changer » rouvre ce point. Les résultats des drives sont gardés : rien n’est recherché à nouveau.'
    : '« Changer » remet les deux lignes, pour trancher autrement.'}</Text>
  </View>
  <View style={[s.basDoublon, { paddingBottom: 12 + insets.bottom }]}>
   <Pressable accessibilityRole="button" accessibilityLabel={suite ? `Continuer au point ${suite.rang}, « ${suite.nom} »` : 'Voir le récapitulatif'} onPress={onContinuer} style={({ pressed }) => [s.valider, pressed && { opacity: .85 }]}>
    <Text style={s.validerTexte}>{suite ? `Continuer au point ${suite.rang}` : 'Voir le récapitulatif'}</Text>
   </Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel={`Changer « ${regle.nom} »`} onPress={onChanger} style={({ pressed }) => [s.lienPied, pressed && { opacity: .6 }]}>
    <Text style={s.lienPiedTexte}>Changer</Text>
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
function PreciserManque({ titre, progression, lineKey, manque, products, onFermer, onRetrait, toast, autres, onPasser, onPrecedent, libellePrecedent, onRegle }: { titre: string; progression: ReactNode; lineKey: string; manque: Manque; products: Product[]; onFermer: () => void; onRetrait: (texte: string, annuler: () => void) => void; toast?: ReactNode; autres: string[]; onPasser?: () => void; onPrecedent: (() => void) | null; libellePrecedent: string; onRegle: OnRegle }) {
 const w = useWizard(), extension = useExtension();
 const [etape, setEtape] = useState<ReturnType<typeof Phase>>('aucune');
 const { recharger } = useProducts();
 const [choix, setChoix] = useState<ChoixOffres>({}), [occupe, setOccupe] = useState(false), [erreur, setErreur] = useState<string | null>(null);
 const [comparaison, setComparaison] = useState<Comparaison>(null);
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
   return o ? { qui: NOMS_DRIVE[d], quoi: `${nomCourt(o.libelle)} · ${prixLisible(o.prix) ?? 'n.c.'}` } : { qui: NOMS_DRIVE[d], quoi: 'non choisi', vide: true }; }),
   () => avant.rouvrirManque(lineKey, avant, productId));
  w.validerManque(lineKey, qty, productId);
 };
 const choisies = [choix.carrefour, choix.leclerc].filter((o): o is OffreRelevee => !!o);
 const id = lineKey.startsWith('produit:') ? lineKey.slice(8) : undefined, extra = w.extras.find(x => `extra:${x.id}` === lineKey);
 const qty = id ? w.quotidienQty[id] ?? 1 : extra?.quantity ?? 1, nom = extra?.name ?? manque.name;
 const disparu = !!id && !products.some(p => p.id === id);
 const origine = [sources[manque.source], disparu ? 'produit retiré de ton catalogue' : 'pas encore un de tes produits'].filter(Boolean).join(' · ');
 const retirer = () => { const avant = w.ligneQuantites[lineKey];
  onRegle([{ qui: 'Retiré', quoi: 'de ta liste', vide: true }], () => w.restaurerLigne(lineKey, avant));
  w.modifierLigne(lineKey, 0); onRetrait(`${nom} retiré de ta liste`, () => w.restaurerLigne(lineKey, avant)); };
 const garderSansProduit = () => { onRegle([{ qui: 'Gardé', quoi: 'sans produit, cherché par son nom', vide: true }], () => w.rouvrirManque(lineKey, w)); w.validerManque(lineKey, qty); };
 const entete = <View style={{ gap: 10, paddingBottom: 10 }}>
  {progression}
  <View style={s.heros}>
   <View style={s.inconnu}><Feather name={manque.source === 'siri' ? 'mic' : manque.source === 'rappels' ? 'check-circle' : 'edit-2'} size={20} color={colors.attentionText} /></View>
   <View style={{ flex: 1, gap: 2 }}><Text style={s.nom} numberOfLines={2}>« {nom} »</Text><Text style={[ui.detail, { marginTop: 0 }]}>{origine}</Text></View>
   <Text style={s.qte}>× {qty}</Text>
  </View>
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
  <Pressable accessibilityRole="button" disabled={!choisies.length || occupe} onPress={() => { void valider(choisies); }} style={[s.valider, (!choisies.length || occupe) && s.validerInactif]}>
   {occupe ? <ActivityIndicator color={colors.accentContrast} /> : <Text style={[s.validerTexte, !choisies.length && { color: colors.offText }]}>{choisies.length === 2 ? 'Valider les 2 produits' : choisies.length === 1 ? 'Valider ce seul produit' : 'Choisis un produit'}</Text>}
  </Pressable>
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
 return <SelecteurIngredient titre={titre} verbe="Choisir" sansProduit={false} requeteInitiale={nom} proches={produitsProches(nom, products)} entete={entete} pied={pied}
  onFermer={onFermer} onPrecedent={occupe ? null : onPrecedent} libellePrecedent={libellePrecedent}
  onChoisir={c => { const productId = c.product_id; if (!productId) return;
   onRegle([{ qui: 'Produit', quoi: c.name }], () => w.rouvrirManque(lineKey, w, productId)); w.validerManque(lineKey, qty, productId); }}
  basesOuvertes={false}
  apres={<RechercheDrives requete={nom} autres={autres} onPhase={setEtape} choix={choix} onChoix={c => { setChoix(c); setErreur(null); }}
   onValider={o => { void valider(o); }} occupe={occupe} erreurValider={erreur} comparaison={comparaison} onComparaison={setComparaison} />} />;
}

/** Un doublon possible (DB1) : « Garder celui-ci » sous chaque photo ; l'autre est retiré, annulable. */
function GarderUn({ titre, progression, doublon, products, onFermer, onRetrait, toast, onPrecedent, libellePrecedent, onRegle }: { titre: string; progression: ReactNode; doublon: Doublon; products: Product[]; onFermer: () => void; onRetrait: (texte: string, annuler: () => void) => void; toast?: ReactNode; onPrecedent: (() => void) | null; libellePrecedent: string; onRegle: OnRegle }) {
 const w = useWizard(), insets = useSafeAreaInsets();
 const retirer = (l: LigneMaison, garde: LigneMaison) => { const avant = w.ligneQuantites[l.key];
  onRegle([{ qui: 'Gardé', quoi: garde.name }, { qui: 'Retiré', quoi: l.name, vide: true }], () => w.restaurerLigne(l.key, avant));
  w.modifierLigne(l.key, 0); onRetrait(`${l.name} retiré de ta liste`, () => w.restaurerLigne(l.key, avant)); };
 const { a, b } = doublon;
 const tuile = (garde: LigneMaison, autre: LigneMaison) => {
  const produit = products.find(p => p.id === garde.product_id), origine = [...new Set(garde.sources.map(x => x.label))].join(' · ');
  return <View style={s.tuile}>
   <View style={s.image}><Photo name={garde.name} url={produit?.image_url} style={s.photo} /></View>
   <View style={s.texte}><Text style={ui.productName} numberOfLines={3}>{garde.name}</Text><Text style={[ui.detail, { marginTop: 2 }]} numberOfLines={1}>{[origine, `× ${garde.totalQuantity}`].filter(Boolean).join(' · ')}</Text></View>
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
 texte: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8, flex: 1 },
 garder: { margin: 8, marginTop: 0, minHeight: 44, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
 garderTexte: { fontSize: 15, fontWeight: '700', color: colors.accent },
 basDoublon: { paddingHorizontal: 16, paddingTop: 10, gap: 6 },
 differents: { minHeight: 50, borderRadius: 12, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
