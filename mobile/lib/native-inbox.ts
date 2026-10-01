import { NativeModules, Platform } from 'react-native';
// Not available in Expo Go: these capabilities belong to the signed iOS app.
export const nativeInbox = Platform.OS === 'ios' ? NativeModules.TableeInbox as {
  syncProducts(account: string, json: string): Promise<boolean>;
  setSession(account: string | null): Promise<boolean>;
  read(account: string): Promise<unknown>;
  acknowledge(account: string, ids: string[]): Promise<boolean>;
} | undefined : undefined;

export type ListeRappels = { id: string; titre: string; nombre: number; couleur: string };
export const nativeRappels = Platform.OS === 'ios' ? NativeModules.TableeRappels as {
  statut(): Promise<'autorise' | 'refuse' | 'indetermine'>;
  demander(): Promise<boolean>;
  listes(): Promise<ListeRappels[]>;
  /** null si la liste n'existe plus. */
  lire(id: string): Promise<{ titre: string; articles: unknown } | null>;
  cocher(ids: string[], fait: boolean): Promise<boolean>;
} | undefined : undefined;
