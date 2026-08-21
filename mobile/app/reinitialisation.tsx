import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../lib/theme';

const ERREUR_LIEN =
  "Ce lien est expiré ou a déjà servi. Redemande un lien depuis l'écran de connexion.";
const ERREUR_GENERIQUE = 'Enregistrement impossible pour le moment. Réessaie dans un instant.';
const LONGUEUR_MIN = 8;

export default function Reinitialisation() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const [pret, setPret] = useState(false);
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const enCoursRef = useRef(false);

  // Le code du lien s'échange une seule fois contre une session de
  // récupération. Tant qu'il n'est pas échangé, `updateUser` n'aurait aucune
  // identité sur laquelle agir.
  useEffect(() => {
    let vivant = true;
    (async () => {
      if (!code) {
        if (vivant) {
          setErreur(ERREUR_LIEN);
          setPret(true);
        }
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!vivant) return;
      if (error) {
        console.error('[reinitialisation]', error.message);
        setErreur(ERREUR_LIEN);
      }
      setPret(true);
    })();
    return () => {
      vivant = false;
    };
  }, [code]);

  const enregistrer = async () => {
    if (enCoursRef.current) return;
    if (motDePasse.length < LONGUEUR_MIN) {
      setErreur(`Le mot de passe doit faire au moins ${LONGUEUR_MIN} caractères.`);
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur('Les deux saisies diffèrent.');
      return;
    }
    enCoursRef.current = true;
    setEnCours(true);
    setErreur(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: motDePasse });
      if (error) {
        console.error('[reinitialisation]', error.message);
        setErreur(ERREUR_GENERIQUE);
        return;
      }
      // La session de récupération vaut session ordinaire : la garde de
      // `_layout.tsx` mènera à l'accueil dès qu'on quitte cette route.
      router.replace('/');
    } catch (err) {
      console.error('[reinitialisation]', err);
      setErreur(ERREUR_GENERIQUE);
    } finally {
      enCoursRef.current = false;
      setEnCours(false);
    }
  };

  if (!pret) {
    return (
      <View style={[s.ecran, s.centre]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.ecran}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.carte}>
        <Text style={s.titre}>Nouveau mot de passe</Text>

        {erreur && <Text style={s.erreur}>{erreur}</Text>}

        {code && (
          <>
            <Text style={s.label}>Nouveau mot de passe</Text>
            <TextInput
              style={s.champ}
              value={motDePasse}
              onChangeText={setMotDePasse}
              secureTextEntry
              textContentType="newPassword"
              autoFocus
            />

            <Text style={s.label}>Confirmation</Text>
            <TextInput
              style={s.champ}
              value={confirmation}
              onChangeText={setConfirmation}
              secureTextEntry
              textContentType="newPassword"
            />

            <Pressable style={s.bouton} onPress={enregistrer} disabled={enCours}>
              {enCours
                ? <ActivityIndicator color={colors.accentContrast} />
                : <Text style={s.boutonTexte}>Enregistrer</Text>}
            </Pressable>
          </>
        )}

        <Pressable onPress={() => router.replace('/login')}>
          <Text style={s.lien}>Revenir à la connexion</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bg },
  centre: { alignItems: 'center' },
  carte: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  titre: {
    fontSize: 24, fontWeight: '800', color: colors.text,
    textAlign: 'center', marginBottom: spacing.md,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: spacing.sm },
  champ: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: 16, color: colors.text, backgroundColor: colors.surface,
  },
  erreur: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  bouton: {
    backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.lg,
    alignItems: 'center', marginTop: spacing.lg,
  },
  boutonTexte: { color: colors.accentContrast, fontWeight: '700', fontSize: 16 },
  lien: {
    color: colors.textMuted, fontSize: 13, fontWeight: '600',
    textAlign: 'center', textDecorationLine: 'underline', marginTop: spacing.lg,
  },
});
