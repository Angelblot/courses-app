import { useEffect, useRef, useState } from 'react';
import { Feuille } from './Feuille';
import { AccessibilityInfo, ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, findNodeHandle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useMaison } from '../contexts/useMaison';
import { construireItems, separerAilleurs } from '../lib/consolidation';
import { envoiExiste, envoyerListe } from '../lib/cart-jobs';
import { nouvelIdEnvoi } from '../lib/id-envoi';
import { Action, Raison, ui, nomDialogue } from './MaisonUI';
import { colors } from '../lib/theme';

const DRIVES = [{ cle: 'carrefour', nom: 'Carrefour', site: 'carrefour.fr' }, { cle: 'leclerc', nom: 'E.Leclerc', site: 'leclercdrive.fr' }];

/**
 * Dernier geste de la session, ouvert par « Envoyer au drive » au bilan :
 * on coche un ou deux drives et on envoie la liste à l'ordinateur, qui
 * remplit le panier. Le bilan a déjà vérifié que la liste est prête.
 */
export function EnvoiSheet({ visible, onFermer }: { visible: boolean; onFermer: () => void }) {
 const insets = useSafeAreaInsets(), { w, acheter: tout, p } = useMaison();
 // Ce qui s'achète ailleurs (marché, primeur…) ne part jamais au drive.
 const { drive: acheter, ailleurs } = separerAilleurs(tout, p.produits);
 const [horsDrive, setHorsDrive] = useState(ailleurs.length);
 useEffect(() => { if (visible) setHorsDrive(ailleurs.length); }, [visible]);
 // Le nombre affiché est figé à l'ouverture : l'envoi vide la liste pendant que
 // la feuille se referme, et elle afficherait « 0 produit ».
 const [total, setTotal] = useState(acheter.length);
 useEffect(() => { if (visible) setTotal(acheter.length); }, [visible]);
 const [envoi, setEnvoi] = useState(false), [erreur, setErreur] = useState<string | null>(null), [aide, setAide] = useState(false), verrou = useRef(false);
 useEffect(() => { if (visible) setErreur(null); }, [visible]);
 // Après un échec, le focus va au message, dans la feuille : sinon il
 // retombe hors de la feuille quand le bouton redevient actif.
 const refErreur = useRef<View>(null);
 useEffect(() => {
  if (!erreur || !refErreur.current) return;
  if (Platform.OS === 'web') (refErreur.current as unknown as { focus?: () => void }).focus?.();
  else { const n = findNodeHandle(refErreur.current); if (n) AccessibilityInfo.setAccessibilityFocus(n); AccessibilityInfo.announceForAccessibility(erreur); }
 }, [erreur]);
 // Pendant l'envoi, la feuille reste ouverte : on saura s'il est parti.
 const fermer = () => { if (!verrou.current) onFermer(); };
 async function envoyer() {
  if (verrou.current || !w.drives.length || !acheter.length) return;
  verrou.current = true; setEnvoi(true); setErreur(null);
  // Tant qu'on ignore si un envoi est parti, tout nouvel essai reprend son
  // identifiant, même après fermeture de la feuille ou de l'app.
  const idEnvoi = w.envoiEnDoute ?? nouvelIdEnvoi();
  w.retenirEnvoi(idEnvoi);
  const n = acheter.length, drives = w.drives.join(',');
  const aboutir = (id: string) => {
   const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
   onFermer(); w.reinitialiser();
   // Les produits achetés ailleurs restent dans la liste, pour la suite des courses.
   for (const l of ailleurs) if (l.product_id) w.ajouterProduitListe(l.product_id, /^unit|^pi/i.test(l.unit ?? '') ? l.totalQuantity : 1, false);
   // Les onglets d'abord, puis le suivi par-dessus : son retour ramène aux courses.
   router.dismissTo('/');
   router.push({ pathname: '/suivi/envoye', params: { id, n: String(n), drives, heure } });
  };
  // La liste est partie ou non, on le sait par son identifiant ; dans le
  // doute, on ne vide rien et le même identifiant sert au nouvel essai.
  const echec = async () => {
   const existe = await envoiExiste(idEnvoi).catch(() => null);
   if (existe) aboutir(idEnvoi);
   else if (existe === false) { w.retenirEnvoi(undefined); setErreur('L’envoi n’a pas abouti, rien n’est parti. Réessaie.'); }
   else setErreur('Pas de réseau pour le moment. Réessaie : la liste ne partira pas deux fois.');
  };
  try {
   const res = await envoyerListe(construireItems(acheter, p.produits), w.drives, idEnvoi);
   if (res.ok && res.id) aboutir(res.id); else await echec();
  } catch { await echec(); }
  finally { verrou.current = false; setEnvoi(false); }
 }
 return <Feuille visible={visible} onFermer={fermer} nom="Où fait-on les courses ?">
   <View style={[s.panneau, { paddingBottom: 12 + insets.bottom }]} accessibilityViewIsModal accessibilityLabel="Où fait-on les courses ?" onAccessibilityEscape={fermer}>
    <View style={s.entete}><Text style={[s.titre, { flex: 1, marginBottom: 0 }]} accessibilityRole="header">Où fait-on les courses ?</Text><Pressable accessibilityRole="button" accessibilityLabel="Fermer" accessibilityState={{ disabled: envoi }} disabled={envoi} onPress={fermer} hitSlop={6} style={[s.fermer, envoi && { opacity: .4 }]}><Feather name="x" size={22} color={colors.text} /></Pressable></View>
    <Text style={[ui.detail, { marginTop: 0, marginBottom: 12, paddingHorizontal: 4 }]}>{total} produit{total > 1 ? 's' : ''} à envoyer, dans un drive ou les deux.</Text>
    {horsDrive > 0 && <View style={s.hors}><Feather name="map-pin" size={16} color={colors.textMuted} /><Text style={[ui.detail, { flex: 1, marginTop: 0 }]}>{horsDrive} produit{horsDrive > 1 ? 's' : ''} à acheter ailleurs ne part{horsDrive > 1 ? 'ent' : ''} pas au drive : {horsDrive > 1 ? 'ils restent' : 'il reste'} dans la liste.</Text></View>}
    <View style={{ gap: 10 }}>
     {DRIVES.map(d => { const coche = w.drives.includes(d.cle); return <Pressable key={d.cle} accessibilityRole="checkbox" accessibilityState={{ checked: coche, disabled: envoi }} aria-checked={coche} accessibilityLabel={d.nom} disabled={envoi} onPress={() => w.basculerDrive(d.cle)} style={({ pressed }) => [s.drive, coche && s.driveCoche, pressed && { opacity: .85 }]}>
      <View style={s.icone}><Feather name="shopping-bag" size={18} color={colors.accent} /></View>
      <View style={{ flex: 1 }}><Text style={ui.productName}>{d.nom}</Text><Text style={[ui.detail, { marginTop: 1 }]}>{d.site}</Text></View>
      <View style={[s.case, coche && s.caseCochee]}>{coche && <Feather name="check" size={16} color={colors.accentContrast} />}</View>
     </Pressable>; })}
     <Pressable accessibilityRole="button" accessibilityState={{ expanded: aide }} accessibilityLabel="Comment ? Voir comment l’extension remplit le panier" onPress={() => setAide(!aide)} style={s.info}>
      <Feather name="monitor" size={18} color={colors.textMuted} />
      <Text style={[ui.detail, { flex: 1, marginTop: 0 }]}>Le panier se remplit sur ton ordinateur, avec l’extension Chrome.</Text>
      <Text style={ui.link}>{aide ? 'Masquer' : 'Comment ?'}</Text>
     </Pressable>
     {aide && <Text style={[ui.detail, { marginTop: 0, paddingHorizontal: 4 }]}>Ouvre Chrome et connecte l’extension Courses au même compte que sur ton iPhone. Après l’envoi, l’extension remplit le panier d’elle-même. Tu vérifies puis paies sur le site du drive.</Text>}
     {!!erreur && <View ref={refErreur} tabIndex={-1} accessible accessibilityLabel={erreur}><Text accessibilityLiveRegion="polite" style={ui.error}>{erreur}</Text></View>}
     {envoi && <ActivityIndicator color={colors.accent} accessibilityLabel="Envoi en cours" />}
     <Action disabled={envoi || !w.drives.length || !total} onPress={envoyer}>{envoi ? 'Envoi en cours…' : 'Envoyer'}</Action>
     {!total ? <Raison>Tout s’achète ailleurs : rien à envoyer au drive.</Raison> : !w.drives.length && <Raison>Coche au moins un drive.</Raison>}
    </View>
   </View>
 </Feuille>;
}

const s = StyleSheet.create({
 fond: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,28,16,0.32)' },
 panneau: { backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10 },
 entete: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2, paddingLeft: 4 },
 fermer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
 titre: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.4, paddingHorizontal: 4, marginBottom: 4 },
 drive: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, padding: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.traitControle },
 driveCoche: { borderWidth: 2, borderColor: colors.accent },
 icone: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
 case: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.traitControle, alignItems: 'center', justifyContent: 'center' },
 caseCochee: { backgroundColor: colors.accent, borderColor: colors.accent },
 hors: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -4, marginBottom: 12, paddingHorizontal: 4 },
 info: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.surface },
});
