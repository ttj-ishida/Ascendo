import { determineRedirect } from '../guard-logic';
import type { AuthState } from '../auth-reducer';

const SIGNED_OUT: AuthState = { status: 'signed-out' };
const LOADING: AuthState = { status: 'loading' };
const SIGNED_IN: AuthState = { status: 'signed-in', userId: 'u1', accessToken: 't1' };

test('redirects to onboarding when signed out', () => {
  expect(determineRedirect({ auth: SIGNED_OUT, hasActivePlan: null })).toBe('/(auth)/onboarding');
});

test('renders nothing (still loading) while auth status is loading', () => {
  expect(determineRedirect({ auth: LOADING, hasActivePlan: null })).toBeNull();
});

test('renders nothing while signed in but the active-plan check is still loading', () => {
  expect(determineRedirect({ auth: SIGNED_IN, hasActivePlan: null })).toBeNull();
});

test('redirects to plan-creation when signed in with no active plan', () => {
  expect(determineRedirect({ auth: SIGNED_IN, hasActivePlan: false })).toBe('/(app)/plan-creation');
});

test('allows access (no redirect) when signed in with an active plan', () => {
  expect(determineRedirect({ auth: SIGNED_IN, hasActivePlan: true })).toBeNull();
});
