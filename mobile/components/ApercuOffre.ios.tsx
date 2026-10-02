import type { ReactElement } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Button, ContextMenu, Host, RNHostView } from '@expo/ui/swift-ui';
import type { FicheProduit } from '../lib/openfoodfacts.ts';
import { PastilleNutri } from './PastilleNutri';
import { Reperes } from './FicheOffre';
import { Photo } from './MaisonUI';
import { colors } from '../lib/theme';

export type ApercuOffreProps = { fiche: FicheProduit; onChoisir: () => void; onVoir: () => void; children: ReactElement;
  /** Largeur de la liste : la ligne s'y étend au lieu de prendre celle de son contenu. */
  largeur?: number };

/**
 * Appui long sur un résultat (variante FD2) : l'aperçu natif d'iOS fait
 * sortir une carte au-dessus de la liste floutée (photo, scores, repères),
 * avec « Choisir » et « Voir la fiche complète » dessous. Le repli web et
 * Android est dans `ApercuOffre.tsx`.
 */
export function ApercuOffre({ fiche, onChoisir, onVoir, children, largeur }: ApercuOffreProps) {
  const fenetre = useWindowDimensions().width, width = largeur || fenetre;
  const d = fiche.details;
  return (
    <Host matchContents={{ vertical: true }} style={{ width }}>
      <ContextMenu>
        <ContextMenu.Items>
          <Button label="Choisir ce produit" systemImage="checkmark" onPress={onChoisir} />
          <Button label="Voir la fiche complète" systemImage="list.bullet.rectangle" onPress={onVoir} />
        </ContextMenu.Items>
        <ContextMenu.Trigger>
          {/* Largeur fixée : sans elle, la ligne prend celle de son contenu et iOS la centre. */}
          <RNHostView matchContents><View style={{ width }}>{children}</View></RNHostView>
        </ContextMenu.Trigger>
        <ContextMenu.Preview>
          <RNHostView matchContents>
            <View style={[s.carte, { width: Math.min(340, width - 48) }]}>
              <Photo name={fiche.name} url={fiche.imageUrl} style={s.photo} />
              <Text style={s.nom} numberOfLines={2}>{fiche.name}</Text>
              <View style={s.ligne}>
                <Text style={s.detail}>{[fiche.brand, fiche.grammageG ? `${fiche.grammageG} g` : fiche.volumeMl ? `${fiche.volumeMl} ml` : null].filter(Boolean).join(' · ')}</Text>
                <PastilleNutri note={fiche.nutriscore} />
                {!!d?.nova && <Text style={s.nova}>NOVA {d.nova}</Text>}
              </View>
              {d ? <Reperes d={d} /> : <Text style={s.detail}>Repères nutritionnels inconnus.</Text>}
            </View>
          </RNHostView>
        </ContextMenu.Preview>
      </ContextMenu>
    </Host>
  );
}

const s = StyleSheet.create({
  carte: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, gap: 10 },
  photo: { width: '100%', height: 160, borderRadius: 12 },
  nom: { fontSize: 17, fontWeight: '700', color: colors.text },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  detail: { fontSize: 13, color: colors.textMuted },
  nova: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', backgroundColor: colors.nutriE, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, overflow: 'hidden' },
});
