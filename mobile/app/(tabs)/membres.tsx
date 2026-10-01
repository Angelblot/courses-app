import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useFoyer, inviter, retirerMembre, type Membre } from '../../stores/foyer';
import { libelleMembre, peutRetirer } from '../../lib/foyer-libelles.ts';
import { Action, Head, ui } from '../../components/MaisonUI';
import { colors } from '../../lib/theme';

/** Membres du foyer et invitations, ouvert depuis Réglages. */
export default function Membres() {
  const { membres, moi, chargement, erreur, recharger } = useFoyer();
  const [adresse, setAdresse] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreurInvitation, setErreurInvitation] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { recharger(); }, [recharger]));

  const envoyer = async () => {
    if (envoi || !adresse.trim()) return;
    setEnvoi(true); setMessage(null); setErreurInvitation(null);
    const r = await inviter(adresse);
    setEnvoi(false);
    if (r.ok) { setMessage('Invitation envoyée.'); setAdresse(''); recharger(); }
    else setErreurInvitation(r.erreur ?? "L'invitation n'a pas pu être envoyée.");
  };
  const demanderRetrait = (m: Membre) => Alert.alert(
    'Retirer ce membre ?',
    'Il perdra l’accès au foyer. Le catalogue et les recettes restent.',
    [{ text: 'Annuler', style: 'cancel' }, { text: 'Retirer', style: 'destructive', onPress: async () => {
      const r = await retirerMembre(m.id);
      if (r.ok) recharger(); else Alert.alert('Retrait impossible', r.erreur ?? '');
    } }],
  );

  return <SafeAreaView edges={['top']} style={ui.screen}>
    <ScrollView contentContainerStyle={s.corps} keyboardShouldPersistTaps="handled">
      <Head title="Membres" back onBack={retour} avatar={false} />
      {chargement && !membres.length && <ActivityIndicator color={colors.accent} />}
      {erreur && <Text style={ui.error}>{erreur}</Text>}
      <View style={s.carte}>
        {membres.map((m, i) => <View key={m.id} style={[s.ligne, i < membres.length - 1 && s.separee]}>
          <View style={{ flex: 1, gap: 2 }}><Text style={ui.productName} numberOfLines={1}>{m.email ?? 'Adresse inconnue'}</Text><Text style={[ui.detail, { marginTop: 0 }]}>{libelleMembre(m)}</Text></View>
          {moi && peutRetirer(moi, m) && <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${m.email ?? 'ce membre'}`} onPress={() => demanderRetrait(m)} style={s.retirer}><Text style={s.retirerTexte}>Retirer</Text></Pressable>}
        </View>)}
      </View>
      <Text style={ui.section}>Inviter quelqu’un</Text>
      <Text style={[ui.detail, { marginTop: -6 }]}>La personne reçoit un courriel. Elle verra le même catalogue, les mêmes recettes et les mêmes listes que toi.</Text>
      <TextInput style={ui.input} value={adresse} onChangeText={setAdresse} placeholder="adresse@exemple.fr" placeholderTextColor={colors.textMuted}
        autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress" accessibilityLabel="Adresse e-mail à inviter" />
      {!!message && <Text accessibilityLiveRegion="polite" style={ui.link}>{message}</Text>}
      {!!erreurInvitation && <Text accessibilityLiveRegion="polite" style={ui.error}>{erreurInvitation}</Text>}
      <Action disabled={!adresse.trim() || envoi} onPress={envoyer}>{envoi ? 'Envoi…' : 'Envoyer l’invitation'}</Action>
    </ScrollView>
  </SafeAreaView>;
}

/** Retour à Réglages, d'où l'écran s'ouvre. */
function retour() {
  if (router.canGoBack()) router.back(); else router.replace('/compte');
}

const s = StyleSheet.create({
  corps: { padding: 16, paddingBottom: 40, gap: 14 },
  carte: { backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 8 },
  separee: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  retirer: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  retirerTexte: { fontSize: 14, fontWeight: '600', color: colors.danger },
});
