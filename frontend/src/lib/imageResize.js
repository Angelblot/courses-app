/**
 * Réduit une photo avant envoi : une fiche recette reste lisible à 2000 px,
 * et l'upload passe de ~5 Mo à ~500 Ko sur mobile.
 *
 * @param {File} file - Image choisie par l'utilisateur.
 * @param {number} [maxSide=2000] - Plus grand côté en pixels.
 * @returns {Promise<Blob>} JPEG redimensionné (ou le fichier d'origine si le navigateur ne sait pas le décoder).
 */
export async function resizeImage(file, maxSide = 2000) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  return blob || file;
}
