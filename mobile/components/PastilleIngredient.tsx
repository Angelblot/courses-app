import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, texte } from '../lib/theme';

/** Diamètre mesuré chez Jow : 80, avec une image de 78 à l'intérieur. */
const TAILLE = 80;
/** L'image remplit presque tout le cercle — c'est ce qui le rend lisible. */
const IMAGE = 78;

/**
 * Un ingrédient présenté en pastille ronde : l'image du produit, la quantité,
 * puis le nom.
 *
 * On reconnaît un ingrédient à sa photo bien avant de lire son nom, et c'est
 * pourquoi l'image occupe 78 points sur 80 : une vignette plus petite laisse
 * un cercle vide qui ne dit rien.
 *
 * Quantité et nom sont rigoureusement identiques — même taille, même graisse,
 * même couleur. Mettre la quantité en gras, comme je l'avais fait, hiérarchise
 * là où Jow laisse lire d'un trait.
 */
export function PastilleIngredient({
  nom, quantite, image, rattache,
}: {
  nom: string;
  quantite: string;
  image: string | null;
  rattache: boolean;
}) {
  // Une image qui n'arrive pas laisserait un cercle vide : on retire l'image
  // plutôt que de couvrir l'initiale posée dessous.
  const [imageCassee, setImageCassee] = useState(false);
  const montrerImage = Boolean(image) && !imageCassee;

  return (
    <View style={s.bloc}>
      <View style={s.cercle}>
        <Text style={s.initiale}>{(nom.trim()[0] ?? '?').toUpperCase()}</Text>
        {montrerImage && (
          <Image
            source={{ uri: image! }}
            style={s.image}
            resizeMode="contain"
            onError={() => setImageCassee(true)}
          />
        )}
        {!rattache && (
          <View style={s.badge}>
            <Text style={s.badgeTexte}>à chercher</Text>
          </View>
        )}
      </View>
      <Text style={s.ligne} numberOfLines={1}>{quantite}</Text>
      <Text style={s.ligne} numberOfLines={2}>{nom}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { width: '100%', alignItems: 'center' },
  cercle: {
    width: TAILLE, height: TAILLE, borderRadius: TAILLE / 2,
    backgroundColor: colors.surface,
    // Un trait d'un point, jamais d'ombre : Jow n'en pose aucune.
    borderWidth: 1, borderColor: colors.traitPastille,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  image: {
    position: 'absolute', width: IMAGE, height: IMAGE, borderRadius: IMAGE / 2,
    backgroundColor: colors.surface,
  },
  initiale: { fontSize: 26, fontWeight: '400', color: colors.textMuted },
  badge: {
    position: 'absolute', bottom: -6,
    backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingVertical: 2, paddingHorizontal: spacing.sm,
  },
  badgeTexte: { fontSize: 10, fontWeight: '700', color: colors.accentContrast },
  ligne: { ...texte.pastille, color: colors.text, textAlign: 'center' },
});
