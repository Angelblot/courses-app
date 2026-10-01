import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { lookupEan, type FicheProduit } from '../lib/openfoodfacts.ts';
import { colors } from '../lib/theme';

/**
 * Scanner un code-barres depuis une recherche, sans quitter la feuille :
 * la fiche Open Food Facts trouvée est rendue à l'appelant, qui la traite
 * comme un résultat de recherche.
 */
export function ScanRapide({ visible, onFermer, onFiche }: { visible: boolean; onFermer: () => void; onFiche: (fiche: FicheProduit) => void }) {
  const [permission, demander] = useCameraPermissions();
  const [lecture, setLecture] = useState(false), [message, setMessage] = useState<string | null>(null);
  // Verrou synchrone : plusieurs lectures arrivent avant que l'état ne coupe la caméra.
  const verrou = useRef(false);
  useEffect(() => { if (visible) { verrou.current = false; setLecture(false); setMessage(null); } }, [visible]);

  const lu = async ({ data }: { data: string }) => {
    if (verrou.current) return;
    verrou.current = true; setLecture(true); setMessage(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const r = await lookupEan(data);
    setLecture(false);
    if (r.etat === 'trouve') { onFiche(r.fiche); return; }
    setMessage(r.etat === 'inconnu' ? 'Ce code-barres n’est pas sur Open Food Facts. Cherche le produit par son nom.' : 'Connexion indisponible. Réessaie dans un instant.');
  };

  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onFermer}>
    <View style={s.ecran}>
      {permission?.granted && visible && <CameraView style={StyleSheet.absoluteFill} facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8'] }} onBarcodeScanned={lecture || message ? undefined : lu} />}
      <SafeAreaView style={s.haut} edges={['top']}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer le scan" onPress={onFermer} style={s.fermer}><Feather name="x" size={22} color="#FFFFFF" /></Pressable>
        <Text style={s.consigne}>Vise le code-barres du produit</Text>
      </SafeAreaView>
      {!permission?.granted && <View style={s.centre}>
        <Text style={s.texte}>L’appareil photo sert à lire le code-barres.</Text>
        <Pressable accessibilityRole="button" onPress={permission?.canAskAgain === false ? () => { void Linking.openSettings(); } : () => { void demander(); }} style={s.bouton}>
          <Text style={s.boutonTexte}>{permission?.canAskAgain === false ? 'Ouvrir les Réglages' : 'Autoriser l’appareil photo'}</Text>
        </Pressable>
      </View>}
      {(lecture || message) && <SafeAreaView edges={['bottom']} style={s.bas}>
        {lecture ? <View style={s.ligne}><ActivityIndicator color={colors.accent} /><Text style={s.carteTexte}>Recherche du produit…</Text></View>
          : <><Text accessibilityLiveRegion="polite" style={s.carteTexte}>{message}</Text>
            <Pressable accessibilityRole="button" onPress={() => { verrou.current = false; setMessage(null); }} style={s.bouton}><Text style={s.boutonTexte}>Scanner à nouveau</Text></Pressable></>}
      </SafeAreaView>}
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: '#000000' },
  haut: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', gap: 8 },
  fermer: { alignSelf: 'flex-start', width: 44, height: 44, marginLeft: 8, alignItems: 'center', justifyContent: 'center' },
  consigne: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, overflow: 'hidden' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  texte: { color: '#FFFFFF', fontSize: 16, textAlign: 'center' },
  bas: { position: 'absolute', left: 16, right: 16, bottom: 24, backgroundColor: colors.bg, borderRadius: 16, padding: 16, gap: 12 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  carteTexte: { fontSize: 15, color: colors.text, lineHeight: 21 },
  bouton: { minHeight: 48, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  boutonTexte: { color: colors.accentContrast, fontSize: 15, fontWeight: '600' },
});
