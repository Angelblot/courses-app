import { useEffect, useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors } from '../../lib/theme';
import { useMaison } from '../../contexts/useMaison';
import { Action, Photo, ui, useAnnulation } from '../../components/MaisonUI';
import { SESSION_STEPS } from '../../lib/session-courses';
import { usePistes } from '../../stores/pistes';
import { useCommandes } from '../../stores/commandes';
import { usePrenom } from '../../stores/profil';
import { ENSEIGNES } from '../../lib/commandes';
import { dateLongue, phraseSaison, resumeBudget, saison, salutation, type Saison } from '../../lib/accueil';

/** Une image d'ambiance par saison, générée une fois (les produits gardent leurs vraies photos). */
const IMAGES: Record<Saison, number> = {
  hiver: require('../../assets/accueil/hiver.jpg'),
  printemps: require('../../assets/accueil/printemps.jpg'),
  ete: require('../../assets/accueil/ete.jpg'),
  automne: require('../../assets/accueil/automne.jpg'),
};
const euros = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;
const jour = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/**
 * L'accueil (variante AC1) : la saison en grand, une salutation datée, puis
 * une carte qui porte l'action principale et la dernière commande. Ensuite
 * des recettes pour donner envie, et le budget des dernières commandes. Les
 * manques n'y figurent pas : widget, Siri et bilan des courses s'en chargent.
 */
export default function Maison() {
  const { w, r, erreur } = useMaison(), { commandes } = useCommandes(), { prenom } = usePrenom();
  const insets = useSafeAreaInsets(), { width } = useWindowDimensions();
  const annulation = useAnnulation();
  const maintenant = new Date();
  // Des pistes d'économie ou de meilleure note : un rappel discret, une ligne.
  const { pistes } = usePistes(w.compte), gainAn = pistes.reduce((t, x) => t + Math.max(0, x.economieAn ?? 0), 0);
  // Des courses abandonnées depuis la pause s'annulent ici, quelques secondes.
  useEffect(() => { if (!w.abandonEnAttente) return; annulation.proposer('Courses abandonnées. Tes manques restent notés.', w.annulerAbandon); w.oublierAbandon(); }, [w.abandonEnAttente]);

  const derniere = commandes.find(c => c.total != null);
  const budget = useMemo(() => resumeBudget(commandes), [commandes]);
  // Les recettes changent chaque jour : on tourne dans la liste.
  const recettes = useMemo(() => {
    const avecPhoto = r.recettes.filter(x => x.image_url);
    if (!avecPhoto.length) return [];
    const debut = Math.floor(Date.now() / 86400000) % avecPhoto.length;
    return [...avecPhoto.slice(debut), ...avecPhoto.slice(0, debut)].slice(0, 8);
  }, [r.recettes]);
  const etape = w.sessionEtape ? SESSION_STEPS.find(x => x.cle === w.sessionEtape)?.label : null;
  const hauteur = 340 + insets.top, largeur = Math.min(width, 720);
  const pic = budget ? Math.max(...budget.points) : 0, creux = budget ? Math.min(...budget.points) : 0;

  return <View style={ui.screen}>
    <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
      <View style={[a.hero, { height: hauteur }]}>
        <Image source={IMAGES[saison(maintenant)]} accessibilityIgnoresInvertColors style={[a.image, { width: largeur, height: largeur * 1.5, top: insets.top - Math.round(largeur * 1.5 * 0.21) }]} />
        <View style={[a.accroche, { paddingTop: insets.top + 18 }]}>
          <Text style={a.date}>{dateLongue(maintenant).toUpperCase()}</Text>
          <Text style={a.bonjour} accessibilityRole="header">{salutation(maintenant, prenom)}</Text>
          <Text style={a.saison}>{phraseSaison(maintenant)}</Text>
        </View>
      </View>

      <View style={a.carte}>
        <Text style={a.date}>{etape ? 'Tes courses sont en cours' : 'Tes prochaines courses'}</Text>
        {etape ? <Text style={a.ligne}>Reprends à l’étape « {etape} ». Tes choix sont conservés.</Text>
          : derniere && <View style={a.rangee}>
            <Feather name="clock" size={16} color={colors.textMuted} />
            <Text style={[a.ligne, { flex: 1 }]}>Dernière : <Text style={a.fort}>{jour(derniere.jour)}</Text>{derniere.drives.length ? ` chez ${derniere.drives.map(d => ENSEIGNES[d] ?? d).join(' et ')}` : ''}, <Text style={a.fort}>{euros(derniere.total!)}</Text></Text>
          </View>}
        <Action onPress={() => { w.demarrerSession(); router.navigate(`/wizard/${w.sessionEtape ?? 'recettes'}`); }}>{etape ? 'Reprendre mes courses' : 'Préparer mes courses'}</Action>
      </View>
      {!!erreur && <View style={a.marge}><Text style={ui.error}>{erreur}</Text></View>}
      {!!w.sauvegardeErreur && <View style={a.marge}><Text style={ui.error}>{w.sauvegardeErreur}</Text></View>}

      {recettes.length > 0 && <>
        <View style={a.entete}>
          <Text style={a.titre} accessibilityRole="header">Envie de cuisiner</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Voir toutes les recettes" onPress={() => router.navigate('/recettes')} hitSlop={10}><Text style={ui.link}>Recettes</Text></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={a.carrousel}>
          {recettes.map(x => { const temps = (x.prep_minutes ?? 0) + (x.cook_minutes ?? 0);
            const detail = [temps ? `${temps} min` : '', x.servings_default ? `${x.servings_default} pers.` : ''].filter(Boolean).join(' · ');
            return <Pressable key={x.id} accessibilityRole="button" accessibilityLabel={`Voir la recette ${x.name}${detail ? `, ${detail}` : ''}`} onPress={() => router.push(`/recettes/${x.id}`)}
              style={({ pressed }) => [a.recette, pressed && { opacity: .85 }]}>
              <Photo name={x.name} url={x.image_url} recipe style={a.photo} />
              <Text style={a.nom} numberOfLines={2}>{x.name}</Text>
              {!!detail && <Text style={a.detail}>{detail}</Text>}
            </Pressable>; })}
        </ScrollView>
      </>}

      {budget && <Pressable accessibilityRole="button" onPress={() => router.push('/commandes')}
        accessibilityLabel={`${budget.moyenne} euros par commande en moyenne sur tes ${budget.sur} dernières${budget.evolution != null ? `, ${budget.evolution > 0 ? 'plus' : 'moins'} ${Math.abs(Math.round(budget.evolution * 100))} % que les précédentes` : ''}. Voir mes commandes`}
        style={({ pressed }) => [a.budget, pressed && { opacity: .85 }]}>
        <View style={{ flex: 1 }}>
          <Text style={a.montant}>{budget.moyenne} €</Text>
          <Text style={a.detail}>par commande en moyenne{budget.evolution != null && budget.evolution !== 0 ? ' · ' : ''}{budget.evolution != null && budget.evolution !== 0 && <Text style={{ color: budget.evolution < 0 ? '#2F6B2F' : colors.danger, fontWeight: '700' }}>{budget.evolution > 0 ? '+' : '−'}{Math.abs(Math.round(budget.evolution * 100))} %</Text>}</Text>
        </View>
        {/* Les dernières commandes en petites barres, la plus récente en vert. */}
        <View style={a.barres} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {budget.points.map((v, i) => <View key={i} style={[a.barre, { height: 12 + (pic > creux ? (v - creux) / (pic - creux) : 1) * 24 }, i === budget.points.length - 1 && { backgroundColor: colors.accent }]} />)}
        </View>
      </Pressable>}

      {pistes.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`${pistes.length} piste${pistes.length > 1 ? 's' : ''}${gainAn >= 1 ? `, environ ${gainAn} euros par an` : ''}. Voir`} onPress={() => router.push('/pistes')} style={({ pressed }) => [a.pistes, pressed && { opacity: .85 }]}>
        <Feather name="trending-down" size={18} color="#2F6B2F" />
        <Text style={[a.ligne, { flex: 1, color: colors.text }]}><Text style={a.fort}>{pistes.length} piste{pistes.length > 1 ? 's' : ''}</Text> {gainAn >= 1 ? `pour environ ${gainAn} € par an` : 'pour tes prochaines courses'}</Text>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </Pressable>}
    </ScrollView>
    <View style={{ marginBottom: 8 }}>{annulation.toast}</View>
  </View>;
}

const a = StyleSheet.create({
  hero: { overflow: 'hidden', backgroundColor: '#EFEAE0' },
  image: { position: 'absolute', left: 0 },
  accroche: { paddingHorizontal: 22, gap: 6 },
  date: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase' },
  bonjour: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8, color: colors.text },
  saison: { fontSize: 15, lineHeight: 21, color: '#4A5244', maxWidth: 280 },
  carte: { marginTop: -72, marginHorizontal: 16, padding: 16, gap: 12, borderRadius: 22, backgroundColor: colors.surface, boxShadow: '0 10px 30px rgba(38,51,32,0.14)' },
  rangee: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ligne: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  fort: { fontWeight: '600', color: colors.text },
  marge: { paddingHorizontal: 16, paddingTop: 10 },
  entete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 22, paddingBottom: 10 },
  titre: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, color: colors.text },
  carrousel: { gap: 12, paddingHorizontal: 16 },
  recette: { width: 150, gap: 4 },
  photo: { width: 150, height: 112, borderRadius: 14 },
  nom: { fontSize: 14, fontWeight: '600', lineHeight: 18, color: colors.text },
  detail: { fontSize: 12, color: colors.textMuted },
  budget: { marginTop: 16, marginHorizontal: 16, padding: 16, borderRadius: 18, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 },
  montant: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, color: colors.text, fontVariant: ['tabular-nums'] },
  barres: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 36 },
  barre: { width: 8, borderRadius: 3, backgroundColor: '#DCE5D2' },
  pistes: { marginTop: 10, marginHorizontal: 16, paddingHorizontal: 14, minHeight: 52, borderRadius: 16, backgroundColor: '#EEF4E8', flexDirection: 'row', alignItems: 'center', gap: 10 },
});
