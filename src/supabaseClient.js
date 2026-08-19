import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Deliberately does not throw. The login form is static markup in index.html,
// so a module-level throw here leaves a rendered form whose submit handler was
// never attached — a dead button with no explanation. Surfacing the problem as
// a value lets main.js show it to whoever is standing in front of the screen.
export const configError =
  !url || !key
    ? 'Configuration Supabase manquante : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY ' +
      'ne sont pas définies dans cet environnement.'
    : null;

export const supabase = configError
  ? null
  : createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
