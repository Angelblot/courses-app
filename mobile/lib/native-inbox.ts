import { NativeModules, Platform } from 'react-native';
// Not available in Expo Go: these capabilities belong to the signed iOS app.
export const nativeInbox = Platform.OS === 'ios' ? NativeModules.TableeInbox as {
  setSession(account: string | null): Promise<boolean>;
  read(account: string): Promise<unknown>;
  acknowledge(account: string, ids: string[]): Promise<boolean>;
} | undefined : undefined;
