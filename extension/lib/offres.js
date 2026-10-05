/**
 * Relevé des offres affichées par un drive (prix, prix au kilo, contenance,
 * Nutri-Score), à partir des textes bruts lus dans chaque carte produit. Le
 * script de page lit ; ce module comprend, et se teste hors navigateur.
 */

const nombre = (t) => Number(String(t).replace(/\s/g, '').replace(',', '.'));

/** « 2,45 € », « 2€45 », « 12,90€ » : le premier prix en euros, ou null. */
export function lirePrix(texte) {
  if (!texte) return null;
  const t = String(texte).replace(/ /g, ' ');
  const m = t.match(/(?<![\d,.])(\d{1,4})€(\d{2})(?![\d,.])/) || t.match(/(\d{1,4})\s*(?:[,.](\d{1,2}))?\s*€/);
  if (!m) return null;
  const v = Number(`${m[1]}.${(m[2] ?? '0').padEnd(2, '0')}`);
  return Number.isFinite(v) && v > 0 && v < 10000 ? v : null;
}

/** « 9,80 € / kg », « 1,25 €/L », « 0,35 € la pièce » : prix ramené au kg, au litre ou à l'unité. */
export function lirePrixUnitaire(texte) {
  if (!texte) return null;
  const t = String(texte).replace(/ /g, ' ').toLowerCase();
  const m = t.match(/(\d{1,4}(?:[,.]\d{1,3})?)\s*€\s*(?:\/|le|la|par)\s*(kg|kilo|l|litre|pi[eè]ce|unit[ée]|u\b)/);
  if (!m) return null;
  const valeur = nombre(m[1]);
  const unite = /^k/.test(m[2]) ? 'kg' : /^l/.test(m[2]) ? 'l' : 'unite';
  return Number.isFinite(valeur) && valeur > 0 ? { valeur, unite } : null;
}

/** « 500 g », « 1,5 L », « 6 x 1 L », « 4 x 125 g », « 75 cl » : contenance totale. */
export function lireContenance(texte) {
  if (!texte) return null;
  const t = String(texte).replace(/ /g, ' ').toLowerCase();
  const m = t.match(/(?:(\d{1,3})\s*[x×]\s*)?(\d{1,4}(?:[,.]\d{1,3})?)\s*(kg|g|cl|ml|l)\b/);
  if (!m) return null;
  const n = m[1] ? Number(m[1]) : 1, v = nombre(m[2]) * n;
  const u = m[3];
  if (!Number.isFinite(v) || v <= 0) return null;
  if (u === 'kg') return { grammage_g: v * 1000, nombre: n };
  if (u === 'g') return { grammage_g: v, nombre: n };
  if (u === 'l') return { volume_ml: v * 1000, nombre: n };
  if (u === 'cl') return { volume_ml: v * 10, nombre: n };
  return { volume_ml: v, nombre: n };
}

/** « Nutri-Score B », « nutriscore-c », « nutri_score_A » : la lettre, en minuscule. */
export function lireNutriscore(texte) {
  const m = String(texte ?? '').toLowerCase().match(/nutri[\s_-]?score[\s_:-]*([a-e])\b/);
  return m ? m[1] : null;
}

/** Les mentions qui disent qu'un produit ne peut pas être commandé. */
export function estIndisponible(texte) {
  return /(indisponible|rupture|épuisé|epuise|plus disponible|non disponible)/i.test(String(texte ?? ''));
}

/** « -30 % », « 2+1 offert », « 2e à -50% » : la mention promotionnelle, courte. */
export function lirePromotion(texte) {
  const m = String(texte ?? '').match(/(-\s?\d{1,2}\s?%[^€\n]{0,30}|\d\s?\+\s?\d\s?offerts?|\d(?:e|ème)\s+à\s+-?\d{1,2}\s?%)/i);
  return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 40) : null;
}

/** Prix ramené au kilo ou au litre quand le site ne l'affiche pas. */
export function prixAuKilo(prix, contenance) {
  if (!prix || !contenance) return null;
  if (contenance.grammage_g) return { valeur: Math.round((prix / contenance.grammage_g) * 100000) / 100, unite: 'kg' };
  if (contenance.volume_ml) return { valeur: Math.round((prix / contenance.volume_ml) * 100000) / 100, unite: 'l' };
  return null;
}

/**
 * Les lignes à enregistrer pour une recherche : une par carte lue, avec ce
 * qu'on en comprend. `choisi` marque le produit mis au panier.
 */
export function offresDepuisReleve(releve, { drive, recherche, productId = null, jobId = null, choisi = null, rechercheId = null }) {
  if (!Array.isArray(releve)) return [];
  const vu = new Set();
  return releve.flatMap((c, rang) => {
    const libelle = String(c?.label ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!libelle) return [];
    const cle = c.ean || c.href || libelle;
    if (vu.has(cle)) return [];
    vu.add(cle);
    const texte = String(c.texte ?? '');
    const prix = lirePrix(c.prix) ?? lirePrix(texte);
    const contenance = lireContenance(libelle) ?? lireContenance(texte);
    const unitaire = lirePrixUnitaire(texte) ?? prixAuKilo(prix, contenance);
    return [{
      drive, recherche: String(recherche).slice(0, 200), product_id: productId, cart_job_id: jobId,
      // Une recherche demandée depuis l'app : ses offres y reviennent.
      ...(rechercheId ? { recherche_id: rechercheId } : {}),
      libelle, marque: c.marque ? String(c.marque).slice(0, 80) : null,
      ean13: c.ean && /^\d{8,14}$/.test(c.ean) ? c.ean : null,
      url: c.href ? String(c.href).slice(0, 500) : null,
      image_url: c.image && /^https:\/\//.test(c.image) ? String(c.image).slice(0, 500) : null,
      prix, prix_unitaire: unitaire?.valeur ?? null, unite_prix: unitaire?.unite ?? null,
      grammage_g: contenance?.grammage_g ?? null, volume_ml: contenance?.volume_ml ?? null, nombre: contenance?.nombre ?? null,
      nutriscore: lireNutriscore(c.nutri) ?? lireNutriscore(texte),
      promotion: lirePromotion(texte),
      disponible: !estIndisponible(texte),
      rang, choisi: !!choisi && libelle === String(choisi).replace(/\s+/g, ' ').trim().slice(0, 200),
    }];
  });
}
