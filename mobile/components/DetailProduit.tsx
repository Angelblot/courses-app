import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { Product } from '../stores/products';
import { basculerFavori } from '../stores/products';
import { PastilleNutri } from './PastilleNutri';
import { libelleRayon, rayonDepuisLibelle } from '../lib/rayons.ts';
import { colors, radius, spacing, texte } from '../lib/theme';

/** Contenance lisible : « 200 g », « 1,5 L », ou rien. */
function contenance(p: Product): string | null {
  if (p.grammage_g != null) return `${p.grammage_g} g`;
  if (p.volume_ml != null) {
    return p.volume_ml >= 1000
      ? `${String(p.volume_ml / 1000).replace('.', ',')} L`
      : `${p.volume_ml} ml`;
  }
  return null;
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <View style={s.ligne}>
      <Text style={s.libelle}>{libelle}</Text>
      <Text style={s.valeur} selectable>{valeur}</Text>
    </View>
  );
}

/**
 * Fiche détaillée d'un produit, en feuille montant du bas.
 *
 * Une feuille plutôt qu'un écran : on consulte une fiche en passant, au milieu
 * d'une liste qu'on parcourt, et il faut pouvoir en sortir d'un geste sans
 * perdre sa place.
 *
 * Les champs vides ne s'affichent pas. Une ligne « Code-barres : — » n'apprend
 * rien et allonge la fiche.
 */
export function DetailProduit({
  produit, onFermer, onChange,
}: {
  produit: Product | null;
  onFermer: () => void;
  onChange?: () => void;
}) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  if (!produit) return null;

  const taille = contenance(produit);
  const rayon = libelleRayon(rayonDepuisLibelle(produit.category));

  const changerFavori = async () => {
    if (enCours) return;
    setEnCours(true);
    setErreur(null);
    const r = await basculerFavori(produit.id, !produit.favorite);
    setEnCours(false);
    if (r.ok) onChange?.();
    else setErreur(r.erreur ?? 'Impossible de modifier ce produit.');
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onFermer}>
      <SafeAreaView style={s.ecran}>
        <View style={s.entete}>
          <Pressable onPress={onFermer} hitSlop={8}>
            <Text style={s.fermer}>Fermer</Text>
          </Pressable>
          <View style={s.equilibre} />
        </View>

        <ScrollView contentContainerStyle={s.corps}>
          <View style={s.cadreImage}>
            {produit.image_url
              ? <Image source={{ uri: produit.image_url }} style={s.image} resizeMode="contain" />
              : <Feather name="shopping-bag" size={48} color={colors.traitPastille} />}
          </View>

          <Text style={s.nom}>{produit.name}</Text>
          {produit.brand && <Text style={s.marque}>{produit.brand}</Text>}

          <View style={s.nutri}><PastilleNutri note={produit.nutriscore} /></View>

          <Pressable
            style={[s.favori, produit.favorite && s.favoriActif]}
            onPress={changerFavori}
            disabled={enCours}
          >
            <Feather
              name="star"
              size={16}
              color={produit.favorite ? colors.accentContrast : colors.accent}
            />
            <Text style={[s.favoriTexte, produit.favorite && s.favoriTexteActif]}>
              {produit.favorite ? 'Dans mon quotidien' : 'Ajouter à mon quotidien'}
            </Text>
          </Pressable>
          <Text style={s.aide}>
            Les produits du quotidien sont ceux que le wizard te propose de passer en revue.
          </Text>

          {erreur && <Text style={s.erreur}>{erreur}</Text>}

          <View style={s.fiche}>
            <Ligne libelle="Rayon" valeur={rayon} />
            {taille && <Ligne libelle="Contenance" valeur={taille} />}
            <Ligne libelle="Unité" valeur={produit.unit} />
            {produit.nutriscore && <Ligne libelle="Nutriscore" valeur={produit.nutriscore.toUpperCase()} />}
            {produit.product_type && <Ligne libelle="Typologie" valeur={produit.product_type} />}
            {produit.ean13 && <Ligne libelle="Code-barres" valeur={produit.ean13} />}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  entete: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  fermer: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  equilibre: { width: 56 },
  corps: { padding: spacing.xl, paddingBottom: spacing.xxl, alignItems: 'center' },
  cadreImage: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.traitPastille,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  image: { width: 136, height: 136, borderRadius: 68 },
  nom: { fontSize: 20, fontWeight: '600', color: colors.text, textAlign: 'center' },
  marque: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  nutri: { marginTop: spacing.md },
  favori: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.accent, borderRadius: radius.pill,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  favoriActif: { backgroundColor: colors.accent },
  favoriTexte: { fontSize: 14, fontWeight: '600', color: colors.accent },
  favoriTexteActif: { color: colors.accentContrast },
  aide: {
    fontSize: 12, color: colors.textMuted, textAlign: 'center',
    marginTop: spacing.sm, lineHeight: 17, maxWidth: 280,
  },
  erreur: { color: colors.danger, fontSize: 13, marginTop: spacing.md, textAlign: 'center' },
  fiche: {
    alignSelf: 'stretch', backgroundColor: colors.surface,
    borderRadius: radius.card, padding: spacing.lg, marginTop: spacing.xl,
  },
  ligne: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, gap: spacing.lg,
  },
  libelle: { ...texte.pastille, fontSize: 14, color: colors.textMuted },
  valeur: { fontSize: 14, fontWeight: '600', color: colors.text, flexShrink: 1, textAlign: 'right' },
});
