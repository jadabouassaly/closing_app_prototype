// Every Supabase read and write lives here. Views never talk to the DB directly.

import { supabase } from './supabaseClient.js';
import { SECTION_KEYS, SECTIONS, ITEM_KEYS, VENTE_KEYS } from './sections.js';

/** Scalar columns of daily_closings, in the shape the form works with. */
export function blankState(dateStr) {
  const state = {
    id: null,
    closing_date: dateStr,
    espece_debut: 0,
    recette_s1: 0,
    recette_s2: 0,
    recette_s3: 0,
    ventes: { food: 0, bev: 0, dessert: 0, b2b: 0, misc: 0 },
    items: {
      philly_viande: { qty: 0, prix: 7500 },
      philly_poulet: { qty: 0, prix: 7500 },
      plat_du_jour: { qty: 0, prix: 8000 }
    },
    diff_espece: 0,
    espece_compte: null
  };
  SECTION_KEYS.forEach(k => {
    state[k] = [];
  });
  return state;
}

export function todayStr() {
  const d = new Date();
  // Local date, not UTC — a closing belongs to the day the manager is living in.
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

// ---------- Categories ----------

/** Active expense categories, ordered. Driven entirely by the DB so the
 *  client can edit the list in Supabase without a redeploy. */
export async function fetchCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, sort_order, active')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ---------- Day: list / load / save ----------

/** All saved closing dates, most recent first. */
export async function listClosingDates() {
  const { data, error } = await supabase
    .from('daily_closings')
    .select('closing_date')
    .order('closing_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(r => r.closing_date);
}

/** Load one day into form state, or null when that date has no closing. */
export async function loadDay(dateStr) {
  const { data: head, error } = await supabase
    .from('daily_closings')
    .select('*')
    .eq('closing_date', dateStr)
    .maybeSingle();
  if (error) throw error;
  if (!head) return null;

  const state = blankState(dateStr);
  state.id = head.id;
  state.espece_debut = head.espece_debut ?? 0;
  state.recette_s1 = head.recette_s1 ?? 0;
  state.recette_s2 = head.recette_s2 ?? 0;
  state.recette_s3 = head.recette_s3 ?? 0;
  VENTE_KEYS.forEach(k => {
    state.ventes[k] = head['ventes_' + k] ?? 0;
  });
  ITEM_KEYS.forEach(k => {
    state.items[k] = {
      qty: head[`item_${k}_qty`] ?? 0,
      prix: head[`item_${k}_prix`] ?? state.items[k].prix
    };
  });
  state.diff_espece = head.diff_espece ?? 0;
  state.espece_compte = head.espece_compte ?? null;

  // Child rows, one query per table.
  //
  // Deliberately unordered. Child `id` is a random UUID, so ordering by it
  // shuffles the manager's rows; there is no position/created_at column to sort
  // on. Because saveDay() deletes and re-inserts each table's rows in a single
  // statement, the heap order PostgREST returns is the order they were entered.
  // A `position` column would make this a guarantee rather than a consequence —
  // see SCHEMA-NOTES.md.
  const results = await Promise.all(
    SECTION_KEYS.map(table => supabase.from(table).select('*').eq('closing_id', head.id))
  );
  results.forEach((res, i) => {
    if (res.error) throw res.error;
    state[SECTION_KEYS[i]] = (res.data || []).map(row => ({ ...row, _localId: 'r' + row.id }));
  });

  return state;
}

/**
 * Upsert the closing on its unique closing_date, then replace all child rows.
 *
 * Delete-then-insert rather than diffing: this is a single-editor app, and a
 * full replace can't drift out of sync with what's on screen.
 */
export async function saveDay(state) {
  const head = {
    closing_date: state.closing_date,
    espece_debut: numOr0(state.espece_debut),
    recette_s1: numOr0(state.recette_s1),
    recette_s2: numOr0(state.recette_s2),
    recette_s3: numOr0(state.recette_s3),
    diff_espece: numOr0(state.diff_espece),
    espece_compte:
      state.espece_compte === null || state.espece_compte === '' ? null : numOr0(state.espece_compte),
    updated_at: new Date().toISOString()
  };
  VENTE_KEYS.forEach(k => {
    head['ventes_' + k] = numOr0(state.ventes[k]);
  });
  ITEM_KEYS.forEach(k => {
    head[`item_${k}_qty`] = numOr0(state.items[k].qty);
    head[`item_${k}_prix`] = numOr0(state.items[k].prix);
  });

  const { data: saved, error: headErr } = await supabase
    .from('daily_closings')
    .upsert(head, { onConflict: 'closing_date' })
    .select('id')
    .single();
  if (headErr) throw headErr;

  const closingId = saved.id;

  for (const table of SECTION_KEYS) {
    const { error: delErr } = await supabase.from(table).delete().eq('closing_id', closingId);
    if (delErr) throw delErr;

    const cols = SECTIONS[table].cols.map(c => c.key);
    const rows = (state[table] || []).map(row => {
      const out = { closing_id: closingId };
      cols.forEach(c => {
        out[c] = row[c] === undefined ? null : row[c];
      });
      return out;
    });

    if (rows.length) {
      const { error: insErr } = await supabase.from(table).insert(rows);
      if (insErr) throw insErr;
    }
  }

  return closingId;
}

// ---------- Monthly report ----------

/** First day of the month after `monthStr` ("2026-07" -> "2026-08-01"). */
function monthBounds(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const start = `${monthStr}-01`;
  const endY = m === 12 ? y + 1 : y;
  const endM = m === 12 ? 1 : m + 1;
  const end = `${endY}-${String(endM).padStart(2, '0')}-01`;
  return { start, end };
}

/**
 * Rows for one month, straight from the monthly_category_report view.
 * The view already unions the child tables and labels each line's category,
 * so nothing is aggregated client-side here.
 */
export async function fetchMonthlyReport(monthStr) {
  const { start, end } = monthBounds(monthStr);
  const { data, error } = await supabase
    .from('monthly_category_report')
    .select('date, categorie, montant, description, detail')
    .gte('date', start)
    .lt('date', end)
    .order('date', { ascending: true });
  if (error) throw error;
  return data || [];
}

function numOr0(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}
