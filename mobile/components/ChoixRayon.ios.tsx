import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Host, Menu, Picker, RNHostView, Text as TexteNatif } from '@expo/ui/swift-ui';
import { tag, tint } from '@expo/ui/swift-ui/modifiers';
import { LigneRayon } from './LigneRayon';
import { RAYONS, type CleRayon } from '../lib/rayons.ts';
import { colors } from '../lib/theme';

/**
 * La ligne « Rayon » d'une fiche, version iOS : un toucher ouvre le menu
 * déroulant natif, le rayon actuel coché : rien ne se déplie dans la fiche.
 * Le repli web et Android est dans `ChoixRayon.tsx`.
 */
export function ChoixRayon({ valeur, onChoisir }: { valeur: CleRayon; onChoisir: (cle: CleRayon) => void }) {
  const [largeur, setLargeur] = useState(0);
  // Le libellé d'un Menu SwiftUI prend la largeur de son contenu : la
  // ligne reçoit donc en points la largeur mesurée de son emplacement.
  return (
    <View style={s.hote} onLayout={(e) => setLargeur(Math.round(e.nativeEvent.layout.width))}>
      {largeur > 0 && <Host matchContents={{ vertical: true }} style={{ width: largeur }}>
        <Menu label={<RNHostView matchContents><LigneRayon valeur={valeur} style={{ width: largeur }} /></RNHostView>} modifiers={[tint(colors.accent)]}>
          <Picker<string> selection={valeur} onSelectionChange={(cle) => onChoisir(cle as CleRayon)}>
            {RAYONS.map((r) => <TexteNatif key={r.cle} modifiers={[tag(r.cle)]}>{r.label}</TexteNatif>)}
          </Picker>
        </Menu>
      </Host>}
    </View>
  );
}

const s = StyleSheet.create({
  hote: { alignSelf: 'stretch' },
});
