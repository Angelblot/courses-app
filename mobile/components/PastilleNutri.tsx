import { StyleSheet, Text, View } from 'react-native';
import type { NoteNutri } from '../lib/openfoodfacts.ts';
import { colors, radius } from '../lib/theme';

const TEINTES: Record<NoteNutri, string> = {
  a: colors.nutriA,
  b: colors.nutriB,
  c: colors.nutriC,
  d: colors.nutriD,
  e: colors.nutriE,
};

type Props = { note: string | null | undefined };

/**
 * Pastille Nutriscore. Rend `null` quand le produit n'est pas noté — beaucoup
 * ne le sont pas, et une pastille grise « inconnu » encombrerait la liste sans
 * rien apprendre.
 */
export function PastilleNutri({ note }: Props) {
  const n = (note ?? '').toLowerCase();
  const teinte = TEINTES[n as NoteNutri];
  if (!teinte) return null;
  return (
    <View style={[s.pastille, { backgroundColor: teinte }]}>
      <Text style={s.lettre}>{n.toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pastille: {
    width: 22, height: 22, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  lettre: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
