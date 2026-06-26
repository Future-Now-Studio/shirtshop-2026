import { admin, run, assert } from './_clients.mjs';

await run('storage buckets', async () => {
  const { data, error } = await admin.storage.listBuckets();
  assert(!error, 'can list buckets');
  const pi = data?.find(b => b.id === 'product-images');
  const dr = data?.find(b => b.id === 'design-renders');
  assert(!!pi, 'product-images bucket exists');
  assert(pi?.public === true, 'product-images is public');
  assert(!!dr, 'design-renders bucket exists');
  assert(dr?.public === false, 'design-renders is private');
});
