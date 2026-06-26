import { admin, run, assert } from './_clients.mjs';

await run('connection + empty public schema', async () => {
  // products table should NOT exist yet (PostgREST returns PGRST205 / 404 for unknown table)
  const { error } = await admin.from('products').select('id').limit(1);
  assert(!!error, 'products table does not exist yet (expected before migrations)');
});
