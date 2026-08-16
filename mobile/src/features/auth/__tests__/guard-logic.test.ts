import { determineRedirect } from '../guard-logic';
import type { AuthState } from '../auth-reducer';

const SIGNED_OUT: AuthState = { status: 'signed-out' };
const LOADING: AuthState = { status: 'loading' };
const SIGNED_IN_NO_PLAN_YET: AuthState = { status: 'signed-in', userId: 'u1', accessToken: 't1', hasActivePlan: null };
const SIGNED_IN_NO_PLAN: AuthState = { status: 'signed-in', userId: 'u1', accessToken: 't1', hasActivePlan: false };
const SIGNED_IN_WITH_PLAN: AuthState = { status: 'signed-in', userId: 'u1', accessToken: 't1', hasActivePlan: true };

test('redirects to onboarding when signed out', () => {
  expect(determineRedirect(SIGNED_OUT, '/home')).toBe('/(auth)/onboarding');
});

test('renders nothing (still loading) while auth status is loading', () => {
  expect(determineRedirect(LOADING, '/home')).toBeNull();
});

test('renders nothing while signed in but the active-plan check is still loading', () => {
  expect(determineRedirect(SIGNED_IN_NO_PLAN_YET, '/home')).toBeNull();
});

test('redirects to plan-creation when signed in with no active plan, elsewhere in the app', () => {
  expect(determineRedirect(SIGNED_IN_NO_PLAN, '/home')).toBe('/(app)/plan-creation');
});

test('does not redirect when already on plan-creation with no active plan (avoids a self-redirect loop)', () => {
  expect(determineRedirect(SIGNED_IN_NO_PLAN, '/plan-creation')).toBeNull();
});

test('allows access (no redirect) when signed in with an active plan', () => {
  expect(determineRedirect(SIGNED_IN_WITH_PLAN, '/home')).toBeNull();
});
