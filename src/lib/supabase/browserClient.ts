import { createBrowserClient } from "@supabase/ssr";
import { projectId, publicAnonKey } from "../../../utils/supabase/info.tsx";

const supabaseUrl = `https://${projectId}.supabase.co`;

export const supabase = createBrowserClient(supabaseUrl, publicAnonKey);

