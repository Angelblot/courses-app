export const CATEGORY_TINTS = {
  fruits_legumes: '#E8F2DC',
  pls: '#F4ECE2',
  charcuterie: '#F7E4DA',
  boissons: '#E3EEF2',
  epicerie: '#F2E8CF',
  droguerie: '#ECE8F2',
  parfumerie: '#F2E8EF',
  maison: '#ECEDE8',
  surgeles: '#E3ECF2',
  autre: '#F3F1EC',
};

export function categoryTint(key) {
  return CATEGORY_TINTS[key] || CATEGORY_TINTS.autre;
}
