import { createContext, useCallback, useContext, useEffect, useReducer, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { authReducer, type AuthState } from './auth-reducer';

const AuthStateContext = createContext<AuthState>({ status: 'loading' });

interface AuthActions {
  /** Re-queries whether the caller currently has an active learning_plans row and updates the
   * cached hasActivePlan accordingly. Exposed so screens that change plan status themselves
   * (e.g. Settings' "学習計画を作り直す", which sets the active plan to 'abandoned') can sync
   * AuthContext immediately instead of waiting for the next sign-in/tab-refocus cycle that
   * normally triggers this — without it, (app)/_layout.tsx's guard would keep believing a plan
   * exists until something else happened to re-run the check. */
  refreshActivePlan: () => Promise<void>;
}

const AuthActionsContext = createContext<AuthActions>({ refreshActivePlan: async () => {} });

async function resolveHasActivePlan(): Promise<boolean> {
  const { count } = await supabase
    .from('learning_plans')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');
  return (count ?? 0) > 0;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, { status: 'loading' });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      dispatch({
        type: 'INITIAL_SESSION',
        session: data.session
          ? { userId: data.session.user.id, accessToken: data.session.access_token }
          : null,
      });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      // Every event that carries a session (SIGNED_IN, TOKEN_REFRESHED, and — found via real Web
      // testing — a same-user SIGNED_IN supabase-js re-emits when a browser tab regains focus and
      // revalidates its session) goes through one SESSION_UPDATED event. The reducer itself
      // decides whether that's a genuine new sign-in (resets hasActivePlan) or just a refresh for
      // the user we already know about (must not reset it — see auth-reducer.ts).
      if (event === 'SIGNED_OUT') {
        dispatch({ type: 'SIGNED_OUT' });
      } else if (session) {
        dispatch({ type: 'SESSION_UPDATED', userId: session.user.id, accessToken: session.access_token });
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  // Lives here (root-level AuthProvider), not in (app)/_layout.tsx, so it isn't lost if that
  // layout ever gets torn down and rebuilt by an in-group <Redirect> — that combination
  // previously reset a locally-held hasActivePlan back to null on every redirect, re-running
  // this same query and re-triggering the same redirect forever (found via real Web testing;
  // visible as an infinite "hasActivePlan: false" / "hasActivePlan: null" render alternation).
  useEffect(() => {
    if (state.status !== 'signed-in') return;
    resolveHasActivePlan().then((hasActivePlan) => dispatch({ type: 'ACTIVE_PLAN_RESOLVED', hasActivePlan }));
  }, [state.status]);

  const refreshActivePlan = useCallback(async () => {
    const hasActivePlan = await resolveHasActivePlan();
    dispatch({ type: 'ACTIVE_PLAN_RESOLVED', hasActivePlan });
  }, []);

  return (
    <AuthStateContext.Provider value={state}>
      <AuthActionsContext.Provider value={{ refreshActivePlan }}>{children}</AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthStateContext);
}

export function useAuthActions(): AuthActions {
  return useContext(AuthActionsContext);
}
