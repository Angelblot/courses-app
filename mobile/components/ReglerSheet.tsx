import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWizard } from '../contexts/WizardContext';
import type { Product } from '../stores/products';
import type { LigneMaison } from '../lib/liste-maison';
import type { Manque } from '../lib/session-courses';
import { ManqueRow } from './Manques';
import { ui, nomDialogue } from './MaisonUI';
import { Feather } from '@expo/vector-icons';
import { colors } from '../lib/theme';

type Doublon = { id: string; a: LigneMaison; b: LigneMaison };

/**
 * « Préciser … » : les manques notés à la main et les doublons
 * possibles, réglés sans quitter le bilan. Le bilan ferme la feuille
 * dès qu'il ne reste plus rien.
 */
export function ReglerSheet({ visible, onFermer, manques, doublons, products, onRetrait, toast }: { visible: boolean; onFermer: () => void; manques: [string, Manque][]; doublons: Doublon[]; products: Product[]; onRetrait: (texte: string, annuler: () => void) => void; toast?: ReactNode }) {
 const insets = useSafeAreaInsets(), { height } = useWindowDimensions(), w = useWizard();
 const nb = manques.length + doublons.length;
 const titreCourant = manques.length === 1 && !doublons.length ? `Préciser « ${manques[0][1].name} »` : `Préciser ${nb} produit${nb > 1 ? 's' : ''}`;
 // Figé tant qu'il reste quelque chose : pendant la fermeture, la feuille
 // afficherait « Préciser 0 produit ».
 const [titre, setTitre] = useState(titreCourant);
 useEffect(() => { if (nb > 0) setTitre(titreCourant); }, [nb, titreCourant]);
 const retirer = (l: LigneMaison) => { const avant = w.ligneQuantites[l.key]; w.modifierLigne(l.key, 0); onRetrait(`${l.name} retiré de ta liste`, () => w.restaurerLigne(l.key, avant)); };
 const lien = (label: string, onPress: () => void) => <Pressable key={label} accessibilityRole="button" onPress={onPress} hitSlop={6} style={s.lien}><Text style={ui.link}>{label}</Text></Pressable>;
 return <Modal {...nomDialogue(titre)} visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.fond}>
   <Pressable style={StyleSheet.absoluteFill} accessible={false} focusable={false} importantForAccessibility="no" onPress={onFermer} />
   <View style={[s.panneau, { paddingBottom: 12 + insets.bottom }]} accessibilityViewIsModal accessibilityLabel={titre} onAccessibilityEscape={onFermer}>
    <View style={s.entete}><Text style={[s.titre, { flex: 1, marginBottom: 0 }]} accessibilityRole="header">{titre}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} hitSlop={6} style={s.fermer}><Feather name="x" size={22} color={colors.text} /></Pressable></View>
    <ScrollView style={{ maxHeight: height * 0.72 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
     {manques.map(([key, m]) => <ManqueRow key={key} lineKey={key} manque={m} products={products} aPreciser onRetrait={onRetrait} />)}
     {doublons.map(d => <View key={d.id} style={s.doublon}>
      <Text style={s.etiquette}>Doublon possible</Text>
      <Text style={ui.productName}>{d.a.name} × {d.a.totalQuantity}</Text>
      <Text style={ui.productName}>{d.b.name} × {d.b.totalQuantity}</Text>
      <View style={s.liens}>{[lien('Garder les deux', () => w.accepterDoublon(d.id)), lien(`Retirer ${d.a.name}`, () => retirer(d.a)), lien(`Retirer ${d.b.name}`, () => retirer(d.b))]}</View>
     </View>)}
    </ScrollView>
    <View>{toast}</View>
   </View>
  </KeyboardAvoidingView>
 </Modal>;
}

const s = StyleSheet.create({
 fond: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,28,16,0.32)' },
 panneau: { backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10 },
 entete: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingLeft: 4 },
 fermer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
 titre: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.4, paddingHorizontal: 4, marginBottom: 12 },
 doublon: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 4, borderWidth: 1.5, borderColor: colors.attention },
 etiquette: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '600', color: colors.attentionText, backgroundColor: colors.attentionSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden', marginBottom: 4 },
 liens: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, marginTop: 4 },
 lien: { minHeight: 44, justifyContent: 'center' },
});
