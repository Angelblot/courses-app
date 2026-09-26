import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RAYONS, type CleRayon } from '../lib/rayons.ts';
import { colors, radius, spacing } from '../lib/theme';

type Props = {
  valeur: CleRayon;
  onChoisir: (cle: CleRayon) => void;
  onFermer: () => void;
};

/**
 * Choix du rayon, en liste posée dans la fiche plutôt qu'en modal centré —
 * convention du projet pour toute action mobile.
 */
export function SelecteurRayon({ valeur, onChoisir, onFermer }: Props) {
  return (
    <View style={s.bloc}>
      <View style={s.entete}>
        <Text style={s.titre}>Rayon</Text>
        <Pressable onPress={onFermer} hitSlop={8}>
          <Text style={s.fermer}>Fermer</Text>
        </Pressable>
      </View>
      <ScrollView style={s.liste} keyboardShouldPersistTaps="handled">
        {RAYONS.map((r) => {
          const actif = r.cle === valeur;
          return (
            <Pressable
              key={r.cle}
              style={[s.ligne, actif && s.ligneActive]}
              onPress={() => onChoisir(r.cle)}
            >
              <Text style={[s.ligneTexte, actif && s.ligneTexteActif]}>{r.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { gap: spacing.sm },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titre: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  fermer: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  // Hauteur bornée : les 10 rayons ne doivent pas repousser les boutons
  // d'action hors de l'écran sur un petit iPhone.
  liste: { maxHeight: 220 },
  ligne: {
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  ligneActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  ligneTexte: { fontSize: 15, color: colors.text },
  ligneTexteActif: { fontWeight: '700', color: colors.accent },
});
