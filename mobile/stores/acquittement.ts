import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Dernier travail clos dont on a vu le bilan.
 *
 * Volontairement local à l'appareil, et non une colonne en base : une fois le
 * foyer partagé, que quelqu'un d'autre ait vu le bilan ne signifiera pas que
 * moi je l'ai vu.
 */
const CLE = 'courses.travail_acquitte';

export async function lireAcquittement(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CLE);
  } catch (e) {
    // Un stockage illisible ne doit pas empêcher le bandeau de fonctionner :
    // au pire on remontre un bilan déjà vu.
    console.error('[acquittement:lire]', e);
    return null;
  }
}

export async function ecrireAcquittement(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE, id);
  } catch (e) {
    console.error('[acquittement:ecrire]', e);
  }
}
