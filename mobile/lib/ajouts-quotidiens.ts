export type AjoutExterne = { id: string; name: string; quantity: number; source: string; createdAt: string };
/** Validation commune aux ajouts natifs ; les identifiants rendent l’import rejouable. */
export function lireAjouts(brut: unknown): AjoutExterne[] {
 if (!Array.isArray(brut)) return [];
 return brut.filter((a): a is AjoutExterne => !!a && typeof a.id==='string' && a.id.length<150 && typeof a.name==='string' && a.name.trim().length>0 && a.name.length<=120 && Number.isInteger(a.quantity) && a.quantity>=1 && a.quantity<=99 && typeof a.source==='string' && typeof a.createdAt==='string').map(a=>({...a,name:a.name.trim()}));
}
export function nombreArticles(n: number){return Math.min(99,Math.max(1,Math.round(n)||1));}

export function nouveauxAjouts(values: unknown, imported: string[]) {
  const seen = new Set(imported);
  return lireAjouts(values).filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
