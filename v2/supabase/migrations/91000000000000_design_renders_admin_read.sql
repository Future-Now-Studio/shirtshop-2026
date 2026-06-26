-- Let the authenticated admin read design render PNGs (private bucket) so the
-- orders admin can preview customer designs via signed URLs.
create policy "admin read design-renders" on storage.objects
  for select to authenticated
  using (bucket_id = 'design-renders');
