import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useWizard } from '../../contexts/WizardContext';
import { useRecipes } from '../../stores/recipes';
import { useProducts } from '../../stores/products';
import { buildConsolidatedItems, construireItems } from '../../lib/consolidation.ts';
import { envoyerListe } from '../../lib/cart-jobs.ts';
import { useSuiviTravail } from '../../stores/suivi';
import { libelleEtat, libelleDrive, resume } from '../../lib/suivi-libelles.ts';
import { colors, radius, spacing } from '../../lib/theme';

const DRIVES = [
  { cle: 'carrefour', label: 'Carrefour' },
  { cle: 'leclerc', label: 'E.Leclerc' },
];

export function EtapeGeneration() {
  const { recettes } = useRecipes();
  const { produits } = useProducts();
  const w = useWizard();
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const { travail } = useSuiviTravail(jobId);

  const items = useMemo(() => construireItems(buildConsolidatedItems({
    recipes: recettes,
    selectedRecipes: w.selectedRecipes,
    quotidien: w.quotidien,
    quotidienQty: w.quotidienQty,
    extras: w.extras,
    products: produits,
  })), [recettes, produits, w.selectedRecipes, w.quotidien, w.quotidienQty, w.extras]);

  const envoyer = async () => {
    if (enCours) return;
    setEnCours(true);
    setErreur(null);
    const r = await envoyerListe(items, w.drives);
    setEnCours(false);
    if (r.ok && r.id) setJobId(r.id);
    else setErreur(r.erreur ?? "Impossible d'envoyer la liste.");
  };

  if (jobId) {
    // Le bilan par enseigne n'existe qu'une fois le remplissage terminé ou
    // interrompu ; on ne l'affiche pas avant, il serait vide.
    const bilan = travail?.results ?? null;
    const manquants = bilan
      ? Object.entries(bilan).flatMap(([drive, lignes]) =>
          (lignes ?? []).filter((l) => !l.ok).map((l) => ({ drive, ...l })))
      : [];

    return (
      <ScrollView contentContainerStyle={s.suivi}>
        <Text style={s.confirmeTitre}>
          {travail ? libelleEtat(travail.status) : 'Liste envoyée'}
        </Text>
        <Text style={s.confirmeCorps}>
          {travail
            ? resume(travail)
            : "Ouvre l'extension sur ton Mac : elle attend ton feu vert."}
        </Text>

        {manquants.length > 0 && (
          <View style={s.manquants}>
            <Text style={s.manquantsTitre}>
              {`${manquants.length} produit${manquants.length > 1 ? 's' : ''} non ajouté${manquants.length > 1 ? 's' : ''}`}
            </Text>
            {manquants.map((m, i) => (
              <Text key={`${m.drive}-${i}`} style={s.manquant} numberOfLines={2}>
                {`${m.item} — ${libelleDrive(m.drive)}`}
              </Text>
            ))}
          </View>
        )}

        <Pressable
          style={s.bouton}
          onPress={() => { w.reinitialiser(); router.replace('/'); }}
        >
          <Text style={s.boutonTexte}>Terminer</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.contenu}>
      <Text style={s.resume}>
        {`${items.length} article${items.length > 1 ? 's' : ''} à envoyer`}
      </Text>

      <Text style={s.label}>Drives</Text>
      {DRIVES.map((d) => {
        const actif = w.drives.includes(d.cle);
        return (
          <Pressable
            key={d.cle}
            style={[s.drive, actif && s.driveActif]}
            onPress={() => w.basculerDrive(d.cle)}
          >
            <Text style={[s.driveTexte, actif && s.driveTexteActif]}>{d.label}</Text>
          </Pressable>
        );
      })}

      {erreur && <Text style={s.erreur}>{erreur}</Text>}

      <Pressable
        style={[s.bouton, (w.drives.length === 0 || items.length === 0) && s.desactive]}
        onPress={envoyer}
        disabled={enCours || w.drives.length === 0 || items.length === 0}
      >
        {enCours
          ? <ActivityIndicator color={colors.accentContrast} />
          : <Text style={s.boutonTexte}>Envoyer la liste</Text>}
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  contenu: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  centre: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl, gap: spacing.sm,
  },
  resume: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: spacing.md },
  drive: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.lg, backgroundColor: colors.surface,
  },
  driveActif: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  driveTexte: { fontSize: 16, fontWeight: '600', color: colors.text },
  driveTexteActif: { color: colors.accent, fontWeight: '700' },
  erreur: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  bouton: {
    backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.lg,
    alignItems: 'center', marginTop: spacing.lg, alignSelf: 'stretch',
  },
  boutonTexte: { color: colors.accentContrast, fontWeight: '700', fontSize: 16 },
  desactive: { opacity: 0.4 },
  confirmeTitre: { fontSize: 22, fontWeight: '800', color: colors.text },
  confirmeCorps: {
    fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 21,
  },
  suivi: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl, gap: spacing.sm,
  },
  manquants: {
    alignSelf: 'stretch', marginTop: spacing.lg, gap: spacing.xs,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.lg,
  },
  manquantsTitre: { fontSize: 13, fontWeight: '700', color: colors.danger },
  manquant: { fontSize: 14, color: colors.text },
});
