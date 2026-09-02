// Netlify Function V2 — create a login account for a B2B customer.
// A browser cannot create Supabase auth users safely, so the admin front-end
// calls this. It verifies the caller is an admin, then uses the service_role
// key (server-side only) to create the auth user + b2b_profiles row and email
// the customer an invite to set their password.
//
// Required Netlify env vars:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// SMTP for the invite email is configured in the Supabase dashboard (Auth → SMTP).

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const URL_ = process.env.SUPABASE_URL
  const ANON = process.env.SUPABASE_ANON_KEY
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!URL_ || !ANON || !SERVICE) return json(500, { error: 'Supabase env vars missing' })

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Not authenticated' })

  // 1) Who is calling?
  const meRes = await fetch(`${URL_}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  })
  if (!meRes.ok) return json(401, { error: 'Invalid session' })
  const me = await meRes.json()

  // 2) Is the caller an admin? (query via service_role → bypasses RLS)
  const adminRes = await fetch(`${URL_}/rest/v1/b2b_admins?user_id=eq.${me.id}&select=user_id`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  })
  const admins = adminRes.ok ? await adminRes.json() : []
  if (!admins.length) return json(403, { error: 'Nur Admins dürfen Nutzer anlegen.' })

  // 3) Input
  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  const { companyId, email, name } = body || {}
  if (!companyId || !email) return json(400, { error: 'companyId und email erforderlich' })

  // 4) Create the auth user (confirmed) via the Admin API
  const createRes = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, email_confirm: true, user_metadata: { name } }),
  })
  if (!createRes.ok) {
    const err = await createRes.text()
    return json(400, { error: `Nutzer konnte nicht angelegt werden: ${err}` })
  }
  const user = await createRes.json()

  // 5) Link the profile (service_role → bypasses RLS)
  const profRes = await fetch(`${URL_}/rest/v1/b2b_profiles`, {
    method: 'POST',
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ user_id: user.id, company_id: companyId, name: name ?? null, email }),
  })
  if (!profRes.ok) {
    const err = await profRes.text()
    return json(400, { error: `Profil konnte nicht verknüpft werden: ${err}` })
  }

  // 6) Email an invite so the customer sets their own password
  await fetch(`${URL_}/auth/v1/invite`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).catch(() => {})

  return json(200, { ok: true, userId: user.id })
}

export const config = { path: '/api/admin-create-user' }
