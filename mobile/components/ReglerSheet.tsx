import { useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useWizard } from '../contexts/WizardContext';
import type { Product } from '../stores/products';
import type { LigneMaison } from '../lib/liste-maison';
import { produitsProches, type Manque } from '../lib/session-courses';
import { sources } from './Manques';
import { SelecteurIngredient } from './SelecteurIngredient';
import { RechercheDrives } from './RechercheDrives';
import { EtatExtension } from './EtatExtension';
import { useExtension } from '../stores/extension';
import type { phase as Phase } from '../lib/recherche-drive.ts';
import { Photo, ui } from './MaisonUI';
import { colors } from '../lib/theme';

type Doublon = { id: string; a: LigneMaison; b: LigneMaison };
type Point = { type: 'manque'; key: string; manque: Manque } | { type: 'doublon'; doublon: Doublon };

/**
 * « Préciser » au bilan (variante PR1) : un manque ou un doublon à la fois,
 * toujours nommé en haut, avec ses issues juste dessous. Un manque se
 * précise avec la recherche commune (tes produits, Open Food Facts, scan),
 * se garde sous son nom ou se retire ; un doublon se règle en gardant l'un
 * des deux (DB1). On passe tout seul au suivant ; le bilan ferme la feuille
 * dès qu'il ne reste plus rien.
 */
export function ReglerSheet({ visible, onFermer, manques, doublons, products, onRetrait, toast }: { visible: boolean; onFermer: () => void; manques: [string, Manque][]; doublons: Doublon[]; products: Product[]; onRetrait: (texte: string, annuler: () => void) => void; toast?: ReactNode }) {
 // « Passer au suivant » range un point en fin de file, le temps que l'extension cherche.
 const [reportes, setReportes] = useState<string[]>([]);
 const cle = (p: Point) => p.type === 'manque' ? p.key : p.doublon.id;
 const tous: Point[] = [...manques.map(([key, manque]) => ({ type: 'manque' as const, key, manque })), ...doublons.map(doublon => ({ type: 'doublon' as const, doublon }))];
 const points = [...tous.filter(p => !reportes.includes(cle(p))), ...reportes.flatMap(k => tous.filter(p => cle(p) === k))];
 // Le total de départ fixe la progression : « 2 sur 4 » même quand un point réglé disparaît.
 const total = useRef(points.length);
 if (!visible || points.length > total.current) total.current = points.length;
 const n = Math.max(total.current, 1), position = Math.min(n, n - points.length + 1);
 const titre = `Préciser · ${position} sur ${n}`, courant = points[0];
 const progression = n > 1 ? <View style={s.pas} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{Array.from({ length: n }, (_, i) => <View key={i} style={[s.segment, i < position && s.segmentFait]} />)}</View> : null;

 return <Modal visible={visible && !!courant} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFermer}>
  {courant?.type === 'manque'
   ? <PreciserManque key={courant.key} titre={titre} progression={progression} lineKey={courant.key} manque={courant.manque} products={products} onFermer={onFermer} onRetrait={onRetrait} toast={toast}
     autres={manques.filter(([k]) => k !== courant.key).map(([, m]) => m.name)}
     onPasser={points.length > 1 ? () => setReportes(r => [...r.filter(k => k !== courant.key), courant.key]) : undefined} />
   : courant?.type === 'doublon'
    ? <GarderUn key={courant.doublon.id} titre={titre} progression={progression} doublon={courant.doublon} products={products} onFermer={onFermer} onRetrait={onRetrait} toast={toast} />
    : null}
 </Modal>;
}

/**
 * Un manque : la recherche commune, puis « Chercher sur les drives » par
 * l'extension (CD), et en bas « garder sans produit » ou « retirer ».
 */
function PreciserManque({ titre, progression, lineKey, manque, products, onFermer, onRetrait, toast, autres, onPasser }: { titre: string; progression: ReactNode; lineKey: string; manque: Manque; products: Product[]; onFermer: () => void; onRetrait: (texte: string, annuler: () => void) => void; toast?: ReactNode; autres: string[]; onPasser?: () => void }) {
 const w = useWizard(), extension = useExtension();
 const [etape, setEtape] = useState<ReturnType<typeof Phase>>('aucune');
 const id = lineKey.startsWith('produit:') ? lineKey.slice(8) : undefined, extra = w.extras.find(x => `extra:${x.id}` === lineKey);
 const qty = id ? w.quotidienQty[id] ?? 1 : extra?.quantity ?? 1, nom = extra?.name ?? manque.name;
 const disparu = !!id && !products.some(p => p.id === id);
 const origine = [sources[manque.source], disparu ? 'produit retiré de ton catalogue' : 'pas encore un de tes produits'].filter(Boolean).join(' · ');
 const retirer = () => { const avant = w.ligneQuantites[lineKey]; w.modifierLigne(lineKey, 0); onRetrait(`${nom} retiré de ta liste`, () => w.restaurerLigne(lineKey, avant)); };
 const entete = <View style={{ gap: 10, paddingBottom: 10 }}>
  {progression}
  <View style={s.heros}>
   <View style={s.inconnu}><Feather name={manque.source === 'siri' ? 'mic' : manque.source === 'rappels' ? 'check-circle' : 'edit-2'} size={20} color={colors.attentionText} /></View>
   <View style={{ flex: 1, gap: 2 }}><Text style={s.nom} numberOfLines={2}>« {nom} »</Text><Text style={[ui.detail, { marginTop: 0 }]}>{origine}</Text></View>
   <Text style={s.qte}>× {qty}</Text>
  </View>
 </View>;
 // Recherche confiée à l'extension : le pied dit où elle en est, et l'on peut passer au point suivant.
 const pied = etape === 'attente' ? <View style={{ gap: 8 }}>
  {toast}
  <EtatExtension etat={extension} attendu="recherches" compact />
  <View style={s.issues}>
   {onPasser && <Pressable accessibilityRole="button" onPress={onPasser} style={({ pressed }) => [s.garderNom, pressed && { opacity: .85 }]}>
    <Text style={s.garderNomTexte}>Passer au suivant</Text>
   </Pressable>}
   <Pressable accessibilityRole="button" accessibilityLabel={`Garder « ${nom} » sans produit. L’extension le cherchera par son nom.`} onPress={() => w.validerManque(lineKey, qty)} style={({ pressed }) => [onPasser ? s.lienPied : s.garderNom, pressed && { opacity: .85 }]}>
    <Text style={onPasser ? s.lienPiedTexte : s.garderNomTexte} numberOfLines={2}>Garder sans produit</Text>
   </Pressable>
  </View>
 </View> : <View style={{ gap: 6 }}>
  {toast}
  <View style={s.issues}>
   {/* Le nom est déjà en tête de l'écran ; ce que fait l'extension sans produit passe dans l'aide VoiceOver. */}
   <Pressable accessibilityRole="button" accessibilityLabel={`Garder « ${nom} » sans produit. L’extension le cherchera par son nom.`} onPress={() => w.validerManque(lineKey, qty)} style={({ pressed }) => [s.garderNom, pressed && { opacity: .85 }]}>
    <Text style={s.garderNomTexte} numberOfLines={1}>Garder sans produit</Text>
   </Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${nom} de ta liste`} onPress={retirer} style={({ pressed }) => [s.retirer, pressed && { opacity: .85 }]}>
    <Feather name="trash-2" size={17} color={colors.danger} /><Text style={s.retirerTexte}>Retirer</Text>
   </Pressable>
  </View>
 </View>;
 return <SelecteurIngredient titre={titre} verbe="Choisir" sansProduit={false} requeteInitiale={nom} proches={produitsProches(nom, products)} entete={entete} pied={pied}
  onFermer={onFermer} onChoisir={c => { if (c.product_id) w.validerManque(lineKey, qty, c.product_id); }}
  basesOuvertes={false}
  apres={<RechercheDrives requete={nom} autres={autres} onPhase={setEtape} onGarde={productId => w.validerManque(lineKey, qty, productId)} />} />;
}

/** Un doublon possible (DB1) : « Garder celui-ci » sous chaque photo ; l'autre est retiré, annulable. */
function GarderUn({ titre, progression, doublon, products, onFermer, onRetrait, toast }: { titre: string; progression: ReactNode; doublon: Doublon; products: Product[]; onFermer: () => void; onRetrait: (texte: string, annuler: () => void) => void; toast?: ReactNode }) {
 const w = useWizard(), insets = useSafeAreaInsets();
 const retirer = (l: LigneMaison) => { const avant = w.ligneQuantites[l.key]; w.modifierLigne(l.key, 0); onRetrait(`${l.name} retiré de ta liste`, () => w.restaurerLigne(l.key, avant)); };
 const { a, b } = doublon;
 const tuile = (garde: LigneMaison, autre: LigneMaison) => {
  const produit = products.find(p => p.id === garde.product_id), origine = [...new Set(garde.sources.map(x => x.label))].join(' · ');
  return <View style={s.tuile}>
   <View style={s.image}><Photo name={garde.name} url={produit?.image_url} style={s.photo} /></View>
   <View style={s.texte}><Text style={ui.productName} numberOfLines={3}>{garde.name}</Text><Text style={[ui.detail, { marginTop: 2 }]} numberOfLines={1}>{[origine, `× ${garde.totalQuantity}`].filter(Boolean).join(' · ')}</Text></View>
   <Pressable accessibilityRole="button" accessibilityLabel={`Garder ${garde.name}, ${garde.totalQuantity} article${garde.totalQuantity > 1 ? 's' : ''}. ${autre.name} sera retiré`} onPress={() => retirer(autre)} style={({ pressed }) => [s.garder, pressed && { opacity: .85 }]}>
    <Text style={s.garderTexte}>Garder celui-ci</Text>
   </Pressable>
  </View>;
 };
 return <SafeAreaView edges={['top']} style={s.ecran}>
  <View style={s.entete}><Text style={s.titre} accessibilityRole="header" numberOfLines={1}>{titre}</Text>
   <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} style={s.fermer}><View style={s.fermerRond}><Feather name="x" size={18} color={colors.text} /></View></Pressable></View>
  {progression}
  <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 14, flex: 1 }}>
   <Text style={s.question}>Le même achat, noté deux fois ?</Text>
   <View style={s.duo}>{tuile(a, b)}<Text style={s.ou}>ou</Text>{tuile(b, a)}</View>
  </View>
  <View style={[s.basDoublon, { paddingBottom: 12 + insets.bottom }]}>
   {toast}
   <Pressable accessibilityRole="button" onPress={() => w.declarerDistinct(a.name, b.name)} style={({ pressed }) => [s.differents, pressed && { opacity: .85 }]}><Text style={s.garderNomTexte}>Ce sont deux achats différents</Text></Pressable>
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
 pas: { flexDirection: 'row', gap: 4, paddingHorizontal: 16 },
 segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
 segmentFait: { backgroundColor: colors.accent },
 heros: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surface },
 inconnu: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.attentionSoft, alignItems: 'center', justifyContent: 'center' },
 nom: { fontSize: 17, fontWeight: '700', color: colors.text },
 qte: { fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
 issues: { flexDirection: 'row', gap: 8 },
 garderNom: { flex: 1, minHeight: 50, borderRadius: 12, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, backgroundColor: colors.surface },
 garderNomTexte: { fontSize: 15, fontWeight: '600', color: colors.accent, textAlign: 'center' },
 retirer: { minHeight: 50, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12 },
 retirerTexte: { fontSize: 15, fontWeight: '600', color: colors.danger },
 lienPied: { minHeight: 50, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
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
