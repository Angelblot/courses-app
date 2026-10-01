import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { RAYONS, type CleRayon } from '../lib/rayons.ts';
import { colors, radius, spacing } from '../lib/theme';

type Props = {
  valeur: CleRayon;
  onChoisir: (cle: CleRayon) => void;
  onFermer: () => void;
};

/**
 * Choix du rayon hors iOS (sur iOS, `ChoixRayon` ouvre le menu natif) :
 * une liste groupée, le rayon actuel coché, posée dans la fiche plutôt
 * qu'en modal centré — convention du projet pour toute action mobile.
 */
export function SelecteurRayon({ valeur, onChoisir, onFermer }: Props) {
  return (
    <View style={s.bloc}>
      <View style={s.entete}>
        <Text style={s.titre} accessibilityRole="header">Rayon</Text>
        <Pressable accessibilityRole="button" onPress={onFermer} hitSlop={8} style={s.fermer}>
          <Text style={s.fermerTexte}>OK</Text>
        </Pressable>
      </View>
      <View style={s.groupe}>
        {RAYONS.map((r, i) => {
          const actif = r.cle === valeur;
          return (
            <Pressable key={r.cle} accessibilityRole="radio" accessibilityState={{ checked: actif }}
              onPress={() => onChoisir(r.cle)}
              style={({ pressed }) => [s.ligne, i > 0 && s.separe, pressed && { backgroundColor: colors.off }]}>
              <Text style={[s.ligneTexte, actif && s.ligneTexteActif]}>{r.label}</Text>
              {actif && <Feather name="check" size={18} color={colors.accent} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { alignSelf: 'stretch', gap: spacing.xs },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: spacing.xs },
  titre: { fontSize: 13, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: .4 },
  fermer: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  fermerTexte: { fontSize: 15, fontWeight: '600', color: colors.accent },
  groupe: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, minHeight: 48, paddingHorizontal: spacing.lg },
  separe: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  ligneTexte: { fontSize: 16, color: colors.text },
  ligneTexteActif: { fontWeight: '600', color: colors.accent },
});
