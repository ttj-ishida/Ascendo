export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; userId: string; accessToken: string };

export type AuthEvent =
  | { type: 'INITIAL_SESSION'; session: { userId: string; accessToken: string } | null }
  | { type: 'SIGNED_IN'; userId: string; accessToken: string }
  | { type: 'SIGNED_OUT' }
  | { type: 'TOKEN_REFRESHED'; accessToken: string };

export function authReducer(state: AuthState, event: AuthEvent): AuthState {
  switch (event.type) {
    case 'INITIAL_SESSION':
      return event.session
        ? { status: 'signed-in', userId: event.session.userId, accessToken: event.session.accessToken }
        : { status: 'signed-out' };
    case 'SIGNED_IN':
      return { status: 'signed-in', userId: event.userId, accessToken: event.accessToken };
    case 'SIGNED_OUT':
      return { status: 'signed-out' };
    case 'TOKEN_REFRESHED':
      return state.status === 'signed-in' ? { ...state, accessToken: event.accessToken } : state;
  }
}
