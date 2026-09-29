import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useExtensionConnue } from '../stores/extension';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useMaison } from '../contexts/useMaison';
import { construireItems } from '../lib/consolidation';
import { envoyerListe } from '../lib/cart-jobs';
import { Action, Raison, ui } from './MaisonUI';
import { colors } from '../lib/theme';

// L'extension s'installe en mode développeur, depuis le dépôt : il n'y a pas
// de lien public. On partage donc les consignes, vers le Mac ou par mail.
const CONSIGNES = "Installer l'extension Courses dans Chrome :\n1. Ouvre chrome://extensions\n2. Active le « Mode développeur » (en haut à droite)\n3. « Charger l'extension non empaquetée », puis choisis le dossier extension/ du projet courses-app\n4. Dans l'extension, connecte-toi au même compte que sur ton iPhone.";

const DRIVES = [{ cle: 'carrefour', nom: 'Carrefour', site: 'carrefour.fr' }, { cle: 'leclerc', nom: 'E.Leclerc', site: 'leclercdrive.fr' }];

/**
 * Dernier geste de la session, ouvert par « Choisir mon drive » au bilan :
 * on coche un ou deux drives et on envoie la liste à l'ordinateur, qui
 * remplit le panier. Le bilan a déjà vérifié que la liste est prête.
 */
export function EnvoiSheet({ visible, onFermer }: { visible: boolean; onFermer: () => void }) {
 const insets = useSafeAreaInsets(), { w, acheter } = useMaison();
 const [envoi, setEnvoi] = useState(false), [erreur, setErreur] = useState<string | null>(null), [aide, setAide] = useState(false), [installee, setInstallee] = useState(false), verrou = useRef(false);
 // Premier envoi : tant que l'extension n'a jamais relevé de liste, on fait
 // d'abord confirmer qu'elle est installée.
 const premiere = useExtensionConnue(visible) === false, bloque = premiere && !installee;
 async function envoyer() {
  if (verrou.current || !w.drives.length || !acheter.length || bloque) return;
  verrou.current = true; setEnvoi(true); setErreur(null);
  try {
   const n = acheter.length, drives = w.drives.join(',');
   const res = await envoyerListe(construireItems(acheter), w.drives);
   if (res.ok && res.id) {
    onFermer(); w.reinitialiser();
    if (router.canDismiss()) router.dismissAll();
    router.replace({ pathname: '/suivi/envoye', params: { id: res.id, n: String(n), drives } });
   } else setErreur(res.erreur ?? 'L’envoi n’a pas abouti. Réessaie.');
  } catch { setErreur('Connexion interrompue. Vérifie le suivi avant de réessayer.'); }
  finally { verrou.current = false; setEnvoi(false); }
 }
 return <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
  <View style={s.fond}>
   <Pressable style={StyleSheet.absoluteFill} accessible={false} focusable={false} importantForAccessibility="no" onPress={onFermer} />
   <View style={[s.panneau, { paddingBottom: 12 + insets.bottom }]} accessibilityViewIsModal accessibilityLabel="Où fait-on les courses ?" onAccessibilityEscape={onFermer}>
    <View style={s.entete}><Text style={[s.titre, { flex: 1, marginBottom: 0 }]} accessibilityRole="header">Où fait-on les courses ?</Text><Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} hitSlop={6} style={s.fermer}><Feather name="x" size={22} color={colors.text} /></Pressable></View>
    <Text style={[ui.detail, { marginTop: 0, marginBottom: 12, paddingHorizontal: 4 }]}>{acheter.length} article{acheter.length > 1 ? 's' : ''} à envoyer, dans un drive ou les deux.</Text>
    <View style={{ gap: 10 }}>
     {DRIVES.map(d => { const coche = w.drives.includes(d.cle); return <Pressable key={d.cle} accessibilityRole="checkbox" accessibilityState={{ checked: coche, disabled: envoi }} aria-checked={coche} accessibilityLabel={d.nom} disabled={envoi} onPress={() => w.basculerDrive(d.cle)} style={({ pressed }) => [s.drive, coche && s.driveCoche, pressed && { opacity: .85 }]}>
      <View style={s.icone}><Feather name="shopping-bag" size={18} color={colors.accent} /></View>
      <View style={{ flex: 1 }}><Text style={ui.productName}>{d.nom}</Text><Text style={[ui.detail, { marginTop: 1 }]}>{d.site}</Text></View>
      <View style={[s.case, coche && s.caseCochee]}>{coche && <Feather name="check" size={16} color={colors.accentContrast} />}</View>
     </Pressable>; })}
     {premiere ? <View style={s.premiere}>
      <Text style={ui.productName}>Avant le premier envoi</Text>
      {['Installe l’extension Courses dans Chrome, sur ton ordinateur.', 'Connecte-la au même compte que sur ton iPhone.'].map((t, i) => <View key={t} style={[ui.row, { alignItems: 'flex-start' }]}><Text style={s.num}>{i + 1}.</Text><Text style={[ui.detail, { marginTop: 0, flex: 1, color: colors.text }]}>{t}</Text></View>)}
      <Action secondary onPress={() => { void Share.share({ message: CONSIGNES }); }}>Envoyer les instructions d’installation</Action>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: installee }} aria-checked={installee} accessibilityLabel="C’est fait, l’extension est installée" onPress={() => setInstallee(!installee)} style={[ui.row, { minHeight: 44 }]}>
       <View style={[s.case, installee && s.caseCochee]}>{installee && <Feather name="check" size={16} color={colors.accentContrast} />}</View>
       <Text style={[ui.productName, { fontWeight: '400', flex: 1 }]}>C’est fait, l’extension est installée</Text>
      </Pressable>
     </View> : <>
     <Pressable accessibilityRole="button" accessibilityState={{ expanded: aide }} accessibilityLabel="Comment ça marche ?" onPress={() => setAide(!aide)} style={s.info}>
      <Feather name="monitor" size={18} color={colors.textMuted} />
      <Text style={[ui.detail, { flex: 1, marginTop: 0 }]}>Le panier se remplit sur ton ordinateur, avec l’extension Chrome.</Text>
      <Text style={ui.link}>{aide ? 'Masquer' : 'Comment ?'}</Text>
     </Pressable>
     {aide && <Text style={[ui.detail, { marginTop: 0, paddingHorizontal: 4 }]}>Ouvre Chrome et connecte l’extension Courses au même compte que sur ton iPhone. Après l’envoi, clique sur « Remplir le panier » dans l’extension. Tu vérifies puis paies sur le site du drive.</Text>}
     </>}
     {!!erreur && <Text accessibilityLiveRegion="polite" style={ui.error}>{erreur}</Text>}
     {envoi && <ActivityIndicator color={colors.accent} />}
     <Action disabled={envoi || !w.drives.length || bloque} onPress={envoyer}>{envoi ? 'Envoi en cours…' : 'Envoyer à mon ordinateur'}</Action>
     {!w.drives.length ? <Raison>Coche au moins un drive.</Raison> : bloque && <Raison>Coche « C’est fait » une fois l’extension installée.</Raison>}
    </View>
   </View>
  </View>
 </Modal>;
}

const s = StyleSheet.create({
 fond: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,28,16,0.32)' },
 panneau: { backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10 },
 entete: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2, paddingLeft: 4 },
 fermer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
 titre: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.4, paddingHorizontal: 4, marginBottom: 4 },
 drive: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, padding: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
 driveCoche: { borderWidth: 2, borderColor: colors.accent },
 icone: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
 case: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.traitControle, alignItems: 'center', justifyContent: 'center' },
 caseCochee: { backgroundColor: colors.accent, borderColor: colors.accent },
 premiere: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 8 },
 num: { width: 18, color: colors.textMuted, fontVariant: ['tabular-nums'] },
 info: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.surface },
});
