import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Recipe } from '../stores/recipes';
import { initiale, indiceAplat, formatDuree } from '../lib/recettes-affichage.ts';
import { colors, radius, spacing, texte } from '../lib/theme';

/**
 * Marges de la grille, reprises de Jow : 24 de part et d'autre, 15 entre les
 * deux colonnes. Elles servent ici à calculer la largeur exacte d'une carte,
 * dont dépend tout le reste — l'image en fait toute la largeur.
 */
export const MARGE_GRILLE = 24;
export const ECART_GRILLE = 15;
/** De combien l'image déborde par le haut. Mesuré : 60 sur une carte de 156. */
const DEBORDEMENT = 60;

export function largeurCarte(largeurEcran: number): number {
  return Math.floor((largeurEcran - MARGE_GRILLE * 2 - ECART_GRILLE) / 2);
}

/**
 * Carte de recette : la photo fait toute la largeur et déborde par le haut.
 *
 * Chez Jow, cette image est un plat détouré sur fond transparent — la rondeur
 * vient de l'assiette photographiée, pas d'un arrondi. Nos photos étant des
 * cadrages rectangulaires, on les inscrit dans un cercle : c'est la seule
 * façon d'obtenir le même effet de plat posé sans studio photo.
 *
 * Sans photo, un aplat coloré portant l'initiale. Jamais une image générique
 * récupérée ailleurs : une fausse photo dit quelque chose de faux.
 */
export function CarteRecette({ recette, onOuvrir }: { recette: Recipe; onOuvrir: () => void }) {
  const { width } = useWindowDimensions();
  const cote = largeurCarte(width);
  const n = recette.ingredients.length;
  // Le temps total prime : c'est ce qu'on regarde d'abord en choisissant un
  // plat. À défaut, le nombre d'ingrédients, qui en dit un peu.
  const duree = formatDuree((recette.prep_minutes ?? 0) + (recette.cook_minutes ?? 0));

  return (
    <Pressable style={[s.enveloppe, { width: cote, paddingTop: DEBORDEMENT }]} onPress={onOuvrir}>
      <View style={[s.carte, { paddingTop: cote - DEBORDEMENT + spacing.md }]}>
        <Text style={s.nom} numberOfLines={2}>{recette.name}</Text>
        <View style={s.pastilles}>
          <View style={s.pastille}>
            <Feather name="users" size={12} color={colors.text} />
            <Text style={s.pastilleTexte}>{recette.servings_default}</Text>
          </View>
          <View style={s.pastille}>
            <Feather name={duree ? 'clock' : 'list'} size={12} color={colors.text} />
            <Text style={s.pastilleTexte}>{duree ?? n}</Text>
          </View>
        </View>
      </View>

      {recette.image_url ? (
        <Image
          source={{ uri: recette.image_url }}
          style={[s.photo, { width: cote, height: cote, borderRadius: cote / 2 }]}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            s.photo, s.aplat,
            { width: cote, height: cote, borderRadius: cote / 2,
              backgroundColor: colors.aplats[indiceAplat(recette.name)] },
          ]}
        >
          <Text style={[s.initiale, { color: colors.aplatsEncre[indiceAplat(recette.name)] }]}>
            {initiale(recette.name)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  // La photo est rendue APRÈS la carte pour passer devant : React Native
  // n'honore pas `zIndex` de façon fiable entre frères sur Android.
  enveloppe: { alignItems: 'center' },
  carte: {
    width: '100%', flex: 1,
    backgroundColor: colors.surface, borderRadius: radius.card,
    paddingHorizontal: spacing.sm, paddingBottom: spacing.lg,
    alignItems: 'center', gap: spacing.sm,
  },
  photo: { position: 'absolute', top: 0, backgroundColor: colors.bg },
  aplat: { alignItems: 'center', justifyContent: 'center' },
  initiale: { fontSize: 40, fontWeight: '400' },
  nom: { ...texte.carte, color: colors.text, textAlign: 'center' },
  // Poussées en bas : les pastilles s'alignent d'une carte à l'autre même
  // quand les noms n'ont pas le même nombre de lignes.
  pastilles: { flexDirection: 'row', gap: spacing.xs, marginTop: 'auto' },
  pastille: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.bg, borderRadius: radius.sm,
    paddingVertical: 4, paddingHorizontal: 6,
  },
  pastilleTexte: { ...texte.pastille, color: colors.text },
});
