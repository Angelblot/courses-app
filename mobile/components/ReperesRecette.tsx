import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatDuree } from '../lib/recettes-affichage';
import { colors } from '../lib/theme';

type Repere = { icone: ComponentProps<typeof Feather>['name']; valeur: string; libelle: string };

/**
 * Préparation, cuisson et calories d'une recette, en pastilles (variante T1) :
 * icône, valeur en gras, libellé dessous. Seules les données connues
 * s'affichent ; zéro minute de cuisson se lit « Sans cuisson ».
 */
export function ReperesRecette({ prep, cuisson, kcal }: { prep: number | null | undefined; cuisson: number | null | undefined; kcal: number | null | undefined }) {
  const reperes: Repere[] = [];
  if (prep != null) reperes.push({ icone: 'clock', valeur: formatDuree(prep) ?? '0 min', libelle: 'Préparation' });
  if (cuisson != null) reperes.push(cuisson > 0
    ? { icone: 'thermometer', valeur: formatDuree(cuisson) ?? '', libelle: 'Cuisson' }
    : { icone: 'thermometer', valeur: 'Sans', libelle: 'cuisson' });
  if (kcal) reperes.push({ icone: 'zap', valeur: String(kcal), libelle: 'kcal / pers.' });
  if (!reperes.length) return null;
  return <View style={s.rangee}>
    {reperes.map(r => <View key={r.libelle} style={s.pastille} accessible accessibilityLabel={`${r.libelle === 'cuisson' ? 'Sans cuisson' : `${r.libelle} : ${r.valeur}`}`}>
      <Feather name={r.icone} size={17} color={colors.accent} />
      <Text style={s.valeur}>{r.valeur}</Text>
      <Text style={s.libelle}>{r.libelle}</Text>
    </View>)}
  </View>;
}

const s = StyleSheet.create({
  rangee: { flexDirection: 'row', gap: 8 },
  pastille: { flex: 1, backgroundColor: colors.accentSoft, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', gap: 2 },
  valeur: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 2, fontVariant: ['tabular-nums'] },
  libelle: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
