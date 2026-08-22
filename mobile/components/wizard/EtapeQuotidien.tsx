import { useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { PileSwipe } from './PileSwipe';
import { EtatVide } from '../EtatVide';
import { PastilleNutri } from '../PastilleNutri';
import { useWizard } from '../../contexts/WizardContext';
import { useProducts, type Product } from '../../stores/products';
import { colors, radius, spacing } from '../../lib/theme';

function CarteProduit({ produit }: { produit: Product }) {
  return (
    <View style={s.carte}>
      {produit.image_url
        ? <Image source={{ uri: produit.image_url }} style={s.image} />
        : <View style={[s.image, s.imageVide]} />}
      <View style={s.carteTexte}>
        <Text style={s.carteTitre} numberOfLines={2}>{produit.name}</Text>
        {produit.brand && <Text style={s.carteDetail}>{produit.brand}</Text>}
      </View>
      <PastilleNutri note={produit.nutriscore} />
    </View>
  );
}

export function EtapeQuotidien() {
  const { produits, chargement } = useProducts();
  const w = useWizard();
  const [ajout, setAjout] = useState('');

  const favoris = produits.filter((p) => p.favorite);
  const aAcheter = produits.filter((p) => w.quotidien[p.id] === 'needed');

  if (chargement && produits.length === 0) {
    return <View style={s.centre}><ActivityIndicator color={colors.accent} /></View>;
  }

  return (
    <View style={s.bloc}>
      <View style={s.pile}>
        {favoris.length > 0 ? (
          <PileSwipe
            items={favoris}
            getId={(p) => p.id}
            onAccepter={(p) => w.marquerProduit(p.id, 'needed')}
            onRejeter={(p) => w.marquerProduit(p.id, 'have')}
            rendreCarte={(p) => <CarteProduit produit={p} />}
            etatVide={<EtatVide titre="Tu as passé tous tes favoris en revue." />}
          />
        ) : (
          <EtatVide titre="Aucun favori">
            Scanne des produits chez toi : ils apparaîtront ici pour composer ton quotidien.
          </EtatVide>
        )}
      </View>

      <Text style={s.consigne}>Droite : il m&apos;en faut · Gauche : j&apos;en ai déjà</Text>

      <ScrollView style={s.liste} contentContainerStyle={s.listeContenu}>
        {aAcheter.length > 0 && (
          <>
            <Text style={s.sousTitre}>{`À acheter (${aAcheter.length})`}</Text>
            {aAcheter.map((p) => {
              const qte = w.quotidienQty[p.id] ?? 1;
              return (
                <View key={p.id} style={s.ligne}>
                  <Text style={s.ligneNom} numberOfLines={1}>{p.name}</Text>
                  <View style={s.parts}>
                    <Pressable style={s.pas} onPress={() => w.setQuantite(p.id, qte - 1)} hitSlop={6}>
                      <Text style={s.pasTexte}>−</Text>
                    </Pressable>
                    <Text style={s.partsTexte}>{qte}</Text>
                    <Pressable style={s.pas} onPress={() => w.setQuantite(p.id, qte + 1)} hitSlop={6}>
                      <Text style={s.pasTexte}>+</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {w.extras.length > 0 && (
          <>
            <Text style={s.sousTitre}>Ajouts manuels</Text>
            {w.extras.map((e) => (
              <View key={e.id} style={s.ligne}>
                <Text style={s.ligneNom} numberOfLines={1}>{e.name}</Text>
                <Pressable onPress={() => w.retirerExtra(e.id)} hitSlop={8}>
                  <Text style={s.retirer}>Retirer</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}

        <Text style={s.sousTitre}>Ajouter un article</Text>
        <View style={s.ajoutRangee}>
          <TextInput
            style={s.champ}
            value={ajout}
            onChangeText={setAjout}
            placeholder="Piles AA"
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={() => {
              if (!ajout.trim()) return;
              w.ajouterExtra({ name: ajout.trim(), quantity: 1, unit: 'unité', rayon: 'autre' });
              setAjout('');
            }}
            returnKeyType="done"
          />
          <Pressable
            style={[s.ajouter, !ajout.trim() && s.desactive]}
            disabled={!ajout.trim()}
            onPress={() => {
              w.ajouterExtra({ name: ajout.trim(), quantity: 1, unit: 'unité', rayon: 'autre' });
              setAjout('');
            }}
          >
            <Text style={s.ajouterTexte}>Ajouter</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  bloc: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pile: { height: 200, marginHorizontal: spacing.lg },
  carte: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg, minHeight: 160,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  image: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.bg },
  imageVide: { borderWidth: 1, borderColor: colors.border },
  carteTexte: { flex: 1, gap: spacing.xs },
  carteTitre: { fontSize: 17, fontWeight: '700', color: colors.text },
  carteDetail: { fontSize: 14, color: colors.textMuted },
  consigne: {
    fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm,
  },
  liste: { flex: 1, marginTop: spacing.md },
  listeContenu: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  sousTitre: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginTop: spacing.md },
  ligne: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md,
  },
  ligneNom: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  parts: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pas: {
    width: 28, height: 28, borderRadius: radius.pill, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  pasTexte: { fontSize: 16, fontWeight: '700', color: colors.text },
  partsTexte: { fontSize: 14, color: colors.text, minWidth: 24, textAlign: 'center' },
  retirer: { fontSize: 13, fontWeight: '600', color: colors.danger },
  ajoutRangee: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  champ: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: 15, color: colors.text, backgroundColor: colors.surface,
  },
  ajouter: {
    borderRadius: radius.md, backgroundColor: colors.accent,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
  },
  ajouterTexte: { color: colors.accentContrast, fontWeight: '700', fontSize: 14 },
  desactive: { opacity: 0.4 },
});
