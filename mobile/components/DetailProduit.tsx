import { Action, Photo, ui } from './MaisonUI';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { Product } from '../stores/products';
import { modifierProduit } from '../stores/products';
import { PastilleNutri } from './PastilleNutri';
import { ReprisePhoto } from './ReprisePhoto';
import { ClassementProduit } from './ClassementProduit';
import { ReglagesProduit } from './ReglagesProduit';
import { SelecteurRayon } from './SelecteurRayon';
import { ActualiserSheet } from './ActualiserSheet';
import { SupprimerSheet } from './SupprimerSheet';
import { libelleRayon, rayonDepuisLibelle, type CleRayon } from '../lib/rayons.ts';
import { champsModifies, formaterContenance, lireContenance } from '../lib/fiche-produit.ts';
import { colors, radius, spacing, texte } from '../lib/theme';

/** Ce qu'on peut ouvrir directement depuis l'appui long de la grille. */
export type OuvertureFiche = 'consulter' | 'modifier' | 'actualiser' | 'supprimer';

function Ligne({ libelle, valeur, chiffres = false }: { libelle: string; valeur: string; chiffres?: boolean }) {
  return (
    <View style={s.ligne}>
      <Text style={s.libelle}>{libelle}</Text>
      {/* Un code-barres coupé en trois lignes ne se relit plus : il rétrécit plutôt. */}
      <Text style={[s.valeur, chiffres && s.chiffres]} selectable numberOfLines={chiffres ? 1 : undefined} adjustsFontSizeToFit={chiffres}>{valeur}</Text>
    </View>
  );
}

function Champ({ libelle, valeur, onChange, placeholder, erreur }: {
  libelle: string; valeur: string; onChange: (v: string) => void; placeholder?: string; erreur?: string | null;
}) {
  return (
    <View style={s.champ}>
      <Text style={s.libelle}>{libelle}</Text>
      <TextInput accessibilityLabel={libelle} value={valeur} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={colors.textMuted} style={[s.saisie, !!erreur && { borderColor: colors.danger }]} />
      {!!erreur && <Text style={s.erreurChamp}>{erreur}</Text>}
    </View>
  );
}

/**
 * Fiche détaillée d'un produit, en feuille montant du bas (variante B : la
 * barre de Contacts). « Fermer » à gauche, « Modifier » à droite ; en
 * modification, « Annuler » et « OK ». Actualiser et Supprimer vivent en
 * bas de la fiche, visibles sans menu.
 *
 * Les champs vides ne s'affichent pas. Une ligne « Code-barres : — » n'apprend
 * rien et allonge la fiche.
 */
export function DetailProduit({
  produit, produits, onFermer, onChange, onAjouter, onSupprime, ouverture = 'consulter',
}: {
  produit: Product | null;
  /** Le catalogue, pour classer la référence et ses alternatives. */
  produits?: Product[];
  onFermer: () => void;
  onChange?: () => void;
  /** Ajoute le produit à la liste de courses (depuis Mes produits). */
  onAjouter?: () => void;
  /** Le produit vient d'être supprimé : l'appelant ferme et recharge. */
  onSupprime?: (p: Product) => void;
  ouverture?: OuvertureFiche;
}) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [edition, setEdition] = useState(false);
  const [brouillon, setBrouillon] = useState({ name: '', brand: '', contenance: '', category: 'autre' as CleRayon });
  const [choixRayon, setChoixRayon] = useState(false);
  const [feuille, setFeuille] = useState<'actualiser' | 'supprimer' | null>(null);

  const commencerEdition = (p: Product) => {
    setBrouillon({ name: p.name, brand: p.brand ?? '', contenance: formaterContenance(p) ?? '', category: rayonDepuisLibelle(p.category) });
    setChoixRayon(false); setErreur(null); setInfo(null); setEdition(true);
  };
  // Chaque ouverture repart de la fiche en lecture, ou du geste choisi dans
  // l'appui long de la grille.
  useEffect(() => {
    setEdition(false); setFeuille(null); setErreur(null); setInfo(null); setChoixRayon(false);
    if (!produit) return;
    if (ouverture === 'modifier') commencerEdition(produit);
    else if (ouverture === 'actualiser' || ouverture === 'supprimer') ouvrirFeuille(ouverture, produit);
  }, [produit?.id, ouverture]);

  if (!produit) return null;

  const taille = formaterContenance(produit);
  const rayon = libelleRayon(rayonDepuisLibelle(produit.category));
  const contenanceLue = lireContenance(brouillon.contenance);
  const nomVide = !brouillon.name.trim();

  function ouvrirFeuille(f: 'actualiser' | 'supprimer', p: Product) {
    setErreur(null); setInfo(null);
    if (f === 'actualiser' && !p.ean13) {
      setInfo('Ce produit n’a pas de code-barres : Open Food Facts ne peut pas le retrouver. Corrige-le avec « Modifier ».');
      return;
    }
    setFeuille(f);
  }

  const enregistrer = async () => {
    if (enCours || nomVide || !contenanceLue) return;
    const apres = {
      ...produit,
      name: brouillon.name.trim(),
      brand: brouillon.brand.trim() || null,
      grammage_g: contenanceLue.grammage_g,
      volume_ml: contenanceLue.volume_ml,
      category: brouillon.category,
    };
    const champs = champsModifies(produit, apres);
    if (!champs.length) { setEdition(false); return; }
    setEnCours(true); setErreur(null);
    const r = await modifierProduit(produit.id, {
      name: apres.name, brand: apres.brand, grammage_g: apres.grammage_g, volume_ml: apres.volume_ml, category: apres.category,
    }, champs);
    setEnCours(false);
    if (!r.ok) { setErreur(r.erreur ?? 'Impossible d’enregistrer la fiche pour le moment.'); return; }
    setEdition(false); setInfo('Fiche enregistrée.');
    onChange?.();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={edition ? () => setEdition(false) : onFermer}>
      <SafeAreaView style={s.ecran} edges={['bottom']}>
        <View style={s.barre}>
          <Pressable accessibilityRole="button" onPress={edition ? () => { setEdition(false); setErreur(null); } : onFermer} style={[s.bouton, { alignItems: 'flex-start' }]}>
            <Text style={s.boutonTexte}>{edition ? 'Annuler' : 'Fermer'}</Text>
          </Pressable>
          <Text style={s.titreBarre} numberOfLines={1} accessibilityRole="header">{edition ? 'Modifier' : produit.name}</Text>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: edition && (nomVide || !contenanceLue || enCours) }}
            disabled={edition && (nomVide || !contenanceLue || enCours)}
            onPress={edition ? enregistrer : () => commencerEdition(produit)} style={[s.bouton, { alignItems: 'flex-end' }]}>
            <Text style={[s.boutonTexte, s.boutonFort, edition && (nomVide || !contenanceLue || enCours) && { color: colors.offText }]}>{edition ? 'OK' : 'Modifier'}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={s.corps} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <View style={[s.cadreImage, edition && s.cadreImageReduit]}>
            <Photo name={produit.name} url={produit.image_url} style={edition ? s.imageReduite : s.image} />
          </View>

          {edition ? <>
            <View style={s.formulaire}>
              <Champ libelle="Nom" valeur={brouillon.name} onChange={(name) => setBrouillon((b) => ({ ...b, name }))} erreur={nomVide ? 'Un produit a besoin d’un nom.' : null} />
              <Champ libelle="Marque" valeur={brouillon.brand} placeholder="Facultatif" onChange={(brand) => setBrouillon((b) => ({ ...b, brand }))} />
              <Champ libelle="Contenance" valeur={brouillon.contenance} placeholder="150 g, 1,5 L, 75 cl" onChange={(contenance) => setBrouillon((b) => ({ ...b, contenance }))}
                erreur={contenanceLue ? null : 'Écris un nombre et une unité : 150 g, 1,5 L, 75 cl.'} />
            </View>
            {choixRayon
              ? <View style={s.selecteur}><SelecteurRayon valeur={brouillon.category} onChoisir={(category) => { setBrouillon((b) => ({ ...b, category })); setChoixRayon(false); }} onFermer={() => setChoixRayon(false)} /></View>
              : <Pressable accessibilityRole="button" accessibilityLabel={`Rayon : ${libelleRayon(brouillon.category)}. Changer`} onPress={() => setChoixRayon(true)} style={s.ligneChoix}>
                  <Text style={s.libelle}>Rayon</Text>
                  <View style={s.valeurChoix}><Text style={[s.valeur, { color: colors.accent }]}>{libelleRayon(brouillon.category)}</Text><Feather name="chevron-right" size={18} color={colors.accent} /></View>
                </Pressable>}
            {erreur && <Text accessibilityLiveRegion="polite" style={s.erreur}>{erreur}</Text>}
          </> : <>
            <ReprisePhoto key={produit.id} produitId={produit.id} nom={produit.name} onChange={onChange} />

            <Text style={s.nom}>{produit.name}</Text>
            {(produit.brand || taille) && <Text style={s.marque}>{[produit.brand, taille].filter(Boolean).join(' · ')}</Text>}
            <View style={s.nutri}><PastilleNutri note={produit.nutriscore} /></View>

            {info && <Text accessibilityLiveRegion="polite" style={s.info}>{info}</Text>}
            {erreur && <Text accessibilityLiveRegion="polite" style={s.erreur}>{erreur}</Text>}

            {onAjouter && <View style={s.actions}><Action onPress={onAjouter}>Ajouter à ma liste</Action></View>}

            {produits && <ClassementProduit produit={produit} produits={produits} onChange={onChange} />}
            {produits && <ReglagesProduit produit={produit} produits={produits} onChange={onChange} />}

            <View style={s.fiche}>
              <Ligne libelle="Rayon" valeur={rayon} />
              {taille && <Ligne libelle="Contenance" valeur={taille} />}
              <Ligne libelle="Vendu" valeur={produit.unit === 'unité' ? 'À l’unité' : produit.unit} />
              {produit.ean13 && <Ligne libelle="Code-barres" valeur={produit.ean13} chiffres />}
            </View>

            <View style={s.liste}>
              <Pressable accessibilityRole="button" onPress={() => ouvrirFeuille('actualiser', produit)} style={({ pressed }) => [s.item, pressed && s.itemPresse]}>
                <Feather name="refresh-cw" size={18} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTexte}>Actualiser les infos</Text>
                  <Text style={s.itemSous}>Depuis Open Food Facts</Text>
                </View>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => ouvrirFeuille('supprimer', produit)} style={({ pressed }) => [s.item, s.itemSepare, pressed && s.itemPresse]}>
                <Feather name="trash-2" size={18} color={colors.danger} />
                <Text style={[s.itemTexte, { color: colors.danger }]}>Supprimer le produit</Text>
              </Pressable>
            </View>
          </>}
        </ScrollView>
      </SafeAreaView>

      <ActualiserSheet produit={produit} visible={feuille === 'actualiser'} onFermer={() => setFeuille(null)}
        onApplique={(n) => { setFeuille(null); setInfo(n > 1 ? `${n} infos mises à jour.` : 'Fiche mise à jour.'); onChange?.(); }} />
      <SupprimerSheet produit={produit} produits={produits ?? []} visible={feuille === 'supprimer'} onFermer={() => setFeuille(null)}
        onSupprime={() => { setFeuille(null); onSupprime?.(produit); }} />
    </Modal>
  );
}

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  barre: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, minHeight: 52,
  },
  bouton: { minWidth: 72, minHeight: 44, justifyContent: 'center' },
  boutonTexte: { fontSize: 17, color: colors.accent },
  boutonFort: { fontWeight: '600' },
  titreBarre: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.text },
  corps: { padding: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl, alignItems: 'center' },
  cadreImage: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.traitPastille,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  cadreImageReduit: { width: 96, height: 96, borderRadius: 48 },
  image: { width: 136, height: 136, borderRadius: 68 },
  imageReduite: { width: 80, height: 80, borderRadius: 40 },
  nom: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center', letterSpacing: -0.3 },
  marque: { fontSize: 15, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  nutri: { marginTop: spacing.md },
  info: { ...texte.pastille, fontSize: 14, color: colors.accent, marginTop: spacing.md, textAlign: 'center' },
  erreur: { color: colors.danger, fontSize: 14, marginTop: spacing.md, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.lg },
  fiche: {
    alignSelf: 'stretch', backgroundColor: colors.surface,
    borderRadius: radius.card, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.xl,
  },
  ligne: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, gap: spacing.lg,
  },
  libelle: { ...texte.pastille, fontSize: 15, color: colors.textMuted },
  valeur: { fontSize: 15, fontWeight: '600', color: colors.text, flexShrink: 1, textAlign: 'right' },
  chiffres: { fontVariant: ['tabular-nums'] },
  liste: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.card, marginTop: spacing.md, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  itemSepare: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  itemPresse: { backgroundColor: colors.off },
  itemTexte: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.text },
  itemSous: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  formulaire: { alignSelf: 'stretch', gap: spacing.md },
  champ: { gap: 6 },
  saisie: { ...ui.input },
  erreurChamp: { fontSize: 13, color: colors.danger },
  ligneChoix: {
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg,
    minHeight: 52, marginTop: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.card,
  },
  valeurChoix: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  selecteur: { alignSelf: 'stretch', marginTop: spacing.lg },
});
