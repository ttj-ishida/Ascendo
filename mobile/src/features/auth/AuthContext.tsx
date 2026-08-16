import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { authReducer, type AuthState } from './auth-reducer';

const AuthStateContext = createContext<AuthState>({ status: 'loading' });

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
      if (event === 'SIGNED_OUT') {
        dispatch({ type: 'SIGNED_OUT' });
      } else if (event === 'TOKEN_REFRESHED' && session) {
        dispatch({ type: 'TOKEN_REFRESHED', accessToken: session.access_token });
      } else if (session) {
        dispatch({ type: 'SIGNED_IN', userId: session.user.id, accessToken: session.access_token });
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
    supabase
      .from('learning_plans')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .then(({ count }) => dispatch({ type: 'ACTIVE_PLAN_RESOLVED', hasActivePlan: (count ?? 0) > 0 }));
  }, [state.status]);

  return <AuthStateContext.Provider value={state}>{children}</AuthStateContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthStateContext);
}
