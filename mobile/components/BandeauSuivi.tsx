import { useEffect, useRef } from 'react';
import {
  Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTravailActif } from '../stores/suivi';
import { resume } from '../lib/suivi-libelles.ts';
import { colors, radius, spacing } from '../lib/theme';

/** Hauteur standard d'une barre d'onglets iOS, hors zone sûre. */
const HAUTEUR_ONGLETS = 49;
/** Largeur de la bande claire qui balaie le bandeau pendant l'attente. */
const LARGEUR_BALAYAGE = 120;

/**
 * Bandeau de suivi, posé au-dessus de la barre d'onglets sur tous les écrans.
 *
 * Il n'anime que l'attente : en cours, la progression *est* l'information, et
 * un mouvement par-dessus la brouillerait.
 */
export function BandeauSuivi() {
  const { travail, ecarter } = useTravailActif();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const balayage = useRef(new Animated.Value(0)).current;

  const statut = travail?.status ?? '';
  const enAttente = statut === 'pending' || statut === 'claimed';

  useEffect(() => {
    if (!enAttente) return undefined;
    const boucle = Animated.loop(
      Animated.timing(balayage, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        // La translation tourne hors du fil JavaScript : c'est ce qui rend
        // une boucle continue acceptable sans reanimated.
        useNativeDriver: true,
      }),
    );
    boucle.start();
    // Une boucle laissée tourner survivrait au démontage et continuerait de
    // consommer pour un bandeau qui n'existe plus.
    return () => {
      boucle.stop();
      balayage.setValue(0);
    };
  }, [enAttente, balayage]);

  if (!travail) return null;

  const alerte = statut === 'needs_action' || statut === 'failed';
  const largeurBandeau = width - spacing.lg * 2;

  const texte = statut === 'done'
    ? 'Panier rempli'
    : statut === 'failed'
      ? 'Le remplissage a échoué'
      : enAttente
        ? 'Ta liste attend sur ton Mac'
        : resume(travail);

  const p = travail.progress ?? {};
  const fraction = statut === 'running' && p.total ? Math.min(1, (p.fait ?? 0) / p.total) : null;

  return (
    <Pressable
      style={[
        s.bandeau,
        { bottom: insets.bottom + HAUTEUR_ONGLETS + spacing.sm },
        alerte && s.bandeauAlerte,
      ]}
      onPress={() => router.push(`/suivi/${travail.id}`)}
    >
      {enAttente && (
        <Animated.View
          style={[
            s.balayage,
            {
              transform: [{
                translateX: balayage.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-LARGEUR_BALAYAGE, largeurBandeau],
                }),
              }],
            },
          ]}
          pointerEvents="none"
        />
      )}

      <View style={s.contenu}>
        <Text style={[s.texte, alerte && s.texteAlerte]} numberOfLines={1}>{texte}</Text>
        <Text style={[s.action, alerte && s.texteAlerte]}>Voir</Text>
        {/* Écarter le bandeau doit toujours être possible : c'est
            l'utilisateur qui sait si un remplissage l'intéresse encore. */}
        <Pressable onPress={ecarter} hitSlop={12} accessibilityLabel="Masquer le suivi">
          <Text style={[s.fermer, alerte && s.texteAlerte]}>✕</Text>
        </Pressable>
      </View>

      {/* Aucune barre quand le total manque : une barre pleine mentirait. */}
      {fraction !== null && (
        <View style={s.piste}>
          <View style={[s.progression, { width: `${Math.round(fraction * 100)}%` }]} />
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  bandeau: {
    position: 'absolute', left: spacing.lg, right: spacing.lg,
    backgroundColor: colors.accentSoft, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  bandeauAlerte: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  balayage: {
    position: 'absolute', top: 0, bottom: 0, width: LARGEUR_BALAYAGE,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  contenu: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md,
  },
  texte: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.accent },
  texteAlerte: { color: colors.danger },
  action: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  fermer: { fontSize: 15, fontWeight: '600', color: colors.textMuted, paddingLeft: spacing.xs },
  piste: { height: 3, backgroundColor: colors.border },
  progression: { height: 3, backgroundColor: colors.accent },
});
