-- Pair labor + material line entries in the editor by giving each
-- "entry row" a shared line_group uuid. Two rows with the same group
-- render side-by-side in the editor (labor left, material right);
-- a row with line_group=null is a stand-alone line (back-compat with
-- everything that existed before this change).

alter table estimate_line_items
  add column if not exists line_group uuid;

alter table invoice_line_items
  add column if not exists line_group uuid;

-- Helpful for grouping reads but optional. Sort_order still determines
-- entry ordering; line_group resolves WHICH sub-rows within an entry
-- pair up.
create index if not exists estimate_line_items_line_group_idx
  on estimate_line_items (estimate_id, line_group);
create index if not exists invoice_line_items_line_group_idx
  on invoice_line_items (invoice_id, line_group);
