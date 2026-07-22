import * as React from "react";

/** Storybook stub — signed-out auth context so mobile hosts don't need Supabase. */
type AuthValue = {
  session: null;
  user: null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthValue>({
  session: null,
  user: null,
  loading: false,
  signOut: async () => undefined,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        session: null,
        user: null,
        loading: false,
        signOut: async () => undefined,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return React.useContext(AuthContext);
}

export function useAuthSession() {
  return React.useContext(AuthContext).session;
}
