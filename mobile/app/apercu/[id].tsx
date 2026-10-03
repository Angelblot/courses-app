import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Action, Photo, ui } from '../../components/MaisonUI';
import { PastilleNutri } from '../../components/PastilleNutri';
import { useProducts } from '../../stores/products';
import { useHistoriquePrix } from '../../stores/historique';
import { useWizard } from '../../contexts/WizardContext';
import { formaterContenance } from '../../lib/fiche-produit.ts';
import { ENSEIGNES } from '../../lib/commandes.ts';
import { euros, jourLong, pourcent, teinteEcart } from '../../lib/format-commande.ts';
import { colors, spacing } from '../../lib/theme';

/**
 * L'aperçu d'un produit, ouvert par un appui long sur n'importe quelle ligne :
 * une feuille courte, à la hauteur de son contenu, avec la photo, le
 * Nutri-Score et le dernier prix payé. « Voir la fiche » ouvre la fiche
 * complète ; un glisser vers le bas rend la liste là où on l'a laissée.
 * `id` est l'identifiant du produit, ou `ean:<code-barres>`.
 */
export default function ApercuProduit() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const p = useProducts(), w = useWizard();
  const ean = id.startsWith('ean:') ? id.slice(4) : null;
  const produit = p.produits.find((x) => (ean ? x.ean13 === ean : x.id === id)) ?? null;
  const [ajoute, setAjoute] = useState(false);

  if (!produit) return <View style={s.feuille}>
    {p.chargement && !p.erreur ? <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.xl }} /> : <>
      <Text style={ui.productName}>{p.erreur ? 'Aperçu indisponible pour le moment.' : 'Ce produit n’est pas dans ton catalogue.'}</Text>
      <Text style={ui.subtitle}>{p.erreur ?? 'Scanne-le pour l’ajouter à tes produits.'}</Text>
    </>}
  </View>;

  const detail = [produit.brand, formaterContenance(produit)].filter(Boolean).join(' · ');
  return <View style={s.feuille}>
    <View style={s.tete}>
      <View style={s.cadre}><Photo name={produit.name} url={produit.image_url} style={s.photo} /></View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.nom} numberOfLines={3}>{produit.name}</Text>
        {!!detail && <Text style={ui.detail} numberOfLines={1}>{detail}</Text>}
        <View style={{ alignSelf: 'flex-start' }}><PastilleNutri note={produit.nutriscore} /></View>
      </View>
    </View>
    <DernierPrix produitId={produit.id} ean13={produit.ean13} />
    <View style={{ gap: spacing.sm }}>
      <Action onPress={() => router.replace({ pathname: '/produit/[id]', params: { id: produit.id } })}>Voir la fiche</Action>
      <Action secondary disabled={ajoute} onPress={() => { w.ajouterProduitListe(produit.id); setAjoute(true); }}>{ajoute ? 'Ajouté à ta liste' : 'Ajouter à ma liste'}</Action>
    </View>
  </View>;
}

/** Le dernier prix payé, son jour et son marchand, et l'écart depuis le premier achat. */
function DernierPrix({ produitId, ean13 }: { produitId: string; ean13: string | null }) {
  const { historique: h, chargement, erreur } = useHistoriquePrix(produitId, ean13);
  if (chargement) return <View style={s.prix}><ActivityIndicator color={colors.accent} /></View>;
  if (erreur) return <Text style={ui.error}>{erreur}</Text>;
  if (!h.dernier) return <View style={s.prix}><Feather name="tag" size={16} color={colors.textMuted} /><Text style={ui.detail}>Jamais acheté pour l’instant : son prix viendra avec la première commande.</Text></View>;
  const d = h.dernier, enseigne = ENSEIGNES[d.drive] ?? d.drive, marchand = d.lieu === enseigne ? enseigne : `${enseigne} ${d.lieu}`;
  const stable = h.ecart != null && Math.abs(h.ecart) < 0.01;
  return <View style={s.prix} accessible accessibilityLabel={`Dernier prix payé : ${euros(d.paye)}, le ${jourLong(d.jour)} chez ${marchand}${h.ecart != null ? `, ${stable ? 'stable' : pourcent(h.ecart)} depuis le premier achat` : ''}`}>
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={s.etiquette}>Dernier prix payé</Text>
      <Text style={ui.detail}>{jourLong(d.jour)} · {marchand}</Text>
    </View>
    <View style={{ alignItems: 'flex-end', gap: 2 }}>
      <Text style={s.montant}>{euros(d.paye)}</Text>
      {h.ecart != null && <Text style={[s.ecart, { color: teinteEcart(h.ecart, colors.textMuted) }]}>{stable ? 'stable' : pourcent(h.ecart)} en {h.achats.length} achats</Text>}
    </View>
  </View>;
}

const s = StyleSheet.create({
  feuille: { backgroundColor: colors.bg, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.sm, gap: spacing.lg },
  tete: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  cadre: { width: 88, height: 88, borderRadius: 16, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', padding: 6 },
  photo: { width: '100%', height: '100%', borderRadius: 0 },
  nom: { fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  prix: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 64 },
  etiquette: { fontSize: 15, fontWeight: '600', color: colors.text },
  montant: { fontSize: 22, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  ecart: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
