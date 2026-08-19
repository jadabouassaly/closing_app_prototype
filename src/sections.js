// The 8 repeating "line" sections of the day sheet.
//
// Section keys are the Supabase table names, and every column `key` is the real
// database column name, so a state row can be inserted as-is with no mapping
// step. The live schema mixes French and English (expense_lines vs avances,
// table_num vs numero de table), which is why this file exists: it is the only
// place those names appear.

export const SECTIONS = {
  expense_lines: {
    container: 'tbl-depenses',
    addLabel: '+ Ajouter une dépense',
    cols: [
      { key: 'montant', label: 'Montant', type: 'number', width: '110px' },
      { key: 'fournisseur', label: 'Fournisseur', type: 'text' },
      { key: 'facture', label: 'N° Facture', type: 'text', width: '110px' },
      { key: 'detail', label: 'Détail', type: 'text' },
      { key: 'category_id', label: 'Catégorie', type: 'category', width: '170px' }
    ],
    defaults: { montant: 0, fournisseur: '', facture: '', detail: '', category_id: null }
  },
  avances: {
    container: 'tbl-avances',
    addLabel: '+ Ajouter une avance',
    cols: [
      { key: 'montant', label: 'Montant', type: 'number', width: '110px' },
      { key: 'nom', label: 'Nom', type: 'text' },
      { key: 'detail', label: 'Détail', type: 'text' }
    ],
    defaults: { montant: 0, nom: '', detail: '' }
  },
  credit_client: {
    container: 'tbl-creditClient',
    addLabel: '+ Ajouter une ligne',
    cols: [
      { key: 'montant', label: 'Montant', type: 'number', width: '110px' },
      { key: 'nom', label: 'Nom', type: 'text' },
      { key: 'detail', label: 'Détail', type: 'text' }
    ],
    defaults: { montant: 0, nom: '', detail: '' }
  },
  repas_personnel: {
    container: 'tbl-repas',
    addLabel: '+ Ajouter un repas',
    cols: [
      { key: 'staff', label: 'Personnel', type: 'text' },
      { key: 'numero', label: 'N°', type: 'text', width: '70px' },
      { key: 'detail', label: 'Détail', type: 'text' },
      { key: 'montant', label: 'Montant', type: 'number', width: '110px' }
    ],
    defaults: { staff: '', numero: '', detail: 'DUTY MEAL', montant: 0 }
  },
  annulations: {
    container: 'tbl-annulations',
    addLabel: '+ Ajouter une annulation',
    cols: [
      { key: 'table_num', label: 'N° Table', type: 'text', width: '90px' },
      { key: 'montant', label: 'Montant', type: 'number', width: '110px' },
      {
        key: 'raison',
        label: 'Raison',
        type: 'select',
        options: ['VOID', 'RECUPERATION SERVICE', 'COMPLEMENTARY', 'STAFF MEAL 50%', 'HAPPY HOUR 50%', 'AUTRE']
      }
    ],
    defaults: { table_num: '', montant: 0, raison: 'VOID' }
  },
  tpe_paiements: {
    container: 'tbl-tpe',
    addLabel: '+ Ajouter un paiement',
    cols: [
      // `type` is what the prototype called `banque`.
      { key: 'type', label: 'Type', type: 'select', options: ['Orange Money', 'TPE / Carte', 'Autre'] },
      { key: 'table_num', label: 'N° Table', type: 'text', width: '90px' },
      { key: 'terminal', label: 'N° Terminal', type: 'text', width: '110px' },
      { key: 'montant', label: 'Montant', type: 'number', width: '110px' }
    ],
    defaults: { type: 'Orange Money', table_num: '', terminal: '', montant: 0 }
  },
  credit_fournisseur: {
    container: 'tbl-fournisseur',
    addLabel: '+ Ajouter un fournisseur',
    cols: [
      { key: 'nom', label: 'Nom', type: 'text' },
      { key: 'montant', label: 'Montant', type: 'number', width: '110px' },
      { key: 'facture', label: 'N° Facture', type: 'text', width: '110px' },
      { key: 'detail', label: 'Détail', type: 'text' }
    ],
    defaults: { nom: '', montant: 0, facture: '', detail: '' }
  },
  cheques: {
    container: 'tbl-cheques',
    addLabel: '+ Ajouter un chèque',
    cols: [
      { key: 'nom', label: 'Nom', type: 'text' },
      { key: 'montant', label: 'Montant', type: 'number', width: '110px' },
      { key: 'numero', label: 'N° Chèque', type: 'text', width: '110px' },
      { key: 'type', label: 'Type', type: 'select', options: ['Entrée', 'Sortie'] }
    ],
    defaults: { nom: '', montant: 0, numero: '', type: 'Sortie' }
  }
};

export const SECTION_KEYS = Object.keys(SECTIONS);

// Scalar columns on daily_closings, grouped the way the form uses them.
export const ITEM_KEYS = ['philly_viande', 'philly_poulet', 'plat_du_jour'];

export const ITEM_LABELS = {
  philly_viande: 'Philly Viande',
  philly_poulet: 'Philly Poulet',
  plat_du_jour: 'Plat du Jour'
};

// Philly prices are fixed references in the prototype; only Plat du Jour is editable.
export const ITEM_PRICE_EDITABLE = { philly_viande: false, philly_poulet: false, plat_du_jour: true };

export const VENTE_KEYS = ['food', 'bev', 'dessert', 'b2b', 'misc'];

export const VENTE_LABELS = {
  food: 'Food',
  bev: 'Bev',
  dessert: 'Dessert',
  b2b: 'B2B',
  misc: 'Miscellaneous'
};

export const VENTE_SHORT_LABELS = {
  food: 'Food',
  bev: 'Bev',
  dessert: 'Dessert',
  b2b: 'B2B',
  misc: 'Misc'
};
