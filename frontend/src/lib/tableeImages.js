import manifest from './tablee-images.json';

const normalize = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim();
const recipeImages = new Map(manifest.recipes.map(({ name, src }) => [normalize(name), src]));
const productImages = new Map(manifest.products.map(({ name, src }) => [normalize(name), src]));
// Existing photos always win, including the initial recipe catalog.
export function recipeImage(recipe) {
  return recipe.image_url?.trim() || recipeImages.get(normalize(recipe.name));
}
export function recipeImageFallback(recipe) {
  return recipeImages.get(normalize(recipe.name));
}
export function productImageFallback(product) {
  return productImages.get(normalize(product.name));
}
