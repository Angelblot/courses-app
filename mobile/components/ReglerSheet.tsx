import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWizard } from '../contexts/WizardContext';
import type { Product } from '../stores/products';
import type { LigneMaison } from '../lib/liste-maison';
import type { Manque } from '../lib/session-courses';
import { ManqueRow } from './Manques';
import { ui } from './MaisonUI';
import { colors } from '../lib/theme';

type Doublon = { id: string; a: LigneMaison; b: LigneMaison };

/**
 * « À régler avant le drive » : les manques à préciser et les doublons
 * possibles, réglés sans quitter le bilan. Le bilan ferme la feuille
 * dès qu'il ne reste plus rien.
 */
export function ReglerSheet({ visible, onFermer, manques, doublons, products }: { visible: boolean; onFermer: () => void; manques: [string, Manque][]; doublons: Doublon[]; products: Product[] }) {
 const insets = useSafeAreaInsets(), { height } = useWindowDimensions(), w = useWizard();
 const lien = (label: string, onPress: () => void) => <Pressable key={label} accessibilityRole="button" onPress={onPress} hitSlop={6} style={s.lien}><Text style={ui.link}>{label}</Text></Pressable>;
 return <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.fond}>
   <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} />
   <View style={[s.panneau, { paddingBottom: 12 + insets.bottom }]} accessibilityViewIsModal>
    <View style={s.poignee} />
    <Text style={s.titre} accessibilityRole="header">À régler avant le drive</Text>
    <ScrollView style={{ maxHeight: height * 0.72 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
     {manques.map(([key, m]) => <ManqueRow key={key} lineKey={key} manque={m} products={products} aPreciser />)}
     {doublons.map(d => <View key={d.id} style={s.doublon}>
      <Text style={s.etiquette}>Doublon possible</Text>
      <Text style={ui.productName}>{d.a.name} × {d.a.totalQuantity}</Text>
      <Text style={ui.productName}>{d.b.name} × {d.b.totalQuantity}</Text>
      <View style={s.liens}>{[lien('Garder les deux', () => w.accepterDoublon(d.id)), lien(`Retirer ${d.a.name}`, () => w.modifierLigne(d.a.key, 0)), lien(`Retirer ${d.b.name}`, () => w.modifierLigne(d.b.key, 0))]}</View>
     </View>)}
    </ScrollView>
   </View>
  </KeyboardAvoidingView>
 </Modal>;
}

const s = StyleSheet.create({
 fond: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,28,16,0.32)' },
 panneau: { backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 8 },
 poignee: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 14 },
 titre: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.4, paddingHorizontal: 4, marginBottom: 12 },
 doublon: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 4, borderWidth: 1.5, borderColor: colors.attention },
 etiquette: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '600', color: colors.attentionText, backgroundColor: colors.attentionSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden', marginBottom: 4 },
 liens: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, marginTop: 4 },
 lien: { minHeight: 44, justifyContent: 'center' },
});
