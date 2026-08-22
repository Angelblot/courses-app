import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { base64VersOctets } from './base64.ts';

const BUCKET = 'recettes';

/**
 * Ouvre l'appareil photo ou la photothèque et rend la photo choisie.
 *
 * Le base64 est demandé dès la prise : Hermes n'expose pas `atob`, et lire un
 * fichier local par `fetch` se comporte différemment selon les versions de
 * React Native. Le décodage se fait ensuite par une fonction testée.
 *
 * Un refus d'autorisation ou une annulation rendent `null` — ce n'est pas une
 * erreur, l'écran garde simplement son aplat coloré.
 */
export async function choisirPhoto(
  source: 'appareil' | 'bibliotheque',
): Promise<{ base64: string } | null> {
  const permission = source === 'appareil'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    // 0.7 : au-delà, une photo de plat dépasse vite le plafond de 5 Mo du
    // bucket sans gain visible sur un écran de téléphone.
    quality: 0.7,
    base64: true,
  };

  const r = source === 'appareil'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);

  if (r.canceled || !r.assets?.[0]?.base64) return null;
  return { base64: r.assets[0].base64 };
}

/**
 * Dépose une photo dans le bucket et rend son adresse publique.
 *
 * Le chemin commence par l'identifiant de l'utilisateur : la politique
 * d'écriture du bucket l'exige — `(storage.foldername(name))[1] = auth.uid()`.
 */
export async function deposerPhoto(
  base64: string,
): Promise<{ ok: boolean; url?: string; erreur?: string }> {
  const { data: utilisateur } = await supabase.auth.getUser();
  const userId = utilisateur?.user?.id;
  if (!userId) return { ok: false, erreur: 'Session expirée. Reconnecte-toi.' };

  const octets = base64VersOctets(base64);
  if (octets.length === 0) return { ok: false, erreur: 'La photo est vide.' };

  // Pas de `crypto.randomUUID()` : il n'est pas garanti sous Hermes, et son
  // absence ne se verrait qu'à l'exécution sur l'appareil. Horodatage et
  // aléa suffisent à ne pas se marcher dessus dans un dossier personnel.
  const nom = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const chemin = `${userId}/${nom}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(chemin, octets, { contentType: 'image/jpeg', upsert: false });

  if (error) {
    console.error('[deposerPhoto]', error);
    return { ok: false, erreur: "La photo n'a pas pu être envoyée." };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(chemin);
  return { ok: true, url: data.publicUrl };
}
