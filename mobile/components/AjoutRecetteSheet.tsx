import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../lib/theme';

type Option = {
  icone: keyof typeof Feather.glyphMap;
  titre: string;
  detail: string;
  aller: () => void;
};

const OPTIONS: Option[] = [
  {
    icone: 'camera',
    titre: 'Photographier une fiche',
    detail: 'HelloFresh, livre, carnet',
    aller: () => router.push({ pathname: '/recettes/importer', params: { source: 'photo' } }),
  },
  {
    icone: 'link',
    titre: 'Coller un lien',
    detail: 'Marmiton, Jow, un blog',
    aller: () => router.push({ pathname: '/recettes/importer', params: { source: 'lien' } }),
  },
  {
    icone: 'edit-3',
    titre: 'Écrire à la main',
    detail: 'Nom, ingrédients, quantités',
    aller: () => router.push('/recettes/nouvelle'),
  },
];

/**
 * Panneau « Ajouter une recette », ouvert par le + de l'onglet Recettes.
 * Trois chemins, un tap chacun ; le fond et le glissement vers le bas ferment.
 */
export function AjoutRecetteSheet({ visible, onFermer }: { visible: boolean; onFermer: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
      <View style={s.fond}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} />
        <View style={[s.panneau, { paddingBottom: 12 + insets.bottom }]} accessibilityViewIsModal>
          <View style={s.poignee} />
          <Text style={s.titre} accessibilityRole="header">Ajouter une recette</Text>
          {OPTIONS.map((o) => (
            <Pressable
              key={o.titre}
              accessibilityRole="button"
              accessibilityLabel={o.titre}
              accessibilityHint={o.detail}
              style={({ pressed }) => [s.option, pressed && s.optionPressee]}
              onPress={() => { onFermer(); o.aller(); }}
            >
              <View style={s.icone}><Feather name={o.icone} size={20} color={colors.accent} /></View>
              <View style={s.texte}>
                <Text style={s.optionTitre}>{o.titre}</Text>
                <Text style={s.optionDetail}>{o.detail}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fond: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,28,16,0.32)' },
  panneau: {
    backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 16, paddingTop: 8,
  },
  poignee: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 14 },
  titre: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.4, paddingHorizontal: 4, marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingHorizontal: 4, borderRadius: 14 },
  optionPressee: { backgroundColor: colors.bg },
  icone: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, gap: 2 },
  optionTitre: { fontSize: 17, fontWeight: '600', color: colors.text },
  optionDetail: { fontSize: 14, color: colors.textMuted },
});
