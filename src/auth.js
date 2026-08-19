// Single-manager auth. No signup flow by design.

import { supabase } from './supabaseClient.js';

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(cb) {
  return supabase.auth.onAuthStateChange((_event, session) => cb(session));
}

/** Turn Supabase's English auth errors into French UI copy. */
export function authErrorMessage(err) {
  const msg = String(err?.message || '').toLowerCase();
  if (msg.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (msg.includes('email not confirmed')) return 'Email non confirmé.';
  if (msg.includes('failed to fetch') || msg.includes('network')) return 'Connexion au serveur impossible.';
  return err?.message || 'Erreur de connexion.';
}
