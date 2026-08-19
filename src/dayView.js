// "Saisie Journalière" — the 12-section day sheet with its sticky running total.

import {
  SECTIONS,
  SECTION_KEYS,
  ITEM_KEYS,
  ITEM_LABELS,
  ITEM_PRICE_EDITABLE,
  VENTE_KEYS,
  VENTE_LABELS,
  VENTE_SHORT_LABELS
} from './sections.js';
import { fmt, num, computeTotals, itemValues, ventesBreakdown } from './calculations.js';
import { blankState, todayStr, fetchCategories, listClosingDates, loadDay, saveDay } from './api.js';

let state = blankState(todayStr());
let categories = [];
let localIdCounter = 1;
let root = null;

const newLocalId = () => 'n' + localIdCounter++;
const q = sel => root.querySelector(sel);

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Markup ----------

function template() {
  return `
  <header class="top">
    <div class="day-controls">
      <input type="date" id="dateInput">
      <select class="load-select" id="loadSelect"><option value="">Charger un jour enregistré…</option></select>
      <button class="btn btn-ghost" id="newBtn" type="button">Nouveau</button>
      <button class="btn btn-primary" id="saveBtn" type="button">Enregistrer</button>
      <span class="status" id="statusMsg"></span>
    </div>
  </header>

  <main>
    <section class="card">
      <h2><span class="num">01</span> Ouverture &amp; Recette</h2>
      <p class="hint">Caisse de départ et ventes encaissées par tranche horaire.</p>
      <div class="grid-fields">
        <div><label>Espèce Début</label><input type="number" id="especeDebut" value="0"></div>
        <div><label>Recette 6h–12h</label><input type="number" class="recette" data-k="recette_s1" value="0"></div>
        <div><label>Recette 12h–18h</label><input type="number" class="recette" data-k="recette_s2" value="0"></div>
        <div><label>Recette 18h–fermeture</label><input type="number" class="recette" data-k="recette_s3" value="0"></div>
      </div>
      <div class="subtotal-line"><span>Total Recette</span><span id="totalRecette">0</span></div>
    </section>

    <section class="card">
      <h2><span class="num">02</span> Ventes par Catégorie</h2>
      <p class="hint">Répartition des ventes du jour (issue de la caisse / POS).</p>
      <div class="grid-fields">
        ${VENTE_KEYS.map(k => `<div><label>${VENTE_LABELS[k]}</label><input type="number" class="vente" data-k="${k}" value="0"></div>`).join('')}
      </div>
      <div class="subtotal-line"><span>Total (avec remise)</span><span id="totalVentes">0</span></div>
      <div id="pctBreakdown"></div>
    </section>

    <section class="card">
      <h2><span class="num">03</span> Repères Articles</h2>
      <p class="hint">Compteurs de référence pour certains articles (n'affecte pas le total de caisse).</p>
      <div class="items-mini">
        ${ITEM_KEYS.map(k => `
        <div class="item-box">
          <div class="name">${ITEM_LABELS[k]}</div>
          <div class="row2">
            <label>Qté</label><input type="number" class="item-qty" data-item="${k}" value="0">
            ${ITEM_PRICE_EDITABLE[k]
              ? `<label>Prix</label><input type="number" class="item-prix" data-item="${k}" value="0">`
              : `<span class="fixed-price">&times; <span id="price-${k}">0</span></span>`}
          </div>
          <div class="val" id="val-${k}">0 CFA</div>
        </div>`).join('')}
      </div>
    </section>

    <section class="card">
      <h2><span class="num">04</span> Dépenses</h2>
      <p class="hint">Achats et dépenses réglés en espèces aujourd'hui. Chaque ligne est classée par catégorie pour le rapport mensuel.</p>
      <div id="tbl-depenses"></div>
      <button class="add-row" data-add="expense_lines" type="button">${SECTIONS.expense_lines.addLabel}</button>
      <div class="subtotal-line"><span>Total Dépenses</span><span id="totalDepenses">0</span></div>
    </section>

    <section class="card">
      <h2><span class="num">05</span> Avances</h2>
      <p class="hint">Avances versées (staff, prestataires, etc.).</p>
      <div id="tbl-avances"></div>
      <button class="add-row" data-add="avances" type="button">${SECTIONS.avances.addLabel}</button>
      <div class="subtotal-line"><span>Total Avances</span><span id="totalAvances">0</span></div>
    </section>

    <section class="card">
      <h2><span class="num">06</span> Crédit Client</h2>
      <p class="hint">Montants facturés à crédit à des clients.</p>
      <div id="tbl-creditClient"></div>
      <button class="add-row" data-add="credit_client" type="button">${SECTIONS.credit_client.addLabel}</button>
      <div class="subtotal-line"><span>Total Crédit Client</span><span id="totalCreditClient">0</span></div>
    </section>

    <section class="card">
      <h2><span class="num">07</span> Repas du Personnel</h2>
      <p class="hint">Journal des repas de service. Ne modifie pas le total de caisse (non-espèce).</p>
      <div id="tbl-repas"></div>
      <button class="add-row" data-add="repas_personnel" type="button">${SECTIONS.repas_personnel.addLabel}</button>
      <div class="subtotal-line"><span>Total repas (info)</span><span id="totalRepas">0</span></div>
    </section>

    <section class="card">
      <h2><span class="num">08</span> Annulations</h2>
      <p class="hint">Void, offerts, réductions staff / happy hour. Journal informatif.</p>
      <div id="tbl-annulations"></div>
      <button class="add-row" data-add="annulations" type="button">${SECTIONS.annulations.addLabel}</button>
    </section>

    <section class="card">
      <h2><span class="num">09</span> Terminal &amp; Mobile Money</h2>
      <p class="hint">Paiements par carte (TPE) ou Orange Money.</p>
      <div id="tbl-tpe"></div>
      <button class="add-row" data-add="tpe_paiements" type="button">${SECTIONS.tpe_paiements.addLabel}</button>
      <div class="subtotal-line"><span>Total TPE</span><span id="totalTpe">0</span></div>
    </section>

    <section class="card">
      <h2><span class="num">10</span> Crédit Fournisseur</h2>
      <p class="hint">Achats reçus à crédit fournisseur. Journal séparé, hors caisse.</p>
      <div id="tbl-fournisseur"></div>
      <button class="add-row" data-add="credit_fournisseur" type="button">${SECTIONS.credit_fournisseur.addLabel}</button>
      <div class="subtotal-line"><span>Total Crédit Fournisseur</span><span id="totalFournisseur">0</span></div>
    </section>

    <section class="card">
      <h2><span class="num">11</span> Chèques</h2>
      <p class="hint">Chèques émis ou reçus. Journal séparé, hors caisse.</p>
      <div id="tbl-cheques"></div>
      <button class="add-row" data-add="cheques" type="button">${SECTIONS.cheques.addLabel}</button>
      <div class="subtotal-line"><span>Total Chèques</span><span id="totalCheques">0</span></div>
    </section>

    <section class="card">
      <h2><span class="num">12</span> Écart de Caisse</h2>
      <p class="hint">Ajustement manuel si un écart est constaté (peut être négatif).</p>
      <div class="grid-fields">
        <div><label>Écart Espèce</label><input type="number" id="diffEspece" value="0"></div>
      </div>
    </section>
  </main>

  <aside class="tape">
    <div class="tape-head"></div>
    <div class="tape-body">
      <div class="t-title">Récapitulatif</div>
      <div class="t-line"><span>Espèce Début</span><span id="s-especeDebut">0</span></div>
      <div class="t-line"><span>Total Recette</span><span id="s-totalRecette">0</span></div>
      <div class="t-line neg"><span>Total Dépenses + Avances + Crédit Client</span><span id="s-grandTotal">0</span></div>
      <div class="t-line neg"><span>Total TPE / Mobile Money</span><span id="s-totalTpe">0</span></div>
      <div class="t-line"><span>Écart Espèce</span><span id="s-diffEspece">0</span></div>
      <div class="t-final">
        <div class="label">Total Reste Espèce (attendu)</div>
        <div class="value" id="s-totalReste">0 CFA</div>
      </div>
      <div class="count-box">
        <label>Espèce Compté (physique)</label>
        <input type="number" id="especeCompte" placeholder="Saisir le montant compté">
        <div class="variance ok" id="varianceLine"></div>
      </div>
    </div>
  </aside>`;
}

// ---------- Repeating tables ----------

function categoryOptions(selected) {
  if (!categories.length) {
    return '<option value="">— aucune catégorie —</option>';
  }
  return categories
    .map(c => `<option value="${escapeHtml(c.id)}" ${String(c.id) === String(selected) ? 'selected' : ''}>${escapeHtml(c.name)}</option>`)
    .join('');
}

function renderSection(key) {
  const cfg = SECTIONS[key];
  const rows = state[key] || [];
  const el = q('#' + cfg.container);
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = '<div class="empty-row">Aucune ligne pour le moment.</div>';
    return;
  }

  let html = '<div class="table-scroll"><table class="rowtable"><thead><tr>';
  cfg.cols.forEach(c => {
    html += `<th style="${c.width ? 'width:' + c.width : ''}">${c.label}</th>`;
  });
  html += '<th style="width:32px;"></th></tr></thead><tbody>';

  rows.forEach(row => {
    html += `<tr data-row="${escapeHtml(row._localId)}">`;
    cfg.cols.forEach(c => {
      const val = row[c.key];
      const attrs = `data-section="${key}" data-id="${escapeHtml(row._localId)}" data-field="${c.key}"`;
      if (c.type === 'category') {
        html += `<td><select ${attrs}>${categoryOptions(val)}</select></td>`;
      } else if (c.type === 'select') {
        html += `<td><select ${attrs}>`;
        c.options.forEach(o => {
          html += `<option value="${escapeHtml(o)}" ${o === val ? 'selected' : ''}>${escapeHtml(o)}</option>`;
        });
        html += '</select></td>';
      } else {
        html += `<td><input type="${c.type}" ${attrs} value="${escapeHtml(val ?? '')}"></td>`;
      }
    });
    html += `<td><button class="rm-btn" data-remove="${key}" data-id="${escapeHtml(row._localId)}" title="Supprimer" type="button">&times;</button></td></tr>`;
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function renderAllSections() {
  SECTION_KEYS.forEach(renderSection);
}

// ---------- Scalars ----------

function syncScalarInputs() {
  q('#dateInput').value = state.closing_date;
  q('#especeDebut').value = state.espece_debut;
  root.querySelectorAll('.recette').forEach(i => {
    i.value = state[i.dataset.k];
  });
  root.querySelectorAll('.vente').forEach(i => {
    i.value = state.ventes[i.dataset.k];
  });
  root.querySelectorAll('.item-qty').forEach(i => {
    i.value = state.items[i.dataset.item].qty;
  });
  root.querySelectorAll('.item-prix').forEach(i => {
    i.value = state.items[i.dataset.item].prix;
  });
  q('#diffEspece').value = state.diff_espece;
  q('#especeCompte').value = state.espece_compte ?? '';
}

// ---------- Recalculation ----------

function recalc() {
  const t = computeTotals(state);

  q('#totalRecette').textContent = fmt(t.totalRecette);
  q('#totalVentes').textContent = fmt(t.totalVentes);

  const breakdown = ventesBreakdown(state);
  q('#pctBreakdown').innerHTML = breakdown
    ? breakdown
        .map(b => `<div class="pct-row"><span>${VENTE_SHORT_LABELS[b.key]}</span><span>${b.pct.toFixed(1)}%</span></div>`)
        .join('')
    : '';

  const vals = itemValues(state);
  ITEM_KEYS.forEach(k => {
    q('#val-' + k).textContent = fmt(vals[k]) + ' CFA';
    const priceEl = q('#price-' + k);
    if (priceEl) priceEl.textContent = fmt(state.items[k].prix);
  });

  q('#totalDepenses').textContent = fmt(t.totalDepenses);
  q('#totalAvances').textContent = fmt(t.totalAvances);
  q('#totalCreditClient').textContent = fmt(t.totalCreditClient);
  q('#totalRepas').textContent = fmt(t.totalRepas);
  q('#totalTpe').textContent = fmt(t.totalTpe);
  q('#totalFournisseur').textContent = fmt(t.totalFournisseur);
  q('#totalCheques').textContent = fmt(t.totalCheques);

  q('#s-especeDebut').textContent = fmt(state.espece_debut);
  q('#s-totalRecette').textContent = fmt(t.totalRecette);
  q('#s-grandTotal').textContent = '-' + fmt(t.grandTotal);
  q('#s-totalTpe').textContent = '-' + fmt(t.totalTpe);
  q('#s-diffEspece').textContent = fmt(t.diffEspece);
  q('#s-totalReste').textContent = fmt(t.totalResteEspece) + ' CFA';

  const varEl = q('#varianceLine');
  if (t.variance === null) {
    varEl.textContent = '';
    varEl.className = 'variance ok';
  } else {
    varEl.className = 'variance ' + (t.variance === 0 ? 'ok' : 'bad');
    varEl.textContent =
      t.variance === 0
        ? '✓ Caisse exacte'
        : t.variance > 0
          ? `Excédent de ${fmt(t.variance)} CFA`
          : `Manquant de ${fmt(Math.abs(t.variance))} CFA`;
  }
}

// ---------- Status ----------

function setStatus(msg, ms = 2500, isError = false) {
  const el = q('#statusMsg');
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

// ---------- Persistence ----------

async function refreshLoadList(selected = '') {
  const sel = q('#loadSelect');
  try {
    const dates = await listClosingDates();
    sel.innerHTML =
      '<option value="">Charger un jour enregistré…</option>' +
      dates.map(d => `<option value="${escapeHtml(d)}" ${d === selected ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('');
  } catch (err) {
    console.error(err);
  }
}

async function doSave() {
  const btn = q('#saveBtn');
  btn.disabled = true;
  setStatus('Enregistrement…', 0);
  try {
    await saveDay(state);
    setStatus('Enregistré ✓');
    await refreshLoadList(state.closing_date);
  } catch (err) {
    console.error(err);
    setStatus('Erreur : ' + (err.message || 'enregistrement'), 6000, true);
  } finally {
    btn.disabled = false;
  }
}

async function doLoad(dateStr) {
  setStatus('Chargement…', 0);
  try {
    const loaded = await loadDay(dateStr);
    if (!loaded) {
      setStatus('Jour introuvable', 3000, true);
      return;
    }
    state = loaded;
    syncScalarInputs();
    renderAllSections();
    recalc();
    setStatus('Chargé ✓');
  } catch (err) {
    console.error(err);
    setStatus('Erreur de chargement', 5000, true);
  }
}

// ---------- Events ----------

function wireEvents() {
  q('#dateInput').addEventListener('change', e => {
    state.closing_date = e.target.value;
    // A different date is a different closing row; forget the loaded id.
    state.id = null;
  });
  q('#especeDebut').addEventListener('input', e => {
    state.espece_debut = num(e.target.value);
    recalc();
  });
  root.querySelectorAll('.recette').forEach(i =>
    i.addEventListener('input', e => {
      state[e.target.dataset.k] = num(e.target.value);
      recalc();
    })
  );
  root.querySelectorAll('.vente').forEach(i =>
    i.addEventListener('input', e => {
      state.ventes[e.target.dataset.k] = num(e.target.value);
      recalc();
    })
  );
  root.querySelectorAll('.item-qty').forEach(i =>
    i.addEventListener('input', e => {
      state.items[e.target.dataset.item].qty = num(e.target.value);
      recalc();
    })
  );
  root.querySelectorAll('.item-prix').forEach(i =>
    i.addEventListener('input', e => {
      state.items[e.target.dataset.item].prix = num(e.target.value);
      recalc();
    })
  );
  q('#diffEspece').addEventListener('input', e => {
    state.diff_espece = num(e.target.value);
    recalc();
  });
  q('#especeCompte').addEventListener('input', e => {
    state.espece_compte = e.target.value === '' ? null : num(e.target.value);
    recalc();
  });

  const main = root.querySelector('main');

  const applyRowEdit = target => {
    const { section, id, field } = target.dataset;
    if (!section) return;
    const row = (state[section] || []).find(r => r._localId === id);
    if (!row) return;
    if (target.tagName === 'SELECT') {
      const col = SECTIONS[section].cols.find(c => c.key === field);
      row[field] = col?.type === 'category' ? coerceId(target.value) : target.value;
    } else {
      row[field] = target.type === 'number' ? num(target.value) : target.value;
    }
    recalc();
  };

  main.addEventListener('input', e => applyRowEdit(e.target));
  main.addEventListener('change', e => {
    if (e.target.tagName === 'SELECT') applyRowEdit(e.target);
  });

  main.addEventListener('click', e => {
    const addKey = e.target.dataset.add;
    if (addKey) {
      const defaults = { ...SECTIONS[addKey].defaults };
      if (addKey === 'expense_lines' && categories.length) defaults.category_id = categories[0].id;
      state[addKey].push({ _localId: newLocalId(), ...defaults });
      renderSection(addKey);
      recalc();
      return;
    }
    const rmKey = e.target.dataset.remove;
    if (rmKey) {
      const id = e.target.dataset.id;
      state[rmKey] = state[rmKey].filter(r => r._localId !== id);
      renderSection(rmKey);
      recalc();
    }
  });

  q('#saveBtn').addEventListener('click', doSave);
  q('#loadSelect').addEventListener('change', e => {
    if (e.target.value) doLoad(e.target.value);
  });
  q('#newBtn').addEventListener('click', () => {
    if (confirm('Créer une nouvelle fiche vierge pour aujourd\'hui ? Les modifications non enregistrées seront perdues.')) {
      state = blankState(todayStr());
      q('#loadSelect').value = '';
      syncScalarInputs();
      renderAllSections();
      recalc();
      setStatus('Nouvelle fiche');
    }
  });
}

/** Category ids may be int or uuid; keep ints numeric so FK comparisons hold. */
function coerceId(v) {
  if (v === '') return null;
  return /^\d+$/.test(v) ? Number(v) : v;
}

// ---------- Init ----------

export async function initDayView(container) {
  root = container;
  root.className = 'shell';
  root.innerHTML = template();

  wireEvents();
  syncScalarInputs();
  renderAllSections();
  recalc();

  try {
    categories = await fetchCategories();
    if (!categories.length) {
      setStatus('Aucune catégorie configurée', 6000, true);
    }
    renderSection('expense_lines');
  } catch (err) {
    console.error(err);
    setStatus('Catégories indisponibles', 5000, true);
  }

  await refreshLoadList();
}

export function getCategories() {
  return categories;
}
