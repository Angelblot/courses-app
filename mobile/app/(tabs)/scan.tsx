import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FicheScannee } from '../../components/FicheScannee';
import { lookupEan, type FicheProduit, type ResultatRecherche } from '../../lib/openfoodfacts.ts';
import { normalizeProductType } from '../../lib/typology.ts';
import { fileScan } from '../../stores/queue.ts';
import { ajouterProduit } from '../../stores/products';
import { colors, radius, spacing } from '../../lib/theme';

type Message = { texte: string; erreur: boolean };

export default function Scan() {
  const [permission, demanderPermission] = useCameraPermissions();
  const [ean, setEan] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatRecherche | null>(null);
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  // Compteur de scans en attente et avis de reprise, affichés en permanence
  // sous la consigne de visée (défaut 5) : sans ceci, la file d'attente est
  // invisible pour l'utilisateur — il n'a aucun moyen de savoir combien de
  // scans patientent, ni si une reprise vient de réussir ou d'échouer.
  const [enAttenteCount, setEnAttenteCount] = useState(0);
  const [avisFile, setAvisFile] = useState<Message | null>(null);
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

  /** Relit la taille de la file et met à jour le compteur affiché à l'écran. */
  const rafraichirCompteur = useCallback(async () => {
    setEnAttenteCount(await fileScan.taille());
  }, []);

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
        // `lib/postgrest.ts`) : on met de côté plutôt que de perdre le
        // scan, dans l'espoir d'une reprise une fois le réseau revenu.
        await fileScan.enfiler(aEnregistrer);
        await rafraichirCompteur();
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
    [reprendre, rafraichirCompteur],
  );

  /**
   * Met en attente un EAN scanné hors ligne, sans repasser par
   * `lookupEan` qui vient déjà d'échouer (voir `ResultatRecherche.hors_ligne`
   * dans `lib/openfoodfacts.ts`). C'est le chemin que la spécification
   * promet par défaut sur cet état : « la fiche est mise en attente et
   * l'ajout se fait au retour du réseau », sans obliger l'utilisateur à
   * ressaisir un produit que le réseau, et non la base, a fait manquer.
   *
   * `lib/queue.ts` stocke des `FicheProduit` complètes, et un EAN hors ligne
   * n'en a pas encore (pas de nom, pas d'image : Open Food Facts n'a jamais
   * répondu). Plutôt que d'ajouter un second type ou une seconde file pour
   * ce cas, on loge un espace réservé qui respecte déjà le type `FicheProduit`
   * — `name` prend la valeur de l'EAN, tous les champs enrichis restent
   * `null` — reconnaissable par `reprendreFileEnAttente` ci-dessous, qui
   * retente `lookupEan` avant l'insertion pour restaurer l'enrichissement
   * dès que le réseau revient. C'est le plus petit changement qui n'exige ni
   * nouveau type, ni nouvelle file, ni changement du format déjà persisté
   * sur les appareils qui ont une file existante.
   */
  const mettreEnAttente = useCallback(async () => {
    if (!ean) return;
    await fileScan.enfiler({
      ean13: ean, name: ean, brand: null, imageUrl: null,
      grammageG: null, volumeMl: null, productType: null,
    });
    await rafraichirCompteur();
    setMessage({ texte: 'Mis en attente — ajouté dès le retour du réseau', erreur: false });
    setTimeout(reprendre, 1600);
  }, [ean, reprendre, rafraichirCompteur]);

  const reprendreFileEnAttente = useCallback(() => {
    if (repriseEnCours.current) return;
    repriseEnCours.current = true;
    (async () => {
      try {
        const enAttente = await fileScan.defiler();
        if (!enAttente.length) {
          await rafraichirCompteur();
          return;
        }
        const restants: FicheProduit[] = [];
        let envoyes = 0;
        let abandonnes = 0;
        for (const f of enAttente) {
          let aInserer = f;
          // Espace réservé posé par `mettreEnAttente` (nom == EAN, voir sa
          // documentation) : le réseau étant revenu, on retente la
          // recherche Open Food Facts pour récupérer l'enrichissement
          // avant l'insertion, plutôt que d'entrer définitivement l'EAN
          // en guise de nom.
          if (f.name === f.ean13) {
            const trouve = await lookupEan(f.ean13);
            if (trouve.etat === 'trouve') {
              aInserer = trouve.fiche;
            } else if (trouve.etat === 'hors_ligne') {
              // Réseau encore instable : on retente au prochain focus,
              // sans toucher à l'espace réservé.
              restants.push(f);
              continue;
            }
            // 'inconnu' : Open Food Facts ne connaît toujours pas ce code.
            // On insère l'espace réservé tel quel plutôt que de bloquer la
            // fiche indéfiniment — mieux vaut un nom provisoire (l'EAN)
            // dans le catalogue qu'un scan perdu.
          }
          // Succès, doublon (déjà en base) ou échec confirmé non réseau : la
          // fiche ne revient pas en file — voir `ajouterProduit` pour la
          // distinction réseau / non réseau et pourquoi un échec non réseau
          // n'est pas retenté indéfiniment. Seul un échec probablement
          // réseau y reste, dans l'espoir d'une prochaine reprise.
          const r = await ajouterProduit(aInserer);
          if (r.ok || r.doublon) envoyes += 1;
          else if (r.reseau) restants.push(f);
          else abandonnes += 1;
        }
        // Remplacement atomique en une seule écriture (voir `remplacer` dans
        // `lib/queue.ts`) : contrairement à un `viderFile` suivi de
        // plusieurs `enfiler`, il n'y a jamais d'état intermédiaire où la
        // file serait vide alors que des fiches jamais envoyées avec succès
        // restent à réinsérer — si l'application est tuée entre les deux
        // écritures, rien n'est perdu.
        if (restants.length !== enAttente.length) await fileScan.remplacer(restants);
        await rafraichirCompteur();
        // Confirmation de reprise et signalement d'abandon définitif
        // (défaut 5) : sans ceci, l'utilisateur n'a aucun moyen de savoir
        // qu'une fiche mise en attente est bien partie, ou qu'elle a été
        // abandonnée après un échec confirmé côté serveur.
        if (envoyes > 0 || abandonnes > 0) {
          const parties: string[] = [];
          if (envoyes > 0) {
            parties.push(`${envoyes} scan${envoyes > 1 ? 's' : ''} en attente ajouté${envoyes > 1 ? 's' : ''}`);
          }
          if (abandonnes > 0) {
            parties.push(`${abandonnes} scan${abandonnes > 1 ? 's' : ''} abandonné${abandonnes > 1 ? 's' : ''}`);
          }
          setAvisFile({ texte: parties.join(' — '), erreur: abandonnes > 0 });
          setTimeout(() => setAvisFile(null), 4000);
        }
      } finally {
        repriseEnCours.current = false;
      }
    })();
  }, [rafraichirCompteur]);

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
        {(enAttenteCount > 0 || avisFile) && (
          <Text style={[s.fileTexte, avisFile?.erreur && s.fileTexteAlerte]}>
            {avisFile
              ? avisFile.texte
              : `${enAttenteCount} scan${enAttenteCount > 1 ? 's' : ''} en attente`}
          </Text>
        )}
      </SafeAreaView>

      {ean && (
        <FicheScannee
          resultat={resultat}
          ean={ean}
          chargement={chargement}
          message={message}
          onAjouter={ajouter}
          onAjouterManuel={ajouterManuel}
          onMettreEnAttente={mettreEnAttente}
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
  consigne: { alignItems: 'center', paddingTop: spacing.xl, gap: spacing.sm },
  consigneTexte: {
    color: colors.accentContrast, fontSize: 15, fontWeight: '600',
    backgroundColor: colors.voileCamera, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm, borderRadius: radius.pill, overflow: 'hidden',
  },
  fileTexte: {
    color: colors.accentContrast, fontSize: 13, fontWeight: '600',
    backgroundColor: colors.voileCamera, paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs, borderRadius: radius.pill, overflow: 'hidden',
  },
  // Un abandon définitif ne doit pas se lire comme une simple information :
  // même pastille que `fileTexte`, teinte d'alerte du thème.
  fileTexteAlerte: { backgroundColor: colors.danger },
});
