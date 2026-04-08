import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extra = Constants.expoConfig?.extra as Extra | undefined;

export const supabase = createClient(extra?.supabaseUrl ?? "", extra?.supabaseAnonKey ?? "", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function hasSupabaseConfig(): boolean {
  return Boolean(extra?.supabaseUrl?.trim() && extra?.supabaseAnonKey?.trim());
}
