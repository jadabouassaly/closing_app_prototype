// "Rapport Mensuel par Catégorie" — reads the monthly_category_report view.
//
// The view already unions the child tables and labels each line's category, so
// this module only groups for the bar chart; it never rebuilds the report from
// day state.

import { fmt } from './calculations.js';
import { fetchMonthlyReport, todayStr } from './api.js';

let root = null;
let items = [];

const q = sel => root.querySelector(sel);

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function template() {
  return `
  <section class="card">
    <h2>Rapport Mensuel par Catégorie</h2>
    <p class="hint">Regroupe toutes les fiches journalières enregistrées du mois choisi, comme l'onglet "July By CAT" du classeur Excel.</p>
    <div class="month-controls-row">
      <div style="flex:1; min-width:160px;"><label>Mois</label><input type="month" id="monthPicker"></div>
      <div style="flex:1; min-width:200px;"><label>Filtrer par catégorie</label><select id="categoryFilter"><option value="">Toutes catégories</option></select></div>
      <button class="btn btn-primary" id="refreshMonthBtn" type="button" style="align-self:flex-end;">Actualiser</button>
      <button class="btn btn-ghost" id="exportCsvBtn" type="button" style="align-self:flex-end;">Exporter CSV</button>
    </div>
    <div class="status" id="monthStatus" style="margin-top:8px;"></div>
  </section>

  <section class="card">
    <h2>Résumé par Catégorie</h2>
    <div id="categorySummary"><div class="empty-note">Choisissez un mois et cliquez sur Actualiser.</div></div>
    <div class="subtotal-line"><span>Grand Total</span><span id="monthGrandTotal">0</span></div>
  </section>

  <section class="card">
    <h2>Détail des Lignes</h2>
    <div id="monthDetailTable"><div class="empty-note">Aucune donnée chargée.</div></div>
  </section>`;
}

function setMonthStatus(msg, ms = 2500, isError = false) {
  const el = q('#monthStatus');
  el.textContent = msg;
  el.className = 'status' + (isError ? ' error' : '');
  if (ms) {
    setTimeout(() => {
      if (el.textContent === msg) {
        el.textContent = '';
        el.className = 'status';
      }
    }, ms);
  }
}

/** Filter options come from the categories actually present in the loaded
 *  month, so they always match the strings the view emits. */
function refreshCategoryFilter() {
  const sel = q('#categoryFilter');
  const previous = sel.value;
  const present = [...new Set(items.map(i => i.categorie).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'fr')
  );
  sel.innerHTML =
    '<option value="">Toutes catégories</option>' +
    present.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if (present.includes(previous)) sel.value = previous;
}

function render() {
  const filter = q('#categoryFilter').value;
  const filtered = filter ? items.filter(i => i.categorie === filter) : items;

  // Summary always reflects the whole month, not the active filter.
  const byCat = {};
  items.forEach(i => {
    const c = i.categorie || '—';
    byCat[c] = (byCat[c] || 0) + Number(i.montant || 0);
  });
  const entries = Object.entries(byCat).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const maxAbs = entries.length ? Math.max(...entries.map(e => Math.abs(e[1]))) : 1;

  const summaryEl = q('#categorySummary');
  summaryEl.innerHTML = entries.length
    ? entries
        .map(
          ([cat, total]) => `
      <div class="cat-bar-row">
        <span>${escapeHtml(cat)}</span>
        <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${((Math.abs(total) / maxAbs) * 100).toFixed(1)}%"></div></div>
        <span class="cat-bar-amount">${fmt(total)}</span>
      </div>`
        )
        .join('')
    : '<div class="empty-note">Aucune donnée pour ce mois. Enregistrez des fiches journalières puis actualisez.</div>';

  q('#monthGrandTotal').textContent = fmt(items.reduce((a, i) => a + Number(i.montant || 0), 0));

  const detailEl = q('#monthDetailTable');
  if (!filtered.length) {
    detailEl.innerHTML = '<div class="empty-note">Aucune ligne à afficher.</div>';
    return;
  }
  const sorted = [...filtered].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let html =
    '<div class="table-scroll"><table class="rowtable"><thead><tr><th style="width:95px;">Date</th><th style="width:110px;">Montant</th><th>Description</th><th>Détail</th><th style="width:150px;">Catégorie</th></tr></thead><tbody>';
  sorted.forEach(i => {
    html += `<tr><td>${escapeHtml(i.date)}</td><td>${fmt(i.montant)}</td><td>${escapeHtml(i.description)}</td><td>${escapeHtml(i.detail)}</td><td>${escapeHtml(i.categorie)}</td></tr>`;
  });
  html += '</tbody></table></div>';
  detailEl.innerHTML = html;
}

async function refreshReport() {
  const monthStr = q('#monthPicker').value;
  if (!monthStr) {
    setMonthStatus('Choisissez un mois', 3000, true);
    return;
  }
  setMonthStatus('Chargement…', 0);
  try {
    items = await fetchMonthlyReport(monthStr);
    refreshCategoryFilter();
    render();
    const days = new Set(items.map(i => i.date)).size;
    setMonthStatus(`${days} jour(s) · ${items.length} ligne(s) ✓`);
  } catch (err) {
    console.error(err);
    items = [];
    refreshCategoryFilter();
    render();
    setMonthStatus('Erreur de chargement', 5000, true);
  }
}

function exportCsv() {
  const filter = q('#categoryFilter').value;
  const rows = filter ? items.filter(i => i.categorie === filter) : items;
  if (!rows.length) {
    setMonthStatus('Rien à exporter', 3000, true);
    return;
  }
  const header = ['Date', 'Montant', 'Description', 'Detail', 'Categorie'];
  const body = rows.map(i => [i.date, i.montant, i.description, i.detail, i.categorie]);
  const csv = [header, ...body]
    .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  // BOM so Excel opens the accented French headers correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rapport-mensuel-' + (q('#monthPicker').value || 'export') + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function initMonthView(container) {
  root = container;
  root.className = 'shell-single';
  root.innerHTML = template();

  q('#monthPicker').value = todayStr().slice(0, 7);
  q('#refreshMonthBtn').addEventListener('click', refreshReport);
  q('#categoryFilter').addEventListener('change', render);
  q('#exportCsvBtn').addEventListener('click', exportCsv);
}

export { refreshReport };
