import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { fileScan } from '../../stores/queue.ts';
import { colors, radius, spacing } from '../../lib/theme';

export default function Compte() {
  const [enCours, setEnCours] = useState(false);

  const deconnecter = async () => {
    if (enCours) return;
    setEnCours(true);
    // La file de scan hors connexion (`lib/queue.ts`) utilise une clé fixe
    // dans AsyncStorage, partagée par tout appareil quel que soit le compte
    // connecté. Sans purge à la déconnexion, un scan mis en attente hors
    // ligne par un compte pourrait être rejoué — et donc atterrir — dans le
    // catalogue d'un autre compte connecté ensuite sur le même appareil,
    // contournant de fait le cloisonnement RLS. On vide la file ici plutôt
    // que de la cloisonner par compte (ce qui exigerait de connaître
    // l'identifiant utilisateur au moment même où `app/(tabs)/scan.tsx`
    // crée son instance de file, avant que la session ne soit résolue) :
    // c'est le choix le plus simple qui ferme totalement la fuite, au prix
    // de scans non encore envoyés qui seraient perdus si l'utilisateur se
    // déconnecte volontairement avant leur reprise — un cas rare, et un
    // arbitrage explicite plutôt qu'une fuite silencieuse entre comptes.
    await fileScan.viderFile();
    // signOut purge toujours la session locale, même si la requête réseau
    // de révocation échoue : `app/_layout.tsx` écoute `onAuthStateChange`
    // et redirige vers /login dès que la session locale disparaît. Pas de
    // message d'erreur nécessaire ici, la déconnexion réussit donc toujours
    // du point de vue de l'utilisateur.
    await supabase.auth.signOut();
    setEnCours(false);
  };

  return (
    <SafeAreaView style={s.ecran}>
      <View style={s.entete}>
        <Text style={s.titre}>Compte</Text>
      </View>

      <View style={s.corps}>
        <Pressable style={s.bouton} onPress={deconnecter} disabled={enCours}>
          {enCours
            ? <ActivityIndicator color={colors.danger} />
            : <Text style={s.boutonTexte}>Se déconnecter</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  entete: { padding: spacing.lg },
  titre: { fontSize: 26, fontWeight: '800', color: colors.text },
  corps: { paddingHorizontal: spacing.lg },
  bouton: {
    borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  boutonTexte: { color: colors.danger, fontWeight: '700', fontSize: 16 },
});
