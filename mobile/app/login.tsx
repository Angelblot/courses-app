import { useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../lib/theme';

const MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou mot de passe incorrect.',
  'Email not confirmed': 'Confirme ton adresse via le lien reçu par e-mail.',
};

// Message générique pour toute erreur imprévue (réseau coupé, délai dépassé,
// erreur non normalisée par supabase-js) : on ne montre jamais de trace
// technique brute à l'utilisateur.
const ERREUR_GENERIQUE = 'Connexion impossible pour le moment. Réessaie dans un instant.';

export default function Login() {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Garde par ref plutôt que par le seul état `enCours` : deux appuis très
  // rapprochés peuvent tous deux lire `enCours === false` avant le premier
  // rendu, une ref est mise à jour de façon synchrone et évite ce cas.
  const enCoursRef = useRef(false);
  const [envoye, setEnvoye] = useState(false);

  /**
   * Demande un lien de récupération. Le message de confirmation est le même
   * que l'adresse existe ou non : répondre différemment révélerait quels
   * comptes existent.
   */
  const demanderLien = async () => {
    if (!email.trim()) {
      setErreur('Renseigne ton adresse e-mail, puis redemande le lien.');
      return;
    }
    setErreur(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'coursesapp://reinitialisation',
      });
      if (error) console.error('[recuperation]', error.message);
    } catch (err) {
      console.error('[recuperation]', err);
    }
    setEnvoye(true);
  };

  const connecter = async () => {
    if (enCoursRef.current) return;
    enCoursRef.current = true;
    setEnCours(true);
    setErreur(null);
    try {
      // signInWithPassword est supposé toujours résoudre avec { error } sans
      // jamais rejeter, mais ce n'est pas garanti (coupure réseau, délai
      // dépassé, erreur non normalisée par supabase-js) : sans ce try/catch,
      // une exception laisserait `enCours` bloqué à `true` indéfiniment,
      // avec un bouton figé en chargement et aucun moyen de relancer avant
      // remontage de l'écran.
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: motDePasse,
      });
      if (error) {
        // Message français toujours affiché, jamais `error.message` brut :
        // les erreurs répertoriées ont leur phrase dédiée, les autres
        // retombent sur le même message générique que le catch ci-dessous.
        // Le détail technique part au journal de développement.
        console.error('[connexion]', error.message);
        setErreur(MESSAGES[error.message] ?? ERREUR_GENERIQUE);
      }
    } catch (err) {
      console.error('[connexion]', err);
      setErreur(ERREUR_GENERIQUE);
    } finally {
      enCoursRef.current = false;
      setEnCours(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.ecran}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.carte}>
        <Text style={s.titre}>Courses</Text>
        <Text style={s.sousTitre}>Les courses du foyer, du canapé au drive.</Text>

        <Text style={s.label}>Adresse e-mail</Text>
        <TextInput
          style={s.champ}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <Text style={s.label}>Mot de passe</Text>
        <TextInput
          style={s.champ}
          value={motDePasse}
          onChangeText={setMotDePasse}
          secureTextEntry
          textContentType="password"
        />

        {erreur && <Text style={s.erreur}>{erreur}</Text>}

        <Pressable style={s.bouton} onPress={connecter} disabled={enCours}>
          {enCours
            ? <ActivityIndicator color={colors.accentContrast} />
            : <Text style={s.boutonTexte}>Se connecter</Text>}
        </Pressable>

        {envoye ? (
          <Text style={s.info}>
            Si un compte existe pour cette adresse, un lien vient d'y être envoyé.
            Ouvre-le depuis ce téléphone.
          </Text>
        ) : (
          <Pressable onPress={demanderLien}>
            <Text style={s.lien}>Mot de passe oublié</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bg },
  carte: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  titre: { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center' },
  sousTitre: {
    fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg,
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
  info: {
    color: colors.accent, fontSize: 13, fontWeight: '600',
    textAlign: 'center', marginTop: spacing.lg,
  },
});
