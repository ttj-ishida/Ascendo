import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** Android emulators can't resolve 'localhost' as the host machine — they need the special
 * 10.0.2.2 loopback alias instead. Web and iOS (simulator or device) resolve 'localhost'
 * correctly on their own. Rather than requiring API_BASE_URL in .env to be hand-edited every
 * time development moves between Web and the Android emulator (a recurring, easy-to-forget step
 * that surfaced during real-device testing as "ConnectException: Failed to connect to
 * localhost/127.0.0.1:3000"), this substitutes the host automatically per platform so one .env
 * value works for both. Physical Android devices still need their own override (a LAN IP), since
 * 10.0.2.2 is emulator-only — set API_BASE_URL directly to that IP in .env when testing on one. */
export function resolveApiBaseUrl(configuredUrl: string, platformOS: typeof Platform.OS): string {
  if (platformOS !== 'android') return configuredUrl;
  return configuredUrl.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, '//10.0.2.2');
}

const { apiBaseUrl: configuredApiBaseUrl } = Constants.expoConfig?.extra ?? {};

export const apiBaseUrl = resolveApiBaseUrl((configuredApiBaseUrl as string) ?? 'http://localhost:3000', Platform.OS);
