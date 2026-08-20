import { useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import type { ResultatRecherche } from '../lib/openfoodfacts.ts';
import { colors, radius, spacing } from '../lib/theme';

type Message = { texte: string; erreur: boolean };

type Props = {
  resultat: ResultatRecherche | null;
  ean: string;
  chargement: boolean;
  message: Message | null;
  onAjouter: () => void;
  /** Saisie manuelle, quand Open Food Facts ne connaît pas le code. */
  onAjouterManuel: (nom: string, marque: string) => void;
  onIgnorer: () => void;
};

export function FicheScannee({
  resultat, ean, chargement, message, onAjouter, onAjouterManuel, onIgnorer,
}: Props) {
  const [nom, setNom] = useState('');
  const [marque, setMarque] = useState('');

  // Trois issues distinctes, trois écrans distincts : une fiche trouvée, un
  // produit qu'Open Food Facts ignore, et un réseau absent. Les confondre
  // priverait l'utilisateur de la bonne action à faire.
  const fiche = resultat?.etat === 'trouve' ? resultat.fiche : null;
  const horsLigne = resultat?.etat === 'hors_ligne';
  const contenance = fiche?.grammageG
    ? `${fiche.grammageG} g`
    : fiche?.volumeMl
      ? `${fiche.volumeMl} ml`
      : null;

  return (
    <View style={s.panneau}>
      {chargement ? (
        <View style={s.centre}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.attente}>Recherche du produit…</Text>
        </View>
      ) : fiche ? (
        <>
          <View style={s.entete}>
            {fiche.imageUrl
              ? <Image source={{ uri: fiche.imageUrl }} style={s.image} />
              : <View style={[s.image, s.imageVide]} />}
            <View style={s.texte}>
              <Text style={s.nom} numberOfLines={2}>{fiche.name}</Text>
              <Text style={s.detail}>
                {[fiche.brand, contenance].filter(Boolean).join(' · ') || ean}
              </Text>
            </View>
          </View>

          {message && (
            <Text style={[s.message, message.erreur && s.messageErreur]}>
              {message.texte}
            </Text>
          )}

          <View style={s.actions}>
            <Pressable style={[s.bouton, s.secondaire]} onPress={onIgnorer}>
              <Text style={s.secondaireTexte}>Ignorer</Text>
            </Pressable>
            <Pressable style={[s.bouton, s.principal]} onPress={onAjouter}>
              <Text style={s.principalTexte}>Ajouter aux favoris</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          {/* Produit inconnu et réseau absent appellent la même action — une
              saisie manuelle — mais pas la même explication : dans un cas le
              produit n'existe pas au catalogue Open Food Facts, dans l'autre
              on n'a pas pu le lui demander. */}
          <Text style={s.nom}>
            {horsLigne ? 'Réseau indisponible' : 'Produit inconnu'}
          </Text>
          <Text style={s.detail}>
            {horsLigne
              ? `Impossible de joindre Open Food Facts pour le code ${ean}. Ajoute le produit à la main, il entrera quand même dans ton catalogue.`
              : `Open Food Facts ne connaît pas le code ${ean}. Ajoute-le à la main : il entrera quand même dans ton catalogue.`}
          </Text>

          <Text style={s.label}>Nom du produit</Text>
          <TextInput
            style={s.champ}
            value={nom}
            onChangeText={setNom}
            placeholder="Lardons fumés"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />

          <Text style={s.label}>Marque</Text>
          <TextInput
            style={s.champ}
            value={marque}
            onChangeText={setMarque}
            placeholder="Herta"
            placeholderTextColor={colors.textMuted}
          />

          {message && (
            <Text style={[s.message, message.erreur && s.messageErreur]}>
              {message.texte}
            </Text>
          )}

          <View style={s.actions}>
            <Pressable style={[s.bouton, s.secondaire]} onPress={onIgnorer}>
              <Text style={s.secondaireTexte}>Fermer</Text>
            </Pressable>
            <Pressable
              style={[s.bouton, s.principal, !nom.trim() && s.desactive]}
              onPress={() => onAjouterManuel(nom.trim(), marque.trim())}
              disabled={!nom.trim()}
            >
              <Text style={s.principalTexte}>Ajouter</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  panneau: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface, padding: spacing.xl,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, gap: spacing.md,
  },
  centre: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  attente: { color: colors.textMuted, fontSize: 14 },
  entete: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  image: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.bg },
  imageVide: { borderWidth: 1, borderColor: colors.border },
  texte: { flex: 1, gap: spacing.xs },
  nom: { fontSize: 17, fontWeight: '700', color: colors.text },
  detail: { fontSize: 14, color: colors.textMuted },
  message: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  // Un doublon ou un échec d'ajout ne doit jamais se lire comme un succès :
  // même style que `message`, mais dans le ton d'alerte du thème.
  messageErreur: { color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  bouton: { flex: 1, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  principal: { backgroundColor: colors.accent },
  principalTexte: { color: colors.accentContrast, fontWeight: '700' },
  secondaire: { borderWidth: 1, borderColor: colors.border },
  secondaireTexte: { color: colors.textMuted, fontWeight: '600' },
  desactive: { opacity: 0.4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: spacing.xs },
  champ: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: 16, color: colors.text,
  },
});
