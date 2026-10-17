// Creates the demo logins on a LOCAL Supabase stack (supabase start) so
// 004_seed.sql / 005_admin.sql can link them. Never run against production.
//
//   SUPABASE_URL=http://127.0.0.1:<port> SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-local-test.mjs
//   ./supabase/apply.sh "postgresql://postgres:postgres@127.0.0.1:<db-port>/postgres" --fresh
//
// Local test logins: einkauf@brauhaus-lindental.de / local-test-kunde-123
//                    admin@ballina.de               / local-test-admin-123
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? ''
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('only for a local Supabase (SUPABASE_URL=127.0.0.1)')
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const USERS = [
  ['einkauf@brauhaus-lindental.de', 'local-test-kunde-123'],
  ['admin@ballina.de', 'local-test-admin-123'],
]
const { data } = await admin.auth.admin.listUsers()
for (const [email, password] of USERS) {
  if (data.users.some((u) => u.email === email)) continue
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
}
console.log('Local test users ready.')
