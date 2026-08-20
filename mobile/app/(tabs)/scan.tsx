import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FicheScannee } from '../../components/FicheScannee';
import { lookupEan, type FicheProduit, type ResultatRecherche } from '../../lib/openfoodfacts.ts';
import { normalizeProductType } from '../../lib/typology.ts';
import { creerFile } from '../../lib/queue.ts';
import { ajouterProduit } from '../../stores/products';
import { colors, radius, spacing } from '../../lib/theme';

type Message = { texte: string; erreur: boolean };

// Instance unique pour l'écran : la file s'appuie sur AsyncStorage, donc son
// contenu survit d'un montage à l'autre — c'est justement ce qui permet de
// rejouer les scans en attente quand l'utilisateur revient sur cet onglet.
const file = creerFile(AsyncStorage);

export default function Scan() {
  const [permission, demanderPermission] = useCameraPermissions();
  const [ean, setEan] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatRecherche | null>(null);
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  // Verrou lu et écrit de façon synchrone. `ean` et `chargement` ne suffisent
  // pas : ils sont capturés dans la fermeture de `surLecture` au moment du
  // rendu, et `onBarcodeScanned={ean ? undefined : surLecture}` ne coupe la
  // caméra côté natif qu'après que l'état soit commité et propagé — un
  // cycle plus tard. Entre le premier appel et ce cycle, plusieurs lectures
  // peuvent arriver avec la même fermeture périmée, passer le garde d'état,
  // et déclencher chacune leur requête Open Food Facts et leur vibration.
  // Une ref est mise à jour immédiatement, avant tout `await`, donc la
  // deuxième lecture la voit déjà posée.
  const verrouille = useRef(false);

  const reprendre = useCallback(() => {
    verrouille.current = false;
    setEan(null);
    setResultat(null);
    setMessage(null);
  }, []);

  const surLecture = useCallback(
    async ({ data }: { data: string }) => {
      if (verrouille.current) return;
      verrouille.current = true;
      setEan(data);
      setChargement(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResultat(await lookupEan(data));
      setChargement(false);
    },
    [],
  );

  /**
   * Enregistre une fiche, quelle que soit son origine : une fiche trouvée
   * sur Open Food Facts (`ajouter`) ou une saisie manuelle après un résultat
   * `inconnu` ou `hors_ligne` (`ajouterManuel`). Les deux parcours passent
   * par cette même fonction, donc la mise en file en cas d'échec les couvre
   * tous les deux sans code dédié à la saisie manuelle : que le réseau ait
   * manqué avant la recherche Open Food Facts ou seulement au moment de
   * l'écriture en base, la fiche est mise de côté de la même façon.
   */
  const enregistrer = useCallback(
    async (aEnregistrer: FicheProduit) => {
      const r = await ajouterProduit(aEnregistrer);
      if (r.ok) {
        setMessage({ texte: 'Ajouté à tes favoris', erreur: false });
        setTimeout(reprendre, 1200);
      } else if (r.doublon) {
        setMessage({ texte: `Déjà dans ton catalogue : ${r.doublon.name}`, erreur: true });
      } else {
        // Échec probablement réseau : on met de côté plutôt que de perdre
        // le scan, au lieu d'afficher l'erreur générique de `ajouterProduit`.
        await file.enfiler(aEnregistrer);
        setMessage({ texte: 'Hors connexion — ajouté dès le retour du réseau', erreur: false });
        setTimeout(reprendre, 1600);
      }
    },
    [reprendre],
  );

  // Vide la file au retour sur l'écran : les scans mis de côté rejoignent
  // le catalogue sans que l'utilisateur ait à y penser. Ne se relance pas à
  // chaque scan (tableau de dépendances vide) : seul le montage de l'écran
  // — donc un retour dessus depuis un autre onglet — déclenche la reprise.
  useEffect(() => {
    (async () => {
      const enAttente = await file.defiler();
      if (!enAttente.length) return;
      const restants: FicheProduit[] = [];
      for (const f of enAttente) {
        const r = await ajouterProduit(f);
        if (!r.ok && !r.doublon) restants.push(f);
      }
      // On vide puis on ré-enfile seulement les échecs : les succès (et les
      // doublons, déjà présents en base) ne doivent pas revenir dans la file.
      await file.viderFile();
      for (const f of restants) await file.enfiler(f);
    })();
  }, []);

  const ajouter = useCallback(() => {
    if (resultat?.etat === 'trouve') enregistrer(resultat.fiche);
  }, [resultat, enregistrer]);

  /** Produit absent d'Open Food Facts : on compose la fiche depuis la saisie. */
  const ajouterManuel = useCallback(
    (nom: string, marque: string) => {
      if (!ean || !nom) return;
      enregistrer({
        ean13: ean,
        name: nom,
        brand: marque || null,
        imageUrl: null,
        grammageG: null,
        volumeMl: null,
        productType: normalizeProductType(nom),
      });
    },
    [ean, enregistrer],
  );

  if (!permission) return <SafeAreaView style={s.ecran} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={[s.ecran, s.centre]}>
        <Text style={s.titre}>Accès à l'appareil photo</Text>
        <Text style={s.corps}>
          Le scan a besoin de la caméra pour lire les codes-barres de tes produits.
        </Text>
        <Pressable style={s.bouton} onPress={demanderPermission}>
          <Text style={s.boutonTexte}>Autoriser</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.ecran}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8'] }}
        onBarcodeScanned={ean ? undefined : surLecture}
      />
      <SafeAreaView style={s.consigne} pointerEvents="none">
        <Text style={s.consigneTexte}>Vise le code-barres du produit</Text>
      </SafeAreaView>

      {ean && (
        <FicheScannee
          resultat={resultat}
          ean={ean}
          chargement={chargement}
          message={message}
          onAjouter={ajouter}
          onAjouterManuel={ajouterManuel}
          onIgnorer={reprendre}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  centre: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  titre: { fontSize: 20, fontWeight: '700', color: colors.text },
  corps: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
  bouton: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.sm,
  },
  boutonTexte: { color: colors.accentContrast, fontWeight: '700' },
  consigne: { alignItems: 'center', paddingTop: spacing.xl },
  consigneTexte: {
    color: colors.accentContrast, fontSize: 15, fontWeight: '600',
    backgroundColor: colors.voileCamera, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm, borderRadius: radius.pill, overflow: 'hidden',
  },
});
