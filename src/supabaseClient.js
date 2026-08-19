import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    'Configuration Supabase manquante. Copiez .env.example vers .env et renseignez ' +
      'VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true }
});
