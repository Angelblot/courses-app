import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { Recipe } from '../stores/recipes';
import { formatIngredientQty } from '../lib/unites';
import { Action, Photo, ui, nomDialogue } from './MaisonUI';
import { colors } from '../lib/theme';
import { photoSecours } from '../lib/photos-maison';

/**
 * Aperçu d'une recette pendant la session : la photo, la durée et les
 * ingrédients pour le nombre de personnes choisi, sans quitter la session.
 */
export function ApercuRecette({ recette, parts, onFermer, onBasculer }: { recette: Recipe | null; parts?: number; onFermer: () => void; onBasculer: () => void }) {
 const insets = useSafeAreaInsets(), { height } = useWindowDimensions();
 if (!recette) return null;
 const personnes = parts ?? recette.servings_default ?? 2, temps = (recette.prep_minutes ?? 0) + (recette.cook_minutes ?? 0), choisie = parts != null;
 return <Modal {...nomDialogue(recette.name)} visible transparent animationType="slide" onRequestClose={onFermer}>
  <View style={a.fond}>
   <Pressable style={StyleSheet.absoluteFill} accessible={false} focusable={false} importantForAccessibility="no" onPress={onFermer} />
   <View style={[a.panneau, { paddingBottom: 12 + insets.bottom, maxHeight: height * 0.88 }]} accessibilityViewIsModal accessibilityLabel={recette.name} onAccessibilityEscape={onFermer}>
    <Photo recipe name={recette.name} url={recette.image_url} style={a.photo} />
    <ScrollView contentContainerStyle={{ gap: 8, padding: 16, paddingBottom: 4 }}>
     <Text accessibilityRole="header" style={a.titre}>{recette.name}</Text>
     <View style={ui.row}>{temps > 0 && <><Feather name="clock" size={14} color={colors.textMuted} /><Text style={[ui.detail, { marginTop: 0 }]}>{temps} min ·</Text></>}<Text style={[ui.detail, { marginTop: 0 }]}>{personnes} personne{personnes > 1 ? 's' : ''}</Text></View>
     {recette.ingredients.map(i => <View key={i.id} style={[ui.row, { minHeight: 36 }]}>{photoSecours(i.name) ? <Photo name={i.name} style={a.ingredient} /> : <View style={a.ingredient} />}<Text style={[ui.productName, { flex: 1, fontWeight: '400' }]}>{i.name}</Text><Text style={[ui.detail, { marginTop: 0 }]}>{formatIngredientQty(i.quantity_per_serving * personnes, i.unit)}</Text></View>)}
     {!recette.ingredients.length && <Text style={ui.detail}>Aucun ingrédient enregistré pour cette recette.</Text>}
    </ScrollView>
    <View style={[ui.row, { gap: 10, paddingHorizontal: 16, paddingTop: 8 }]}>
     <View style={{ flex: 1 }}><Action secondary onPress={onFermer}>Fermer</Action></View>
     <View style={{ flex: 1.4 }}><Action onPress={() => { onBasculer(); onFermer(); }}>{choisie ? 'Retirer de mes repas' : 'Choisir ce repas'}</Action></View>
    </View>
   </View>
  </View>
 </Modal>;
}

const a = StyleSheet.create({
 fond: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,28,16,0.32)' },
 panneau: { backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
 photo: { width: '100%', height: 190, borderRadius: 0 },
 titre: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
 ingredient: { width: 32, height: 32, borderRadius: 6 },
});
