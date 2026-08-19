# Schema notes

`schema.sql` was not in this repository, so the schema below was recovered by
probing the live PostgREST API with the publishable key. **This is a column
inventory, not a DDL file** — it deliberately does not include types,
constraints, defaults, indexes, or RLS policies, because those are not
observable through PostgREST. Do not treat it as something to re-apply.

If you have the original `schema.sql`, add it and delete this file.

## Tables

| Table | Columns |
|---|---|
| `categories` | `id`, `name`, `sort_order`, `active` |
| `daily_closings` | `id`, `closing_date`, `espece_debut`, `recette_s1`, `recette_s2`, `recette_s3`, `ventes_food`, `ventes_bev`, `ventes_dessert`, `ventes_b2b`, `ventes_misc`, `item_philly_viande_qty`, `item_philly_viande_prix`, `item_philly_poulet_qty`, `item_philly_poulet_prix`, `item_plat_du_jour_qty`, `item_plat_du_jour_prix`, `diff_espece`, `espece_compte`, `created_at`, `updated_at` |
| `expense_lines` | `id`, `closing_id`, `category_id`, `montant`, `fournisseur`, `facture`, `detail` |
| `avances` | `id`, `closing_id`, `montant`, `nom`, `detail` |
| `credit_client` | `id`, `closing_id`, `montant`, `nom`, `detail` |
| `repas_personnel` | `id`, `closing_id`, `montant`, `staff`, `numero`, `detail` |
| `annulations` | `id`, `closing_id`, `montant`, `raison`, `table_num` |
| `tpe_paiements` | `id`, `closing_id`, `montant`, `type`, `terminal`, `table_num` |
| `credit_fournisseur` | `id`, `closing_id`, `montant`, `nom`, `facture`, `detail` |
| `cheques` | `id`, `closing_id`, `montant`, `nom`, `numero`, `type` |

## View

`monthly_category_report` → `date`, `categorie`, `montant`, `description`, `detail`

## Naming notes

Table and column naming is mixed French/English. All of it is confined to
`src/sections.js` and `src/api.js` so the rest of the app never sees it:

- `expense_lines` is English; the other seven line tables are French.
- `annulations.table_num` and `tpe_paiements.table_num` hold the table number
  (`table` is reserved in SQL).
- `tpe_paiements.type` holds the Orange Money / TPE value that the prototype
  called `banque`.
- Sales figures and the three item counters are **columns on `daily_closings`**,
  not child tables — so the eight child tables map one-to-one onto the
  prototype's eight repeating sections.

## Row ordering (known limitation)

Child rows have a **UUID** primary key and no `position`, `sort_order`, or
`created_at` column, so there is nothing to sort a manager's lines by. Ordering
by `id` shuffles them. `loadDay()` therefore issues no `ORDER BY` and relies on
PostgREST returning heap order, which matches entry order because `saveDay()`
deletes and re-inserts each table's rows in one statement.

That works reliably today but Postgres does not guarantee heap order. Adding an
integer `position` column to each of the eight child tables would make it a
guarantee. That is a schema change, so it has not been made.

## RLS

Anon can `SELECT` most tables; `INSERT` is rejected
(`42501 new row violates row-level security policy`), so all writes require an
authenticated session — consistent with the single-manager login.

`categories` is stricter: `SELECT` is limited to authenticated users (anon sees
zero rows), and there is no `INSERT` policy at all, even for authenticated
users. Seed or edit that list from the Supabase SQL editor or dashboard. The
app only ever reads it, and only after login, so this is fine.
