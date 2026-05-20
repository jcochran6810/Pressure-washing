-- Allow anonymous reads of estimate reference photos when the parent
-- estimate has a valid approval_token. Matches the existing
-- "public read by token" policy on estimates + "public read line items"
-- on estimate_line_items so the customer-facing /quote/[token] view can
-- include the pictures the operator attached.
--
-- Tight as we can: only kind='reference' photos, only when the linked
-- estimate has an approval_token set, only for SELECT. Anon role can't
-- list or query for arbitrary estimate photos without already knowing
-- the matching estimate id.

drop policy if exists "public read estimate reference photos by token" on photo_attachments;
create policy "public read estimate reference photos by token"
  on photo_attachments
  for select
  using (
    kind = 'reference'
    and estimate_id is not null
    and exists (
      select 1
        from estimates e
       where e.id = photo_attachments.estimate_id
         and e.approval_token is not null
    )
  );
