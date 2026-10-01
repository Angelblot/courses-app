import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { libelleRayon, type CleRayon } from '../lib/rayons.ts';
import { colors, radius, spacing } from '../lib/theme';

/** La ligne « Rayon » d'une fiche, commune au menu natif iOS et au repli. */
export function LigneRayon({ valeur, style }: { valeur: CleRayon; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.ligne, style]} accessible accessibilityRole="button" accessibilityLabel={`Rayon : ${libelleRayon(valeur)}`} accessibilityHint="Ouvre la liste des rayons">
      <Text style={s.libelle}>Rayon</Text>
      <View style={s.valeur}>
        <Text style={s.valeurTexte} numberOfLines={2}>{libelleRayon(valeur)}</Text>
        <Feather name="chevron-down" size={17} color={colors.accent} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ligne: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg,
    minHeight: 52, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.card,
  },
  libelle: { fontSize: 15, color: colors.textMuted },
  valeur: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  valeurTexte: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.accent, textAlign: 'right' },
});
