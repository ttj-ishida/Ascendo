export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; userId: string; accessToken: string; hasActivePlan: boolean | null };

export type AuthEvent =
  | { type: 'INITIAL_SESSION'; session: { userId: string; accessToken: string } | null }
  // Covers every supabase-js onAuthStateChange event that carries a session — SIGNED_IN,
  // TOKEN_REFRESHED, and also a same-user SIGNED_IN supabase-js can re-emit when a browser tab
  // regains focus and revalidates its session (found via real Web testing: this looked
  // indistinguishable from a fresh sign-in, so it kept resetting hasActivePlan — see below).
  | { type: 'SESSION_UPDATED'; userId: string; accessToken: string }
  | { type: 'SIGNED_OUT' }
  | { type: 'ACTIVE_PLAN_RESOLVED'; hasActivePlan: boolean };

export function authReducer(state: AuthState, event: AuthEvent): AuthState {
  switch (event.type) {
    case 'INITIAL_SESSION':
      return event.session
        ? { status: 'signed-in', userId: event.session.userId, accessToken: event.session.accessToken, hasActivePlan: null }
        : { status: 'signed-out' };
    case 'SESSION_UPDATED':
      // A session event for the SAME user we're already signed in as (token refresh, a tab
      // regaining focus, etc.) must not reset hasActivePlan — the (app) layout's guard re-fetches
      // it via a useEffect keyed on `state.status`, which doesn't change here ('signed-in' stays
      // 'signed-in'), so wiping it to null with nothing left to set it back would leave the app
      // stuck on the loading spinner forever. Only a genuine new sign-in (different user, or
      // arriving from signed-out/loading) starts that check over.
      if (state.status === 'signed-in' && state.userId === event.userId) {
        return { ...state, accessToken: event.accessToken };
      }
      return { status: 'signed-in', userId: event.userId, accessToken: event.accessToken, hasActivePlan: null };
    case 'SIGNED_OUT':
      return { status: 'signed-out' };
    case 'ACTIVE_PLAN_RESOLVED':
      return state.status === 'signed-in' ? { ...state, hasActivePlan: event.hasActivePlan } : state;
  }
}
