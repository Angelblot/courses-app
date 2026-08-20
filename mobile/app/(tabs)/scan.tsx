import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
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
  // Empêche deux passages de reprise de tourner en même temps. Même risque
  // et même remède que `verrouille` ci-dessus : `enfiler` et `remplacer`
  // sont une lecture-modification-écriture non atomique sur AsyncStorage, et
  // le mode strict de React 18 monte puis démonte puis remonte chaque effet
  // en développement — `useFocusEffect` serait donc invoqué deux fois de
  // suite au premier focus. Deux boucles concurrentes liraient alors la même
  // file et pourraient y remettre deux fois les mêmes fiches. Ref plutôt que
  // state : lue et écrite de façon synchrone, sans attendre un rendu.
  const repriseEnCours = useRef(false);

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
      } else if (r.reseau) {
        // Échec probablement réseau (voir `estErreurReseau` dans
        // `stores/products.ts`) : on met de côté plutôt que de perdre le
        // scan, dans l'espoir d'une reprise une fois le réseau revenu.
        await file.enfiler(aEnregistrer);
        setMessage({ texte: 'Hors connexion — ajouté dès le retour du réseau', erreur: false });
        setTimeout(reprendre, 1600);
      } else {
        // Échec confirmé côté serveur (RLS, contrainte…) : rejouer la même
        // fiche donnerait la même erreur indéfiniment, donc on ne la met pas
        // en file — on informe l'utilisateur tout de suite.
        setMessage({ texte: r.erreur ?? "Impossible d'ajouter ce produit.", erreur: true });
        setTimeout(reprendre, 1600);
      }
    },
    [reprendre],
  );

  const reprendreFileEnAttente = useCallback(() => {
    if (repriseEnCours.current) return;
    repriseEnCours.current = true;
    (async () => {
      try {
        const enAttente = await file.defiler();
        if (!enAttente.length) return;
        const restants: FicheProduit[] = [];
        for (const f of enAttente) {
          const r = await ajouterProduit(f);
          // Succès, doublon (déjà en base) ou échec confirmé non réseau : la
          // fiche ne revient pas en file — voir `ajouterProduit` pour la
          // distinction réseau / non réseau et pourquoi un échec non réseau
          // n'est pas retenté indéfiniment. Seul un échec probablement
          // réseau y reste, dans l'espoir d'une prochaine reprise.
          if (!r.ok && r.reseau) restants.push(f);
        }
        // Remplacement atomique en une seule écriture (voir `remplacer` dans
        // `lib/queue.ts`) : contrairement à un `viderFile` suivi de
        // plusieurs `enfiler`, il n'y a jamais d'état intermédiaire où la
        // file serait vide alors que des fiches jamais envoyées avec succès
        // restent à réinsérer — si l'application est tuée entre les deux
        // écritures, rien n'est perdu.
        if (restants.length !== enAttente.length) await file.remplacer(restants);
      } finally {
        repriseEnCours.current = false;
      }
    })();
  }, []);

  // Reprend la file à chaque prise de focus de l'écran. `app/(tabs)/_layout.tsx`
  // utilise `<Tabs>` d'expo-router sans `unmountOnBlur` : un écran déjà
  // visité reste monté quand on change d'onglet, il n'est pas remonté au
  // retour dessus. Un `useEffect` à tableau de dépendances vide ne
  // s'exécuterait donc qu'une seule fois, au tout premier passage sur
  // l'onglet Scan, pour toute la durée de vie de l'application — revenir
  // sur l'onglet après une coupure réseau ne relancerait jamais la reprise.
  // `useFocusEffect` (réexporté par expo-router) se déclenche à chaque
  // focus, mais exige un callback stable, d'où le `useCallback` ci-dessus.
  useFocusEffect(reprendreFileEnAttente);

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
