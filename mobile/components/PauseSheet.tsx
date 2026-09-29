import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useWizard } from '../contexts/WizardContext';
import { SESSION_STEPS } from '../lib/session-courses';
import { Action, ui } from './MaisonUI';
import { colors } from '../lib/theme';

/**
 * Ouverte par la pause de l'en-tête : finir plus tard (tout est gardé) ou
 * abandonner ces courses. L'abandon garde les manques notés et s'annule
 * quelques secondes depuis l'accueil.
 */
export function PauseSheet({ visible, onFermer }: { visible: boolean; onFermer: () => void }) {
 const insets = useSafeAreaInsets(), w = useWizard();
 const etape = SESSION_STEPS.find(e => e.cle === w.sessionEtape)?.label;
 const quitter = () => { onFermer(); if (router.canDismiss()) router.dismissAll(); router.replace('/'); };
 return <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
  <View style={s.fond}>
   <Pressable style={StyleSheet.absoluteFill} accessible={false} focusable={false} importantForAccessibility="no" onPress={onFermer} />
   <View style={[s.panneau, { paddingBottom: 12 + insets.bottom }]} accessibilityViewIsModal accessibilityLabel="Faire une pause ?" onAccessibilityEscape={onFermer}>
    <View style={s.entete}><Text style={s.titre} accessibilityRole="header">Faire une pause ?</Text><Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} hitSlop={6} style={s.fermer}><Feather name="x" size={22} color={colors.text} /></Pressable></View>
    <Text style={[ui.subtitle, { paddingHorizontal: 4 }]}>Tes choix sont gardés : tu reprendras à l’étape {etape ? `« ${etape} »` : 'où tu en es'}.</Text>
    <Action onPress={quitter}>Finir plus tard</Action>
    <Pressable accessibilityRole="button" onPress={() => { w.abandonnerSession(); quitter(); }} style={s.abandon}><Text style={s.abandonTexte}>Abandonner ces courses</Text></Pressable>
   </View>
  </View>
 </Modal>;
}

const s = StyleSheet.create({
 fond: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,28,16,0.32)' },
 panneau: { backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, gap: 12 },
 entete: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
 titre: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
 fermer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
 abandon: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
 abandonTexte: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});
