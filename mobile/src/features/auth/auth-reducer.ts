export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; userId: string; accessToken: string; hasActivePlan: boolean | null };

export type AuthEvent =
  | { type: 'INITIAL_SESSION'; session: { userId: string; accessToken: string } | null }
  | { type: 'SIGNED_IN'; userId: string; accessToken: string }
  | { type: 'SIGNED_OUT' }
  | { type: 'TOKEN_REFRESHED'; accessToken: string }
  | { type: 'ACTIVE_PLAN_RESOLVED'; hasActivePlan: boolean };

export function authReducer(state: AuthState, event: AuthEvent): AuthState {
  switch (event.type) {
    case 'INITIAL_SESSION':
      return event.session
        ? { status: 'signed-in', userId: event.session.userId, accessToken: event.session.accessToken, hasActivePlan: null }
        : { status: 'signed-out' };
    case 'SIGNED_IN':
      return { status: 'signed-in', userId: event.userId, accessToken: event.accessToken, hasActivePlan: null };
    case 'SIGNED_OUT':
      return { status: 'signed-out' };
    case 'TOKEN_REFRESHED':
      return state.status === 'signed-in' ? { ...state, accessToken: event.accessToken } : state;
    case 'ACTIVE_PLAN_RESOLVED':
      return state.status === 'signed-in' ? { ...state, hasActivePlan: event.hasActivePlan } : state;
  }
}
