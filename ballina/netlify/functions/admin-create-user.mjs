// Netlify Function V2 — create a login account for a B2B customer.
// A browser cannot create Supabase auth users safely, so the admin front-end
// calls this. It verifies the caller is an admin, then uses the service_role
// key (server-side only) to create the auth user + b2b_profiles row and email
// the customer an invite to set their password.
//
// Required Netlify env vars:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Optional: INVITE_REDIRECT_URL (must be listed under Auth → URL Configuration →
// Redirect URLs). SMTP for the invite email is configured in the Supabase
// dashboard (Auth → SMTP).

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
  if (!me?.id) return json(401, { error: 'Invalid session' })
  const adminRes = await fetch(`${URL_}/rest/v1/b2b_admins?user_id=eq.${encodeURIComponent(me.id)}&select=user_id`, {
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
  const { companyId, email, name, phone } = body || {}
  if (!companyId || !email) return json(400, { error: 'companyId und email erforderlich' })
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { error: 'Ungültige E-Mail-Adresse' })
  }

  const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }

  // 4) Create the user AND send the invite in one step. POST /auth/v1/invite
  //    creates an unconfirmed user and emails the invite link (Auth → SMTP).
  //    (Creating the user first via /admin/users and inviting afterwards fails
  //    for an already-existing user, so the customer never got an email.)
  // The invite link must open the set-password page; default to this site.
  const origin = req.headers.get('origin')
  const redirectTo = process.env.INVITE_REDIRECT_URL || (origin ? `${origin}/passwort-setzen` : undefined)
  const inviteRes = await fetch(`${URL_}/auth/v1/invite${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''}`, {
    method: 'POST',
    headers: svc,
    body: JSON.stringify({ email, data: { name: name ?? null } }),
  })
  if (!inviteRes.ok) {
    const err = await inviteRes.text()
    console.error('[admin-create-user] invite failed', inviteRes.status, err)
    return json(502, { error: `Einladung konnte nicht versendet werden (${inviteRes.status}): ${err.slice(0, 300)}` })
  }
  const user = await inviteRes.json()
  if (!user?.id) return json(502, { error: 'Einladung: keine User-ID erhalten' })

  // 5) Link the profile (service_role → bypasses RLS). Roll back the auth user
  //    on failure so a retry is possible.
  const profRes = await fetch(`${URL_}/rest/v1/b2b_profiles`, {
    method: 'POST',
    headers: { ...svc, Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: user.id, company_id: companyId, name: name ?? null, email, phone: phone ?? null }),
  })
  if (!profRes.ok) {
    const err = await profRes.text()
    await fetch(`${URL_}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE', headers: svc }).catch(() => {})
    return json(400, { error: `Profil konnte nicht verknüpft werden: ${err.slice(0, 300)}` })
  }

  return json(200, { ok: true, userId: user.id, invited: true })
}

export const config = { path: '/api/admin-create-user' }
