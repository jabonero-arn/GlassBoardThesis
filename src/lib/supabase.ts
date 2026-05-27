import { createClient } from '@supabase/supabase-js';

const supabaseUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || 'https://tspopbrylewcirzyholi.supabase.co').replace(/\/rest\/v1\/?$/, '');
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_NIcMYDWtHyLolyQKKdbfCQ_-oV3HTG_';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
