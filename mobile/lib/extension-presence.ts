/**
 * Ce que fait l'extension Chrome, lu depuis l'app (table extension_presence).
 * L'extension réécrit sa ligne chaque minute tant que Chrome est ouvert : au
 * delà de trois minutes sans nouvelle, l'ordinateur est considéré absent.
 * Rien ici ne parle à Supabase.
 */
export type LignePresence = {
  vue_le: string;
  activite: 'prete' | 'recherches' | 'remplissage' | 'pause';
  detail: { fait?: number; total?: number; drive?: string | null; requete?: string | null; message?: string; auto?: boolean } | null;
};

export type EtatExtension =
  | { etat: 'jamais' }
  | { etat: 'absente'; depuis: string }
  /** auto : l'extension lance seule les recherches demandées (réglage, actif par défaut). */
  | { etat: 'prete'; auto: boolean }
  | { etat: 'recherches' | 'remplissage'; fait: number; total: number; drive: string | null; requete: string | null }
  | { etat: 'pause'; message: string };

const ABSENTE_APRES_MS = 3 * 60_000;
const NOMS: Record<string, string> = { carrefour: 'Carrefour', leclerc: 'E.Leclerc' };

/** « il y a 5 min », « il y a 2 h », « le 3 oct. ». */
export function depuis(iso: string, maintenant = Date.now()): string {
  const min = Math.max(0, Math.round((maintenant - Date.parse(iso)) / 60_000));
  if (min < 60) return `il y a ${min} min`;
  if (min < 24 * 60) return `il y a ${Math.round(min / 60)} h`;
  return `le ${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}

export function lireExtension(ligne: LignePresence | null, maintenant = Date.now()): EtatExtension {
  if (!ligne) return { etat: 'jamais' };
  if (maintenant - Date.parse(ligne.vue_le) > ABSENTE_APRES_MS) return { etat: 'absente', depuis: depuis(ligne.vue_le, maintenant) };
  const d = ligne.detail ?? {};
  if (ligne.activite === 'recherches' || ligne.activite === 'remplissage') {
    return { etat: ligne.activite, fait: d.fait ?? 0, total: d.total ?? 0, drive: d.drive ?? null, requete: d.requete ?? null };
  }
  if (ligne.activite === 'pause') return { etat: 'pause', message: d.message || 'Une action t’attend sur ton ordinateur.' };
  return { etat: 'prete', auto: d.auto !== false };
}

/**
 * Le titre et la consigne à afficher. `attendu` dit ce que l'app vient de
 * confier à l'extension : des recherches, ou une liste à mettre au panier.
 */
export function texteExtension(e: EtatExtension, attendu: 'recherches' | 'remplissage'): { titre: string; consigne: string } {
  const bouton = attendu === 'recherches' ? '« Lancer les recherches »' : '« Remplir le panier »';
  switch (e.etat) {
    case 'jamais': return { titre: 'Extension pas encore vue', consigne: 'Installe l’extension Courses dans Chrome sur ton ordinateur, et connecte-toi avec ce compte.' };
    case 'absente': return { titre: 'Ordinateur pas vu', consigne: `Dernier signe de l’extension ${e.depuis}. Ouvre Chrome sur ton ordinateur.` };
    case 'prete': return attendu === 'recherches' && e.auto
      ? { titre: 'Chrome est ouvert', consigne: 'Les recherches partent d’elles-mêmes dans les 30 secondes.' }
      : { titre: 'Chrome est ouvert', consigne: `Dans l’extension, clique sur ${bouton}.` };
    case 'pause': return { titre: 'Une action t’attend', consigne: e.message };
    default: {
      const ou = e.drive ? ` sur ${NOMS[e.drive] ?? e.drive}` : '';
      if (e.etat === 'recherches') return { titre: `Recherche en cours · ${e.fait} sur ${e.total}`, consigne: e.requete ? `« ${e.requete} »${ou}, à rythme humain.` : `${ou.trim() || 'Sur tes drives'}, à rythme humain.` };
      return { titre: `Remplissage en cours · ${e.fait} sur ${e.total}`, consigne: `Le panier se remplit${ou}.` };
    }
  }
}
