/**
 * Instance unique de la file de scan hors connexion, partagée par les
 * écrans qui en ont besoin : `app/(tabs)/scan.tsx` l'alimente et la rejoue,
 * `app/(tabs)/compte.tsx` la vide à la déconnexion.
 *
 * `lib/queue.ts` reste volontairement pur (le stockage y est injecté, pas
 * importé) pour rester testable sans React Native — voir `lib/queue.test.mjs`.
 * Cette instance-ci, elle, est délibérément liée à AsyncStorage : elle n'a
 * pas vocation à être testée par `npm test`, au même titre que
 * `stores/products.ts` qui importe déjà le client Supabase.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { creerFile } from '../lib/queue.ts';

export const fileScan = creerFile(AsyncStorage);
