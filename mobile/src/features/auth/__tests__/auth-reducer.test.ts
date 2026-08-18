import { authReducer, type AuthState } from '../auth-reducer';

const LOADING: AuthState = { status: 'loading' };

test('SESSION_UPDATED moves from loading to signed-in with user/token, plan status unresolved', () => {
  const next = authReducer(LOADING, {
    type: 'SESSION_UPDATED',
    userId: '11111111-1111-1111-1111-111111111111',
    accessToken: 'tok-abc',
  });
  expect(next).toEqual({
    status: 'signed-in',
    userId: '11111111-1111-1111-1111-111111111111',
    accessToken: 'tok-abc',
    hasActivePlan: null,
  });
});

test('SESSION_UPDATED for a different user resets hasActivePlan (a genuine new sign-in)', () => {
  const signedInAsA: AuthState = { status: 'signed-in', userId: 'user-a', accessToken: 'old', hasActivePlan: true };
  const next = authReducer(signedInAsA, { type: 'SESSION_UPDATED', userId: 'user-b', accessToken: 'new' });
  expect(next).toEqual({ status: 'signed-in', userId: 'user-b', accessToken: 'new', hasActivePlan: null });
});

test('SESSION_UPDATED for the same user updates the token but preserves hasActivePlan (token refresh, tab refocus, etc.)', () => {
  const signedIn: AuthState = { status: 'signed-in', userId: 'u1', accessToken: 'old', hasActivePlan: true };
  const next = authReducer(signedIn, { type: 'SESSION_UPDATED', userId: 'u1', accessToken: 'new' });
  expect(next).toEqual({ status: 'signed-in', userId: 'u1', accessToken: 'new', hasActivePlan: true });
});

test('SIGNED_OUT event moves to signed-out from any prior state', () => {
  const signedIn: AuthState = { status: 'signed-in', userId: 'x', accessToken: 'y', hasActivePlan: true };
  expect(authReducer(signedIn, { type: 'SIGNED_OUT' })).toEqual({ status: 'signed-out' });
});

test('INITIAL_SESSION with no session moves loading to signed-out', () => {
  expect(authReducer(LOADING, { type: 'INITIAL_SESSION', session: null })).toEqual({ status: 'signed-out' });
});

test('INITIAL_SESSION with a session moves loading to signed-in, plan status unresolved', () => {
  const next = authReducer(LOADING, {
    type: 'INITIAL_SESSION',
    session: { userId: 'u1', accessToken: 't1' },
  });
  expect(next).toEqual({ status: 'signed-in', userId: 'u1', accessToken: 't1', hasActivePlan: null });
});

test('ACTIVE_PLAN_RESOLVED sets hasActivePlan while staying signed-in', () => {
  const signedIn: AuthState = { status: 'signed-in', userId: 'u1', accessToken: 't1', hasActivePlan: null };
  const next = authReducer(signedIn, { type: 'ACTIVE_PLAN_RESOLVED', hasActivePlan: false });
  expect(next).toEqual({ status: 'signed-in', userId: 'u1', accessToken: 't1', hasActivePlan: false });
});

test('ACTIVE_PLAN_RESOLVED is a no-op when not signed in', () => {
  expect(authReducer(LOADING, { type: 'ACTIVE_PLAN_RESOLVED', hasActivePlan: true })).toEqual(LOADING);
});
