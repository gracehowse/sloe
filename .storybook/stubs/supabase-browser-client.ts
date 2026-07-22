/**
 * Storybook stub — no live Supabase. Prevents `supabaseUrl is required`
 * when Chromatic extracts stories (module-scope createBrowserClient).
 */
type FakeQuery = {
  select: (..._args: unknown[]) => FakeQuery;
  insert: (..._args: unknown[]) => FakeQuery;
  update: (..._args: unknown[]) => FakeQuery;
  upsert: (..._args: unknown[]) => FakeQuery;
  delete: (..._args: unknown[]) => FakeQuery;
  eq: (..._args: unknown[]) => FakeQuery;
  neq: (..._args: unknown[]) => FakeQuery;
  in: (..._args: unknown[]) => FakeQuery;
  order: (..._args: unknown[]) => FakeQuery;
  limit: (..._args: unknown[]) => FakeQuery;
  single: () => Promise<{ data: null; error: null }>;
  maybeSingle: () => Promise<{ data: null; error: null }>;
  then: (
    onfulfilled?: (value: { data: unknown[]; error: null }) => unknown,
  ) => Promise<unknown>;
};

function query(): FakeQuery {
  const self: FakeQuery = {
    select: () => self,
    insert: () => self,
    update: () => self,
    upsert: () => self,
    delete: () => self,
    eq: () => self,
    neq: () => self,
    in: () => self,
    order: () => self,
    limit: () => self,
    single: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    then: (onfulfilled) =>
      Promise.resolve({ data: [], error: null }).then(onfulfilled),
  };
  return self;
}

export function hasSupabaseConfig(): boolean {
  return false;
}

export const supabase = {
  from: (_table: string) => query(),
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => undefined } },
    }),
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
    signInWithOAuth: async () => ({ data: { provider: "google", url: null }, error: null }),
    exchangeCodeForSession: async () => ({ data: { session: null }, error: null }),
  },
  channel: () => ({
    on: () => ({ subscribe: () => undefined }),
    subscribe: () => undefined,
    unsubscribe: () => undefined,
  }),
  removeChannel: () => undefined,
};

export default supabase;
