import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../lib/theme';

export function EtatVide({ titre, children }: { titre: string; children?: string }) {
  return (
    <View style={s.bloc}>
      <Text style={s.titre}>{titre}</Text>
      {children && <Text style={s.corps}>{children}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { padding: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  titre: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  corps: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
