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
  /** Mise en attente d'un scan hors ligne, voir l'état `hors_ligne` plus bas. */
  onMettreEnAttente: () => void;
  onIgnorer: () => void;
};

export function FicheScannee({
  resultat, ean, chargement, message, onAjouter, onAjouterManuel, onMettreEnAttente, onIgnorer,
}: Props) {
  const [nom, setNom] = useState('');
  const [marque, setMarque] = useState('');
  // Hors ligne, la mise en attente est l'issue par défaut (voir plus bas) :
  // la saisie manuelle reste possible mais se déplie sur demande plutôt que
  // de s'imposer, pour ne pas laisser croire qu'elle est le seul chemin.
  const [saisieManuelle, setSaisieManuelle] = useState(false);

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
      ) : horsLigne && !saisieManuelle ? (
        <>
          {/* La spécification promet : « hors connexion, la fiche est mise
              en attente et l'ajout se fait au retour du réseau » (voir aussi
              le commentaire de `lookupEan` dans lib/openfoodfacts.ts). C'est
              donc l'issue par défaut ici, pas la saisie manuelle — celle-ci
              reste offerte en second choix pour qui veut le produit tout de
              suite, mais un simple « Fermer » ne doit plus jamais faire
              disparaître le scan sans rien mettre en attente. */}
          <Text style={s.nom}>Réseau indisponible</Text>
          <Text style={s.detail}>
            {`Impossible de joindre Open Food Facts pour le code ${ean}. Mets-le en attente : il sera ajouté automatiquement dès que le réseau reviendra.`}
          </Text>

          {message && (
            <Text style={[s.message, message.erreur && s.messageErreur]}>
              {message.texte}
            </Text>
          )}

          <View style={s.actions}>
            <Pressable style={[s.bouton, s.secondaire]} onPress={onIgnorer}>
              <Text style={s.secondaireTexte}>Fermer</Text>
            </Pressable>
            <Pressable style={[s.bouton, s.principal]} onPress={onMettreEnAttente}>
              <Text style={s.principalTexte}>Mettre en attente</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => setSaisieManuelle(true)}>
            <Text style={s.lien}>Saisir le produit à la main plutôt</Text>
          </Pressable>
        </>
      ) : (
        <>
          {/* Produit inconnu d'Open Food Facts, ou saisie manuelle choisie
              malgré le réseau absent (voir le lien ci-dessus) : dans un cas
              le produit n'existe pas au catalogue Open Food Facts, dans
              l'autre on n'a pas pu le lui demander — mais l'action est la
              même dans les deux cas. */}
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
  lien: {
    color: colors.textMuted, fontSize: 13, fontWeight: '600',
    textAlign: 'center', textDecorationLine: 'underline',
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: spacing.xs },
  champ: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: 16, color: colors.text,
  },
});
