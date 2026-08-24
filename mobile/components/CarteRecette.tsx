import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Recipe } from '../stores/recipes';
import { initiale, indiceAplat } from '../lib/recettes-affichage.ts';
import { colors, ombre, radius, spacing } from '../lib/theme';

/** Diamètre de la photo ronde, et de combien elle déborde de la carte. */
const PHOTO = 96;
const DEBORDEMENT = 40;

/**
 * Carte de recette : photo ronde débordant par le haut, nom, puis pastilles.
 *
 * La photo qui déborde est la signature visuelle de Jow : elle donne au plat
 * l'air d'être posé sur la carte plutôt qu'enfermé dedans.
 *
 * Sans photo, un aplat coloré portant l'initiale. Jamais une image générique
 * récupérée ailleurs : une fausse photo dit quelque chose de faux.
 */
export function CarteRecette({ recette, onOuvrir }: { recette: Recipe; onOuvrir: () => void }) {
  const n = recette.ingredients.length;
  return (
    <Pressable style={s.enveloppe} onPress={onOuvrir}>
      <View style={s.carte}>
        <Text style={s.nom} numberOfLines={2}>{recette.name}</Text>
        <View style={s.pastilles}>
          <View style={s.pastille}>
            <Feather name="users" size={12} color={colors.textMuted} />
            <Text style={s.pastilleTexte}>{recette.servings_default}</Text>
          </View>
          <View style={s.pastille}>
            <Feather name="list" size={12} color={colors.textMuted} />
            <Text style={s.pastilleTexte}>{n}</Text>
          </View>
        </View>
      </View>

      {recette.image_url ? (
        <Image source={{ uri: recette.image_url }} style={s.photo} resizeMode="cover" />
      ) : (
        <View style={[s.photo, s.aplat, { backgroundColor: colors.aplats[indiceAplat(recette.name)] }]}>
          <Text style={s.initiale}>{initiale(recette.name)}</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  // La photo est rendue APRÈS la carte pour passer devant : React Native
  // n'honore pas `zIndex` de façon fiable entre frères sur Android.
  enveloppe: { flex: 1, paddingTop: DEBORDEMENT, alignItems: 'center' },
  carte: {
    // `flex: 1` égalise la hauteur des deux cartes d'une même rangée : sans
    // lui, un nom sur une ligne donnait une carte plus courte que sa voisine.
    flex: 1,
    width: '100%', backgroundColor: colors.surface, borderRadius: radius.lg,
    ...ombre,
    paddingTop: PHOTO - DEBORDEMENT + spacing.md,
    paddingHorizontal: spacing.md, paddingBottom: spacing.lg,
    alignItems: 'center', gap: spacing.sm,
  },
  photo: {
    position: 'absolute', top: 0,
    width: PHOTO, height: PHOTO, borderRadius: PHOTO / 2,
    backgroundColor: colors.bg,
  },
  aplat: { alignItems: 'center', justifyContent: 'center' },
  initiale: { fontSize: 34, fontWeight: '800', color: '#FFFFFF' },
  nom: {
    fontSize: 15, fontWeight: '700', color: colors.text,
    textAlign: 'center', lineHeight: 20,
  },
  // Poussées en bas : les pastilles s'alignent d'une carte à l'autre même
  // quand les noms n'ont pas le même nombre de lignes.
  pastilles: { flexDirection: 'row', gap: spacing.xs, marginTop: 'auto' },
  pastille: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.bg, borderRadius: radius.pill,
    paddingVertical: 3, paddingHorizontal: spacing.sm,
  },
  pastilleTexte: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
});
