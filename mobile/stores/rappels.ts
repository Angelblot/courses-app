import AsyncStorage from '@react-native-async-storage/async-storage';

/** La liste Rappels reliée sur cet appareil, et la dernière reprise. */
export type Liaison = { id: string; titre: string; couleur?: string; derniere?: { n: number; le: string } };
const cle = (compte: string) => `courses-rappels-v1:${compte}`;

export async function lireLiaison(compte: string): Promise<Liaison | null> {
  try {
    const brut = await AsyncStorage.getItem(cle(compte));
    const l = brut ? JSON.parse(brut) : null;
    return l && typeof l.id === 'string' && typeof l.titre === 'string' ? l : null;
  } catch { return null; }
}
export async function enregistrerLiaison(compte: string, liaison: Liaison | null) {
  if (liaison) await AsyncStorage.setItem(cle(compte), JSON.stringify(liaison));
  else await AsyncStorage.removeItem(cle(compte));
}
