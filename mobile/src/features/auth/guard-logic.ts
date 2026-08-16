import type { AuthState } from './auth-reducer';

export function determineRedirect(auth: AuthState): string | null {
  if (auth.status === 'loading') return null;
  if (auth.status === 'signed-out') return '/(auth)/onboarding';
  if (auth.hasActivePlan === null) return null;
  if (auth.hasActivePlan === false) return '/(app)/plan-creation';
  return null;
}
