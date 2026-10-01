import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { nativeInbox } from '../../lib/native-inbox';
import { Action, Head, ui } from '../../components/MaisonUI';
import { colors } from '../../lib/theme';

/** Mode d'emploi de Siri et du widget, ouvert depuis Réglages. */
export default function Siri() {
  const retour = () => { if (router.canGoBack()) router.back(); else router.replace('/compte'); };
  return <SafeAreaView edges={['top']} style={ui.screen}>
    <ScrollView contentContainerStyle={s.corps}>
      <Head title="Siri et widget" back onBack={retour} avatar={false} />
      <Text style={ui.subtitle}>Noter un manque sans ouvrir l’app : il rejoint ta liste à la prochaine ouverture de Courses, sur le même compte.</Text>
      <View style={s.carte}>
        <View style={s.tete}><View style={[s.pastille, { backgroundColor: '#6E4F9A' }]}><Feather name="mic" size={17} color="#FFFFFF" /></View><Text style={ui.productName}>Avec Siri</Text></View>
        <Text style={s.texte}>{nativeInbox
          ? 'Dis « Siri, ajoute un produit dans Courses ». Siri te demande le produit et confirme l’ajout. Tu peux aussi régler la quantité dans l’app Raccourcis, action « Noter un produit manquant ».'
          : 'Siri est disponible dans la version iPhone, avec les raccourcis natifs. Il ne fonctionne pas dans cet aperçu web ni dans Expo Go.'}</Text>
      </View>
      <View style={s.carte}>
        <View style={s.tete}><View style={[s.pastille, { backgroundColor: colors.accent }]}><Feather name="grid" size={17} color="#FFFFFF" /></View><Text style={ui.productName}>Depuis l’écran d’accueil</Text></View>
        <Text style={s.texte}>Ajoute le widget Courses « Les essentiels ». Le grand format affiche six produits habituels avec leurs photos : touche + pour en ajouter un, puis « Suivants » pour changer de sélection. La coche confirme l’enregistrement sur cet appareil.</Text>
        <Text style={s.texte}>Ouvre une première fois l’app pour que le widget connaisse tes produits.</Text>
      </View>
      <Action secondary onPress={() => router.push('/ajout')}>Essayer l’ajout rapide</Action>
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  corps: { padding: 16, paddingBottom: 40, gap: 14 },
  carte: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 8 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pastille: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  texte: { fontSize: 15, lineHeight: 22, color: colors.text },
});
