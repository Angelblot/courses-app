import { useState } from 'react';
import { ActivityIndicator, AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { DetailProduit, type OuvertureFiche } from '../../components/DetailProduit';
import { Action, ui } from '../../components/MaisonUI';
import { useProducts, type Product } from '../../stores/products';
import { useWizard } from '../../contexts/WizardContext';
import { colors, spacing } from '../../lib/theme';

/**
 * La fiche d'un produit, en feuille. Un appui long sur n'importe quelle ligne
 * de produit l'ouvre ; la refermer, d'un glisser ou de « Fermer », ramène
 * exactement à l'écran d'où l'on vient. `id` est l'identifiant du produit, ou
 * `ean:<code-barres>` pour une ligne de commande qui ne connaît que lui.
 */
export default function FicheProduitEcran() {
  const { id = '', ouverture } = useLocalSearchParams<{ id: string; ouverture?: OuvertureFiche }>();
  const p = useProducts(), w = useWizard();
  const [edition, setEdition] = useState(false);
  const ean = id.startsWith('ean:') ? id.slice(4) : null;
  const produit = p.produits.find((x) => (ean ? x.ean13 === ean : x.id === id)) ?? null;
  const fermer = () => { if (router.canGoBack()) router.back(); else router.dismissTo('/'); };
  const supprime = (x: Product) => {
    w.marquerProduit(x.id, null);
    AccessibilityInfo.announceForAccessibility(`${x.name} supprimé`);
    void p.recharger();
    fermer();
  };

  if (!produit) {
    const cherche = p.chargement && !p.erreur;
    return <SafeAreaView edges={['top', 'bottom']} style={s.ecran}>
      <View style={s.barre}><Pressable accessibilityRole="button" onPress={fermer} style={s.bouton}><Text style={s.boutonTexte}>Fermer</Text></Pressable></View>
      <View style={s.vide}>
        {cherche ? <ActivityIndicator color={colors.accent} /> : <>
          <Text style={ui.productName}>{p.erreur ? 'Fiche indisponible pour le moment.' : 'Ce produit n’est pas dans ton catalogue.'}</Text>
          <Text style={[ui.subtitle, { textAlign: 'center' }]}>{p.erreur ?? 'Scanne-le pour l’ajouter à tes produits : sa fiche apparaîtra ici.'}</Text>
          {!!p.erreur && <Action secondary onPress={p.recharger}>Réessayer</Action>}
        </>}
      </View>
    </SafeAreaView>;
  }

  return <View style={s.ecran}>
    <Stack.Screen options={{ gestureEnabled: !edition }} />
    <DetailProduit produit={produit} produits={p.produits} ouverture={ouverture ?? 'consulter'} onFermer={fermer}
      onChange={p.recharger} onSupprime={supprime} onEdition={setEdition} onAjouter={() => w.ajouterProduitListe(produit.id)} />
  </View>;
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  barre: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, minHeight: 52, justifyContent: 'center' },
  bouton: { minWidth: 72, minHeight: 44, justifyContent: 'center' },
  boutonTexte: { fontSize: 17, color: colors.accent },
  vide: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
});
