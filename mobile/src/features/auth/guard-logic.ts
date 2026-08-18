import type { AuthState } from './auth-reducer';

/** Screens reachable even without an active plan — they're part of the plan-creation flow
 * itself, not something the "you need a plan" guard should ever redirect away from. */
const PLAN_CREATION_FLOW_PATHS = ['/plan-creation', '/upgrade-info'];

/** currentPath: the pathname the (app) layout is currently rendering (e.g. usePathname()'s
 * value), WITHOUT the route-group prefix (expo-router strips groups from the URL, e.g.
 * app/(app)/plan-creation.tsx is reachable at "/plan-creation"). Required so this never redirects
 * away from a screen in PLAN_CREATION_FLOW_PATHS — without that check, sitting on one of them
 * with no active plan re-evaluates to "redirect to /plan-creation" on every render of the (app)
 * layout, an unconditional self-redirect that repeats forever (found via real Web testing: it hit
 * React's "Maximum update depth exceeded" guard). /upgrade-info was missed in the first pass at
 * this fix (only /plan-creation was exempted) — hitting the free quota there sent the user right
 * back to /plan-creation, defeating the point of ever showing them the upgrade screen, and
 * re-triggered the same infinite-redirect failure mode. */
export function determineRedirect(auth: AuthState, currentPath: string): string | null {
  if (auth.status === 'loading') return null;
  if (auth.status === 'signed-out') return '/(auth)/onboarding';
  if (auth.hasActivePlan === null) return null;
  if (auth.hasActivePlan === false && !PLAN_CREATION_FLOW_PATHS.includes(currentPath)) {
    return '/(app)/plan-creation';
  }
  return null;
}
