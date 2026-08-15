import type { AuthState } from './auth-reducer';

export function determineRedirect(input: { auth: AuthState; hasActivePlan: boolean | null }): string | null {
  if (input.auth.status === 'loading') return null;
  if (input.auth.status === 'signed-out') return '/(auth)/onboarding';
  if (input.hasActivePlan === null) return null;
  if (input.hasActivePlan === false) return '/(app)/plan-creation';
  return null;
}
