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

  return <AuthStateContext.Provider value={state}>{children}</AuthStateContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthStateContext);
}
