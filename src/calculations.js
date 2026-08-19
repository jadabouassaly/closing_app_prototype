// Pure calculation helpers for the day sheet. No DOM, no Supabase.
//
// Every formula here mirrors the prototype's recalc() exactly. Repas Personnel
// and Annulations are deliberately absent from the cash chain: they are
// informational journals only.

import { SECTION_KEYS, ITEM_KEYS, VENTE_KEYS } from './sections.js';

/** Coerce anything to a number, treating blanks and garbage as 0. */
export function num(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/** fr-FR formatting with no decimals — CFA has no minor unit. */
export function fmt(n) {
  return Math.round(num(n)).toLocaleString('fr-FR');
}

/** Sum the `montant` column of a set of line rows. */
export function sumRows(rows) {
  return (rows || []).reduce((a, r) => a + num(r.montant), 0);
}

export function totalRecette(state) {
  return num(state.recette_s1) + num(state.recette_s2) + num(state.recette_s3);
}

export function totalVentes(state) {
  return VENTE_KEYS.reduce((a, k) => a + num(state.ventes[k]), 0);
}

/** Percentage share of each sales category, or null when there are no sales. */
export function ventesBreakdown(state) {
  const total = totalVentes(state);
  if (total <= 0) return null;
  return VENTE_KEYS.map(k => ({ key: k, pct: (num(state.ventes[k]) / total) * 100 }));
}

/** qty × prix for each of the 3 tracked items. */
export function itemValues(state) {
  const out = {};
  ITEM_KEYS.forEach(k => {
    out[k] = num(state.items[k].qty) * num(state.items[k].prix);
  });
  return out;
}

/** Per-section `montant` totals, keyed by section (= table) name. */
export function sectionTotals(state) {
  const out = {};
  SECTION_KEYS.forEach(k => {
    out[k] = sumRows(state[k]);
  });
  return out;
}

/**
 * The full cash reconciliation chain.
 *
 * grand_total          = dépenses + avances + crédit client + écart espèce
 * total_espece_du_jour = recette − grand_total − TPE
 * total_reste_espece   = espèce début + total espèce du jour
 * variance             = espèce comptée − total reste espèce  (null if not counted)
 */
export function computeTotals(state) {
  const totals = sectionTotals(state);

  const recette = totalRecette(state);
  const depenses = totals.expense_lines;
  const avances = totals.avances;
  const creditClient = totals.credit_client;
  const tpe = totals.tpe_paiements;
  const diff = num(state.diff_espece);

  const grandTotal = depenses + avances + creditClient + diff;
  const especeDuJour = recette - grandTotal - tpe;
  const resteEspece = num(state.espece_debut) + especeDuJour;

  const counted = state.espece_compte;
  const hasCount = counted !== null && counted !== '' && counted !== undefined;
  const variance = hasCount ? num(counted) - resteEspece : null;

  return {
    ...totals,
    totalRecette: recette,
    totalVentes: totalVentes(state),
    totalDepenses: depenses,
    totalAvances: avances,
    totalCreditClient: creditClient,
    totalTpe: tpe,
    totalRepas: totals.repas_personnel,
    totalFournisseur: totals.credit_fournisseur,
    totalCheques: totals.cheques,
    diffEspece: diff,
    grandTotal,
    totalEspeceDuJour: especeDuJour,
    totalResteEspece: resteEspece,
    variance
  };
}
