import { useState } from 'react';
import { Pressable } from 'react-native';
import { LigneRayon } from './LigneRayon';
import { SelecteurRayon } from './SelecteurRayon';
import type { CleRayon } from '../lib/rayons.ts';

/**
 * La ligne « Rayon » d'une fiche, version web et Android : un toucher
 * déplie sous la ligne la liste groupée de `SelecteurRayon`. Le menu
 * déroulant natif d'iOS est dans `ChoixRayon.ios.tsx`.
 */
export function ChoixRayon({ valeur, onChoisir }: { valeur: CleRayon; onChoisir: (cle: CleRayon) => void }) {
  const [ouvert, setOuvert] = useState(false);
  return ouvert
    ? <SelecteurRayon valeur={valeur} onChoisir={(cle) => { onChoisir(cle); setOuvert(false); }} onFermer={() => setOuvert(false)} />
    : <Pressable onPress={() => setOuvert(true)} style={({ pressed }) => pressed && { opacity: .85 }}><LigneRayon valeur={valeur} /></Pressable>;
}
