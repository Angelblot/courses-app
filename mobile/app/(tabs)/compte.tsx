import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import {
  useFoyer, inviter, retirerMembre, renommerFoyer, type Membre,
} from '../../stores/foyer';
import { libelleMembre, peutRetirer } from '../../lib/foyer-libelles.ts';
import { colors, radius, spacing } from '../../lib/theme';

export default function Compte() {
  const { foyer, membres, moi, chargement, erreur, recharger } = useFoyer();
  const [nom, setNom] = useState<string | null>(null);
  const [adresse, setAdresse] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [messageInvitation, setMessageInvitation] = useState<string | null>(null);
  const [erreurInvitation, setErreurInvitation] = useState<string | null>(null);
  const [erreurNom, setErreurNom] = useState<string | null>(null);

  const rechargerAuFocus = useCallback(() => { recharger(); }, [recharger]);
  useFocusEffect(rechargerAuFocus);

  const enregistrerNom = async () => {
    if (!foyer || nom === null || nom === foyer.name) return;
    const r = await renommerFoyer(foyer.id, nom);
    if (r.ok) {
      setErreurNom(null);
      recharger();
    } else {
      setErreurNom(r.erreur ?? null);
    }
  };

  const envoyerInvitation = async () => {
    if (envoiEnCours) return;
    setEnvoiEnCours(true);
    setMessageInvitation(null);
    setErreurInvitation(null);
    const r = await inviter(adresse);
    setEnvoiEnCours(false);
    if (r.ok) {
      setMessageInvitation('Invitation envoyée.');
      setAdresse('');
      recharger();
    } else {
      setErreurInvitation(r.erreur ?? "L'invitation n'a pas pu être envoyée.");
    }
  };

  const demanderRetrait = (m: Membre) => {
    Alert.alert(
      'Retirer ce membre ?',
      'Il perdra l’accès au foyer. Le catalogue et les recettes restent.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            const r = await retirerMembre(m.id);
            if (r.ok) recharger();
            else Alert.alert('Retrait impossible', r.erreur ?? '');
          },
        },
      ],
    );
  };

  if (chargement && !foyer) {
    return <SafeAreaView style={s.centre}><ActivityIndicator color={colors.accent} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.ecran}>
      <ScrollView contentContainerStyle={s.corps}>
        <Text style={s.titre}>Compte</Text>

        {erreur && (
          <View style={s.bloc}>
            <Text style={s.erreur}>{erreur}</Text>
            <Pressable style={s.secondaire} onPress={recharger}>
              <Text style={s.secondaireTexte}>Réessayer</Text>
            </Pressable>
          </View>
        )}

        {foyer && (
          <>
            <Text style={s.section}>Ton foyer</Text>
            <TextInput
              style={s.champ}
              value={nom ?? foyer.name}
              onChangeText={setNom}
              onBlur={enregistrerNom}
              placeholder="Nom du foyer"
              placeholderTextColor={colors.textMuted}
            />
            {erreurNom && <Text style={s.erreur}>{erreurNom}</Text>}

            <Text style={s.section}>
              {`Membres (${membres.length})`}
            </Text>
            {membres.map((m) => (
              <View key={m.id} style={s.ligne}>
                <View style={s.ligneTexte}>
                  <Text style={s.email} numberOfLines={1}>{m.email ?? 'Adresse inconnue'}</Text>
                  <Text style={s.etat}>{libelleMembre(m)}</Text>
                </View>
                {moi && peutRetirer(moi, m) && (
                  <Pressable onPress={() => demanderRetrait(m)} hitSlop={8}>
                    <Text style={s.retirer}>Retirer</Text>
                  </Pressable>
                )}
              </View>
            ))}

            <Text style={s.section}>Inviter quelqu&apos;un</Text>
            <Text style={s.aide}>
              La personne recevra un courriel. Elle verra le même catalogue, les mêmes
              recettes et les mêmes listes que toi.
            </Text>
            <TextInput
              style={s.champ}
              value={adresse}
              onChangeText={setAdresse}
              placeholder="adresse@exemple.fr"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            {messageInvitation && <Text style={s.succes}>{messageInvitation}</Text>}
            {erreurInvitation && <Text style={s.erreur}>{erreurInvitation}</Text>}
            <Pressable
              style={[s.bouton, (!adresse.trim() || envoiEnCours) && s.desactive]}
              onPress={envoyerInvitation}
              disabled={!adresse.trim() || envoiEnCours}
            >
              {envoiEnCours
                ? <ActivityIndicator color={colors.accentContrast} />
                : <Text style={s.boutonTexte}>Envoyer l&apos;invitation</Text>}
            </Pressable>
          </>
        )}

        <Pressable style={s.deconnexion} onPress={() => supabase.auth.signOut()}>
          <Text style={s.deconnexionTexte}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  corps: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  titre: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  section: {
    fontSize: 13, fontWeight: '800', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.4,
    marginTop: spacing.xl, marginBottom: spacing.xs,
  },
  aide: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.xs },
  bloc: { gap: spacing.sm },
  champ: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: 16, color: colors.text, backgroundColor: colors.surface,
  },
  ligne: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md,
    marginBottom: spacing.xs,
  },
  ligneTexte: { flex: 1, gap: 2 },
  email: { fontSize: 15, fontWeight: '600', color: colors.text },
  etat: { fontSize: 12, color: colors.textMuted },
  retirer: { fontSize: 13, fontWeight: '600', color: colors.danger },
  succes: { fontSize: 13, fontWeight: '600', color: colors.accent, marginTop: spacing.xs },
  erreur: { fontSize: 13, color: colors.danger, marginTop: spacing.xs },
  bouton: {
    backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.lg,
    alignItems: 'center', marginTop: spacing.md,
  },
  boutonTexte: { color: colors.accentContrast, fontWeight: '700', fontSize: 16 },
  desactive: { opacity: 0.4 },
  secondaire: {
    alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
  },
  secondaireTexte: { color: colors.text, fontWeight: '600', fontSize: 14 },
  deconnexion: {
    marginTop: spacing.xxl, borderWidth: 1, borderColor: colors.danger,
    borderRadius: radius.md, padding: spacing.lg, alignItems: 'center',
  },
  deconnexionTexte: { color: colors.danger, fontWeight: '700', fontSize: 16 },
});
