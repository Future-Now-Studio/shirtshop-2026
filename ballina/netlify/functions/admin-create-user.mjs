// Netlify Function V2 — create (or re-invite) the login account of a B2B customer.
// A browser cannot create Supabase auth users safely, so the admin front-end
// calls this. It verifies the caller is an admin, then uses the service_role
// key (server-side only) to create the auth user, link the b2b_profiles row
// and email the customer an invite to set their password.
//
// Required Netlify env vars:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Optional: INVITE_REDIRECT_URL (must be listed under Auth → URL Configuration →
// Redirect URLs). SMTP for the invite email is configured in the Supabase
// dashboard (Auth → SMTP).
//
// Body: { companyId, email, name?, phone? }
// Flow (one customer = one login):
//   1. company must exist and must not have another login;
//   2. e-mail without account → create the user (no mail yet), link the
//      profile, THEN send the invite — so the link in the mail always works;
//   3. e-mail already invited for THIS company but not yet confirmed → the
//      invite is sent again ("Einladung erneut senden"; nothing is deleted);
//   4. e-mail belongs to another customer, an admin or an active login → 409.
// Rollback only ever deletes rows/users that this request created.

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EXISTS_MSG = 'Für diese E-Mail-Adresse existiert bereits ein Zugang.'

// Readable German message for a GoTrue error (raw text only goes to the log).
function authError(status, text) {
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    /* not JSON */
  }
  const code = body?.error_code ?? body?.code
  if (code === 'email_exists' || code === 'user_already_exists' || /already (been )?registered/i.test(text)) return EXISTS_MSG
  if (status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return 'Das E-Mail-Limit des Auth-Servers ist erreicht. Bitte in einigen Minuten erneut versuchen (dauerhaft: eigenen SMTP-Server in Supabase hinterlegen).'
  }
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'Die E-Mail-Adresse wurde vom Auth-Server abgelehnt.'
  return `Fehler des Auth-Servers (${status}).`
}

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

  const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }
  const get = async (path) => {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: svc })
    return r.ok ? r.json() : null
  }

  // 2) Is the caller an admin? (query via service_role → bypasses RLS)
  if (!me?.id || !UUID_RE.test(me.id)) return json(401, { error: 'Invalid session' })
  const admins = await get(`b2b_admins?user_id=eq.${me.id}&select=user_id`)
  if (!admins?.length) return json(403, { error: 'Nur Admins dürfen Nutzer anlegen.' })

  // 3) Input
  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  const companyId = typeof body?.companyId === 'string' ? body.companyId : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 200) : null
  const phone = typeof body?.phone === 'string' && body.phone.trim() ? body.phone.trim().slice(0, 50) : null
  if (!companyId || !email) return json(400, { error: 'companyId und email erforderlich' })
  if (!UUID_RE.test(companyId)) return json(400, { error: 'Ungültige Kunden-ID' })
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { error: 'Ungültige E-Mail-Adresse' })
  }

  // 4) Company + its current login (one customer = one account).
  const [companies, companyLogins] = await Promise.all([
    get(`b2b_companies?id=eq.${companyId}&select=id,name`),
    get(`b2b_profiles?company_id=eq.${companyId}&select=user_id,email`),
  ])
  if (!companies?.length) return json(404, { error: 'Kunde nicht gefunden.' })

  // 5) Is there already an account for this e-mail? (RPC from migration 014;
  //    without it only brand-new e-mails can be invited.)
  let existing = null
  const lookupRes = await fetch(`${URL_}/rest/v1/rpc/b2b_auth_user_lookup`, {
    method: 'POST',
    headers: svc,
    body: JSON.stringify({ p_email: email }),
  })
  const lookupAvailable = lookupRes.ok
  if (lookupAvailable) {
    const rows = await lookupRes.json()
    existing = Array.isArray(rows) && rows[0]?.user_id ? rows[0] : null
  } else {
    console.error('[admin-create-user] b2b_auth_user_lookup unavailable – is migration 014 applied?', lookupRes.status)
  }

  const origin = req.headers.get('origin')
  const redirectTo =
    process.env.INVITE_REDIRECT_URL || (origin && /^https?:\/\/[^\s/]+$/.test(origin) ? `${origin}/passwort-setzen` : undefined)
  // POST /auth/v1/invite sends the invite mail; for an existing, unconfirmed
  // user it sends it again (a confirmed user gets 422 email_exists).
  const sendInvite = () =>
    fetch(`${URL_}/auth/v1/invite${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''}`, {
      method: 'POST',
      headers: svc,
      body: JSON.stringify({ email, data: { name } }),
    })
  const linkProfile = (userId) =>
    fetch(`${URL_}/rest/v1/b2b_profiles`, {
      method: 'POST',
      headers: { ...svc, Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: userId, company_id: companyId, name, email, phone }),
    })
  const profileError = async (res) => {
    const text = await res.text()
    console.error('[admin-create-user] profile insert failed', res.status, text.slice(0, 300))
    if (/b2b_profiles_company_id_key/.test(text)) return 'Dieser Kunde hat bereits einen Zugang.'
    if (/b2b_profiles_user_id_key/.test(text)) return EXISTS_MSG
    if (/foreign key/i.test(text)) return 'Kunde nicht gefunden.'
    return 'Profil konnte nicht verknüpft werden.'
  }

  if (existing) {
    if (existing.is_admin) return json(409, { error: 'Diese E-Mail-Adresse gehört zu einem Backoffice-Zugang.' })
    if (existing.company_id && existing.company_id !== companyId) {
      return json(409, { error: `${EXISTS_MSG} (Kunde „${existing.company_name ?? 'unbekannt'}“)` })
    }
    if (existing.confirmed) {
      return json(409, {
        error: existing.company_id
          ? 'Der Kunde hat sein Passwort bereits gesetzt. Für einen neuen Link „Passwort vergessen?“ auf der Login-Seite nutzen.'
          : EXISTS_MSG,
      })
    }
    // Unconfirmed account without profile (e.g. from an earlier failed attempt): link it.
    let linkedNow = false
    if (!existing.company_id) {
      if (companyLogins?.length) return json(409, { error: `Dieser Kunde hat bereits einen Zugang (${companyLogins[0].email}).` })
      const profRes = await linkProfile(existing.user_id)
      if (!profRes.ok) return json(400, { error: await profileError(profRes) })
      linkedNow = true
    }
    const inviteRes = await sendInvite()
    if (!inviteRes.ok) {
      const text = await inviteRes.text()
      console.error('[admin-create-user] re-invite failed', inviteRes.status, text.slice(0, 300))
      // Only undo what this request did; the pre-existing user stays.
      if (linkedNow) {
        await fetch(`${URL_}/rest/v1/b2b_profiles?user_id=eq.${existing.user_id}&company_id=eq.${companyId}`, {
          method: 'DELETE',
          headers: svc,
        }).catch(() => {})
      }
      return json(502, { error: `Einladung konnte nicht versendet werden: ${authError(inviteRes.status, text)}` })
    }
    return json(200, { ok: true, userId: existing.user_id, invited: true, resent: !linkedNow })
  }

  // 6) New account. Without the lookup RPC, an existing e-mail shows up as 422 here.
  if (companyLogins?.length) return json(409, { error: `Dieser Kunde hat bereits einen Zugang (${companyLogins[0].email}).` })
  const createRes = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: 'POST',
    headers: svc,
    body: JSON.stringify({ email, email_confirm: false, user_metadata: { name } }),
  })
  if (!createRes.ok) {
    const text = await createRes.text()
    console.error('[admin-create-user] create failed', createRes.status, text.slice(0, 300))
    return json(createRes.status === 422 ? 409 : 502, { error: authError(createRes.status, text) })
  }
  const user = await createRes.json()
  if (!user?.id) return json(502, { error: 'Auth-Server: keine User-ID erhalten' })
  const dropUser = () =>
    fetch(`${URL_}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE', headers: svc }).catch(() => {})

  // 7) Link the profile BEFORE the invite goes out (the profile cascades away
  //    with the user if we have to roll back).
  const profRes = await linkProfile(user.id)
  if (!profRes.ok) {
    const error = await profileError(profRes)
    await dropUser()
    return json(400, { error })
  }

  // 8) Send the invite.
  const inviteRes = await sendInvite()
  if (!inviteRes.ok) {
    const text = await inviteRes.text()
    console.error('[admin-create-user] invite failed', inviteRes.status, text.slice(0, 300))
    await dropUser()
    return json(502, { error: `Einladung konnte nicht versendet werden: ${authError(inviteRes.status, text)}` })
  }

  return json(200, { ok: true, userId: user.id, invited: true })
}

export const config = { path: '/api/admin-create-user' }
