import { useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { PileSwipe } from './PileSwipe';
import { EtatVide } from '../EtatVide';
import { PastilleNutri } from '../PastilleNutri';
import { useWizard } from '../../contexts/WizardContext';
import { useProducts, type Product } from '../../stores/products';
import { colors, radius, spacing } from '../../lib/theme';

/**
 * Carte verticale : l'image occupe le haut, le texte le bas.
 *
 * La disposition horizontale d'origine recadrait l'image dans un carré de
 * 72 points — on ne reconnaissait pas le produit, ce qui est pourtant le seul
 * moyen de décider d'un coup d'œil.
 */
function CarteProduit({ produit }: { produit: Product }) {
  const contenance = produit.grammage_g != null
    ? `${produit.grammage_g} g`
    : produit.volume_ml != null ? `${produit.volume_ml} ml` : null;
  const detail = [produit.brand, contenance].filter(Boolean).join(' · ');

  return (
    <View style={s.carte}>
      {produit.image_url
        ? <Image source={{ uri: produit.image_url }} style={s.image} resizeMode="contain" />
        : <View style={[s.image, s.imageVide]} />}
      <View style={s.carteTexte}>
        <View style={s.carteLigne}>
          <Text style={s.carteTitre} numberOfLines={2}>{produit.name}</Text>
          <PastilleNutri note={produit.nutriscore} />
        </View>
        {detail.length > 0 && <Text style={s.carteDetail}>{detail}</Text>}
      </View>
    </View>
  );
}

function LigneRetenue({ produit, quantite, onMoins, onPlus }: {
  produit: Product; quantite: number; onMoins: () => void; onPlus: () => void;
}) {
  return (
    <View style={s.ligne}>
      {produit.image_url
        ? <Image source={{ uri: produit.image_url }} style={s.vignette} resizeMode="contain" />
        : <View style={[s.vignette, s.imageVide]} />}
      <Text style={s.ligneNom} numberOfLines={2}>{produit.name}</Text>
      <View style={s.compteur}>
        <Pressable style={s.pas} onPress={onMoins} hitSlop={6}>
          <Text style={s.pasTexte}>−</Text>
        </Pressable>
        <Text style={s.compteurTexte}>{quantite}</Text>
        <Pressable style={s.pas} onPress={onPlus} hitSlop={6}>
          <Text style={s.pasTexte}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function EtapeQuotidien() {
  const { produits, chargement } = useProducts();
  const w = useWizard();
  // La liste reste repliée : la déplier casserait l'attention portée à la
  // carte, qui est tout l'intérêt du geste.
  const [listeOuverte, setListeOuverte] = useState(false);

  const favoris = produits.filter((p) => p.favorite);
  const aAcheter = produits.filter((p) => w.quotidien[p.id] === 'needed');

  if (chargement && produits.length === 0) {
    return <View style={s.centre}><ActivityIndicator color={colors.accent} /></View>;
  }

  if (favoris.length === 0) {
    return (
      <View style={s.centre}>
        <EtatVide titre="Aucun favori">
          Scanne des produits chez toi : ils apparaîtront ici pour composer ton quotidien.
        </EtatVide>
      </View>
    );
  }

  return (
    <View style={s.bloc}>
      {/*
        La pile reste montée quand la liste s'ouvre : `display: 'none'` la
        masque sans la détruire. La démonter remettait son index à zéro, et
        toutes les cartes déjà passées revenaient — les décisions, elles,
        survivaient, puisqu'elles vivent dans le contexte. La position dans la
        pile est un état du wizard, pas de l'affichage.
      */}
      <View style={[s.masquable, listeOuverte && s.masquee]}>
        <>
          <View style={s.pile}>
            <PileSwipe
              items={favoris}
              getId={(p) => p.id}
              onAccepter={(p) => w.marquerProduit(p.id, 'needed')}
              onRejeter={(p) => w.marquerProduit(p.id, 'have')}
              rendreCarte={(p) => <CarteProduit produit={p} />}
              etatVide={<EtatVide titre="Tu as passé tous tes favoris en revue." />}
            />
          </View>
          <Text style={s.consigne}>
            Droite : il m&apos;en faut · Gauche : j&apos;en ai déjà
          </Text>
        </>
      </View>

      <Pressable style={s.bascule} onPress={() => setListeOuverte((v) => !v)}>
        <Text style={s.basculeTexte}>
          {listeOuverte
            ? 'Revenir aux cartes'
            : `Voir ma liste (${aAcheter.length})`}
        </Text>
      </Pressable>

      {listeOuverte && (
        <ScrollView style={s.liste} contentContainerStyle={s.listeContenu}>
          {aAcheter.length === 0 ? (
            <EtatVide titre="Rien de retenu pour l'instant">
              Fais glisser une carte vers la droite pour l&apos;ajouter.
            </EtatVide>
          ) : (
            aAcheter.map((p) => (
              <LigneRetenue
                key={p.id}
                produit={p}
                quantite={w.quotidienQty[p.id] ?? 1}
                onMoins={() => w.setQuantite(p.id, (w.quotidienQty[p.id] ?? 1) - 1)}
                onPlus={() => w.setQuantite(p.id, (w.quotidienQty[p.id] ?? 1) + 1)}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { flex: 1 },
  masquable: { flex: 1 },
  masquee: { display: 'none' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pile: { flex: 1, marginHorizontal: spacing.lg },
  carte: {
    flex: 1,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, overflow: 'hidden',
  },
  image: { flex: 1, width: '100%', backgroundColor: colors.bg },
  imageVide: { borderBottomWidth: 1, borderBottomColor: colors.border },
  carteTexte: { padding: spacing.lg, gap: spacing.xs },
  carteLigne: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: spacing.md,
  },
  carteTitre: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.text },
  carteDetail: { fontSize: 15, color: colors.textMuted },
  consigne: {
    fontSize: 12, color: colors.textMuted, textAlign: 'center',
    marginTop: spacing.md,
  },
  bascule: {
    alignSelf: 'center', marginTop: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
  },
  basculeTexte: { fontSize: 13, fontWeight: '700', color: colors.accent },
  liste: { flex: 1, marginTop: spacing.md },
  listeContenu: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  ligne: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  vignette: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.bg },
  ligneNom: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  compteur: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pas: {
    width: 28, height: 28, borderRadius: radius.pill, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  pasTexte: { fontSize: 16, fontWeight: '700', color: colors.text },
  compteurTexte: { fontSize: 14, color: colors.text, minWidth: 20, textAlign: 'center' },
});
