import { authReducer, type AuthState } from '../auth-reducer';

const LOADING: AuthState = { status: 'loading' };

test('SIGNED_IN event moves from loading to signed-in with user/token, plan status unresolved', () => {
  const next = authReducer(LOADING, {
    type: 'SIGNED_IN',
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

test('TOKEN_REFRESHED updates the access token while staying signed-in and preserves plan status', () => {
  const signedIn: AuthState = { status: 'signed-in', userId: 'u1', accessToken: 'old', hasActivePlan: true };
  const next = authReducer(signedIn, { type: 'TOKEN_REFRESHED', accessToken: 'new' });
  expect(next).toEqual({ status: 'signed-in', userId: 'u1', accessToken: 'new', hasActivePlan: true });
});

test('ACTIVE_PLAN_RESOLVED sets hasActivePlan while staying signed-in', () => {
  const signedIn: AuthState = { status: 'signed-in', userId: 'u1', accessToken: 't1', hasActivePlan: null };
  const next = authReducer(signedIn, { type: 'ACTIVE_PLAN_RESOLVED', hasActivePlan: false });
  expect(next).toEqual({ status: 'signed-in', userId: 'u1', accessToken: 't1', hasActivePlan: false });
});

test('ACTIVE_PLAN_RESOLVED is a no-op when not signed in', () => {
  expect(authReducer(LOADING, { type: 'ACTIVE_PLAN_RESOLVED', hasActivePlan: true })).toEqual(LOADING);
});
