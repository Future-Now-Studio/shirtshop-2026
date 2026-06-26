import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error('Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY in .env');
}

// Anon client: subject to RLS as the public role.
export const anon = createClient(url, anonKey, { auth: { persistSession: false } });

// Service-role client: bypasses RLS; used for admin-side and constraint checks.
export const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

export function assert(cond, msg) {
  if (!cond) {
    console.error('  ✗ ' + msg);
    process.exitCode = 1;
  } else {
    console.log('  ✓ ' + msg);
  }
}

export async function run(name, fn) {
  console.log('# ' + name);
  try {
    await fn();
  } catch (e) {
    console.error('  ✗ threw: ' + e.message);
    process.exitCode = 1;
  }
  if (process.exitCode) {
    console.error('FAIL: ' + name);
    process.exit(1);
  }
  console.log('PASS: ' + name);
}
