import type { AuthState } from './auth-reducer';

/** currentPath: the pathname the (app) layout is currently rendering (e.g. usePathname()'s
 * value), WITHOUT the route-group prefix (expo-router strips groups from the URL, e.g.
 * app/(app)/plan-creation.tsx is reachable at "/plan-creation"). Required so this never redirects
 * to the screen the caller is already on — without that check, sitting on /plan-creation with no
 * active plan re-evaluates to "redirect to /plan-creation" on every render of the (app) layout,
 * an unconditional self-redirect that repeats forever (found via real Web testing: it hit React's
 * "Maximum update depth exceeded" guard once hasActivePlan stopped flapping and started
 * resolving instantly from AuthContext instead of an async query each cycle). */
export function determineRedirect(auth: AuthState, currentPath: string): string | null {
  if (auth.status === 'loading') return null;
  if (auth.status === 'signed-out') return '/(auth)/onboarding';
  if (auth.hasActivePlan === null) return null;
  if (auth.hasActivePlan === false && currentPath !== '/plan-creation') return '/(app)/plan-creation';
  return null;
}
