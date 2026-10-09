import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EtatVide } from '../../components/EtatVide';
import { useSuiviTravail, useTravailActif } from '../../stores/suivi';
import { libelleEtat, libelleDrive, resume } from '../../lib/suivi-libelles.ts';
import { estClos } from '../../lib/suivi-bandeau.ts';
import { colors, radius, spacing } from '../../lib/theme';
import { adresseReprise, bilanParDrive, nomDrive, raison, siteDrive, type BilanDrive, type LigneResultat, type Ton } from '../../lib/compte-rendu.ts';
import { Photo } from '../../components/MaisonUI';
import { useProducts } from '../../stores/products';

export default function SuiviTravail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { travail, chargement } = useSuiviTravail(id ?? null);
  const { acquitte } = useTravailActif();

  // Ouvrir le bilan d'un travail clos l'acquitte : c'est ce geste qui fait
  // disparaître le bandeau. Un travail encore en cours n'est pas acquitté —
  // il reste à signaler tant qu'il tourne.
  useEffect(() => {
    if (travail && estClos(travail.status)) acquitte(travail.id);
  }, [travail, acquitte]);

  if (chargement && !travail) {
    return <SafeAreaView style={s.centre}><ActivityIndicator color={colors.accent} /></SafeAreaView>;
  }

  if (!travail) {
    return (
      <SafeAreaView style={s.centre}>
        <EtatVide titre="Suivi introuvable">
          Ce remplissage n&apos;existe plus, ou appartient à un autre compte.
        </EtatVide>
        <Pressable style={s.bouton} onPress={() => router.dismissTo('/')}>
          <Text style={s.boutonTexte}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const parDrive = bilanParDrive(travail.results).filter(b => b.total > 0);
  // Variante B validée : un onglet par drive, ce qui manque avec sa raison et son geste.
  // Le compte rendu vaut pour un remplissage fini, ou en pause (résultats partiels) ;
  // pendant qu'il tourne, l'écran d'avancement reste.
  if (parDrive.length && (travail.status === 'done' || travail.status === 'needs_action')) return <CompteRendu travail={travail} parDrive={parDrive} onTerminer={() => router.dismissTo('/')} />;

  const bilan = travail.results ?? null;
  const manquants = bilan
    ? Object.entries(bilan).flatMap(([drive, lignes]) =>
        (lignes ?? []).filter((l) => !l.ok).map((l) => ({ drive, ...l })))
    : [];

  return (
    <SafeAreaView style={s.ecran}>
      <ScrollView contentContainerStyle={s.corps}>
        <Text style={s.titre}>{libelleEtat(travail.status)}</Text>
        <Text style={s.resume}>{resume(travail)}</Text>

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

        <Pressable style={s.bouton} onPress={() => router.dismissTo('/')}>
          <Text style={s.boutonTexte}>Terminer</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const TONS: Record<Ton, { fond: string; texte: string }> = {
  danger: { fond: colors.dangerSoft, texte: colors.danger },
  attention: { fond: colors.attentionSoft, texte: colors.attentionText },
  neutre: { fond: colors.off, texte: colors.textMuted },
};

function CompteRendu({ travail, parDrive, onTerminer }: { travail: { status: string; error: string | null; progress: { drive?: string; fait?: number; total?: number } | null }; parDrive: BilanDrive[]; onTerminer: () => void }) {
  const [drive, setDrive] = useState(parDrive[0].drive), [voirAjoutes, setVoirAjoutes] = useState(false);
  // Les lignes déjà ouvertes sur le site, pour s'y retrouver en les reprenant une à une.
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set()), [erreurLien, setErreurLien] = useState<string | null>(null);
  const { produits } = useProducts(), insets = useSafeAreaInsets();
  const b = parDrive.find(x => x.drive === drive) ?? parDrive[0];
  const drives = parDrive.map(x => x.drive);
  const parId = useMemo(() => new Map(produits.map(p => [p.id, p.image_url])), [produits]);
  const parNom = useMemo(() => new Map(produits.map(p => [p.name.toLowerCase(), p.image_url])), [produits]);
  const image = (l: LigneResultat & { product_id?: string | null }) => (l.product_id ? parId.get(l.product_id) : undefined) ?? parNom.get(l.item.toLowerCase());
  const n = b.ajoutes.length, m = b.manquants.length;
  const enPause = travail.status === 'needs_action';
  const reprendre = (l: LigneResultat, cle: string) => {
    setErreurLien(null);
    Linking.openURL(adresseReprise(l, b.drive, [...b.ajoutes, ...b.manquants]))
      .then(() => setOuvertes(o => new Set(o).add(cle)))
      .catch(() => { setErreurLien(`Impossible d’ouvrir ${siteDrive(b.drive)} pour le moment.`); AccessibilityInfo.announceForAccessibility(`Impossible d’ouvrir ${siteDrive(b.drive)}`); });
  };
  // Sans manque, la liste montre d'emblée ce qui est au panier.
  const ajoutesVisibles = voirAjoutes || !m;
  return (
    <SafeAreaView style={s.ecran} edges={['top']}>
      <ScrollView contentContainerStyle={c.corps}>
        <Pressable accessibilityRole="button" onPress={onTerminer} hitSlop={8} style={c.retour}>
          <Feather name="chevron-left" size={20} color={colors.accent} /><Text style={c.retourTexte}>Accueil</Text>
        </Pressable>
        <Text accessibilityRole="header" style={c.titre}>Compte rendu</Text>
        {parDrive.length > 1 && <View style={c.segments} accessibilityRole="tablist">
          {parDrive.map(x => {
            const actif = x.drive === b.drive;
            return <Pressable key={x.drive} accessibilityRole="tab" accessibilityState={{ selected: actif }} aria-selected={actif}
              accessibilityLabel={`${nomDrive(x.drive)}, ${x.ajoutes.length} sur ${x.total} au panier`}
              onPress={() => { setDrive(x.drive); setVoirAjoutes(false); }} style={[c.segment, actif && c.segmentActif]}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[c.segmentTexte, actif && c.segmentTexteActif]}>{nomDrive(x.drive)} · {x.ajoutes.length}/{x.total}</Text>
            </Pressable>;
          })}
        </View>}
        {enPause ? <View style={[c.bandeau, c.bandeauPause]} accessible accessibilityLiveRegion="polite"
          accessibilityLabel={`En pause. ${travail.error ?? 'Une vérification t’attend sur ton ordinateur.'} ${n} produit${n > 1 ? 's' : ''} déjà au panier.`}>
          <Feather name="pause-circle" size={26} color={colors.attentionText} />
          <View style={{ flex: 1 }}>
            <Text style={[c.bandeauTitre, { color: colors.attentionText }]}>En pause</Text>
            <Text style={[c.bandeauSous, { color: colors.attentionText, opacity: 1 }]}>{travail.error ?? 'Une vérification t’attend sur ton ordinateur.'} Le compte rendu se complètera à la reprise.</Text>
          </View>
        </View> : <View style={c.bandeau} accessible accessibilityLabel={`${n} produit${n > 1 ? 's' : ''} au panier ${nomDrive(b.drive)}. ${m ? `${m} non ajouté${m > 1 ? 's' : ''}. ` : ''}À payer sur ${siteDrive(b.drive)}.`}>
          <Feather name="shopping-cart" size={26} color={colors.accentContrast} />
          <View style={{ flex: 1 }}>
            <Text style={c.bandeauTitre}>{n} produit{n > 1 ? 's' : ''} au panier</Text>
            <Text style={c.bandeauSous} numberOfLines={2}>{m ? `${m} non ajouté${m > 1 ? 's' : ''} · ` : ''}à payer sur {siteDrive(b.drive)}</Text>
          </View>
        </View>}
        {!!erreurLien && <Text accessibilityLiveRegion="polite" style={c.erreur}>{erreurLien}</Text>}
        {m > 0 && <>
          <View style={c.entete}>
            <Text style={c.enteteTexte}>NON AJOUTÉS · {m}</Text>
            {n > 0 && <Pressable accessibilityRole="button" accessibilityState={{ expanded: voirAjoutes }} onPress={() => setVoirAjoutes(!voirAjoutes)} hitSlop={8} style={c.cible}>
              <Text style={c.lien}>{voirAjoutes ? 'Masquer les ajoutés' : `Voir les ${n} ajoutés`}</Text>
            </Pressable>}
          </View>
          {b.manquants.map((l, i) => {
            const r = raison(l, b.drive, drives), ton = TONS[r.ton], cle = `${b.drive}-m-${i}`, ouverte = ouvertes.has(cle);
            return <View key={cle} style={[c.ligne, ouverte && { opacity: 0.6 }]}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Photo name={l.item} url={image(l)} style={c.photo} /></View>
              <View style={{ flex: 1 }} accessible accessibilityLabel={`${l.item}. ${ouverte ? `Ouvert sur ${siteDrive(b.drive)}` : r.libelle}`}>
                <Text style={c.nom} numberOfLines={2}>{l.item}</Text>
                {ouverte ? <View style={[c.pastille, c.pastilleOuverte]}><Feather name="check" size={11} color={colors.textMuted} /><Text style={[c.pastilleTexte, { color: colors.textMuted }]}>Ouvert sur {siteDrive(b.drive)}</Text></View>
                  : <View style={[c.pastille, { backgroundColor: ton.fond }]}><Text style={[c.pastilleTexte, { color: ton.texte }]}>{r.libelle}</Text></View>}
              </View>
              <Pressable accessibilityRole="link" accessibilityLabel={`${r.action} ${l.item} sur ${siteDrive(b.drive)}`} accessibilityHint="Ouvre la recherche du site ; ton panier y est relié à ton compte"
                onPress={() => reprendre(l, cle)} hitSlop={6} style={c.action}>
                <Text style={c.lien}>{r.action}</Text><Feather name="arrow-up-right" size={14} color={colors.accent} />
              </Pressable>
            </View>;
          })}
        </>}
        {ajoutesVisibles && n > 0 && <>
          <Text style={[c.enteteTexte, { marginTop: m ? spacing.md : 0 }]}>AU PANIER · {n}</Text>
          {b.ajoutes.map((l, i) => <View key={`${b.drive}-a-${i}`} style={c.ligne} accessible
            accessibilityLabel={`${l.item}${(l.quantity ?? 1) > 1 ? `, ${l.quantity} au panier` : ', au panier'}`}>
            <Photo name={l.item} url={image(l)} style={c.photo} />
            <View style={{ flex: 1 }}>
              <Text style={c.nom} numberOfLines={2}>{l.item}</Text>
              {!!l.label && l.label.toLowerCase() !== l.item.toLowerCase() && <Text style={c.detail} numberOfLines={1}>{l.label.replace(/\s+/g, ' ')}</Text>}
            </View>
            {(l.quantity ?? 1) > 1 && <Text style={c.quantite}>× {l.quantity}</Text>}
            <Feather name="check" size={18} color={colors.accent} />
          </View>)}
        </>}
      </ScrollView>
      <View style={[c.pied, { paddingBottom: Math.max(16, insets.bottom + 4) }]}>
        <Pressable accessibilityRole="button" style={c.terminer} onPress={onTerminer}><Text style={s.boutonTexte}>Terminer</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const c = StyleSheet.create({
  corps: { padding: spacing.lg, paddingTop: spacing.sm, gap: 10, paddingBottom: spacing.xl },
  retour: { flexDirection: 'row', alignItems: 'center', minHeight: 44, alignSelf: 'flex-start', marginLeft: -6 },
  retourTexte: { fontSize: 16, color: colors.accent },
  titre: { fontSize: 27, fontWeight: '700', color: colors.text, letterSpacing: -0.6, marginBottom: 2 },
  segments: { flexDirection: 'row', backgroundColor: colors.off, borderRadius: 12, padding: 3 },
  segment: { flex: 1, minHeight: 44, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentActif: { backgroundColor: colors.surface, boxShadow: '0 1px 3px rgba(38,51,32,0.12)' },
  segmentTexte: { fontSize: 14, fontWeight: '600', color: colors.textMuted, fontVariant: ['tabular-nums'] },
  segmentTexteActif: { color: colors.text, fontWeight: '700' },
  bandeau: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.accent, borderRadius: 16, padding: 16 },
  bandeauTitre: { fontSize: 20, fontWeight: '800', color: colors.accentContrast, letterSpacing: -0.3 },
  bandeauPause: { backgroundColor: colors.attentionSoft },
  bandeauSous: { fontSize: 13, color: colors.accentContrast, opacity: 0.88, marginTop: 2 },
  erreur: { fontSize: 14, color: colors.danger, lineHeight: 20 },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  enteteTexte: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: colors.textMuted },
  lien: { fontSize: 13, fontWeight: '600', color: colors.accent },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, minHeight: 60 },
  photo: { width: 40, height: 40, borderRadius: 10 },
  nom: { fontSize: 14, fontWeight: '600', color: colors.text },
  detail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  pastille: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  pastilleOuverte: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.off },
  pastilleTexte: { fontSize: 11, fontWeight: '700' },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 4 },
  cible: { minHeight: 44, justifyContent: 'center' },
  quantite: { fontSize: 13, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  pied: { padding: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  terminer: { backgroundColor: colors.accent, borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
});

const s = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.bg },
  centre: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg, gap: spacing.md, padding: spacing.xl,
  },
  corps: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl, gap: spacing.sm,
  },
  titre: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  resume: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
  manquants: {
    alignSelf: 'stretch', marginTop: spacing.lg, gap: spacing.xs,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.lg,
  },
  manquantsTitre: { fontSize: 13, fontWeight: '700', color: colors.danger },
  manquant: { fontSize: 14, color: colors.text },
  bouton: {
    backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.lg,
    alignItems: 'center', marginTop: spacing.lg, alignSelf: 'stretch',
  },
  boutonTexte: { color: colors.accentContrast, fontWeight: '700', fontSize: 16 },
});
