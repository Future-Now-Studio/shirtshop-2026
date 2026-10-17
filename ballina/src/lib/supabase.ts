import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Mock mode lets the whole UI run without a live Supabase project (localStorage
// data + demo logins). It is strictly OPT-IN via VITE_USE_MOCK=true — a build
// with missing Supabase env must never silently fall back to it.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

/** Real mode requested but VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing. */
export const CONFIG_ERROR: string | null =
  !USE_MOCK && (!supabaseUrl || !supabaseAnonKey)
    ? [
        !supabaseUrl && 'VITE_SUPABASE_URL',
        !supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
      ].filter(Boolean).join(', ')
    : null

// Invite / password-reset links land with "#…&type=invite|recovery". supabase-js
// consumes and clears that hash on start-up, so remember the type here first.
export const AUTH_LINK_TYPE: 'invite' | 'recovery' | null =
  typeof window !== 'undefined'
    ? ((/[#&]type=(invite|recovery)\b/.exec(window.location.hash)?.[1] as 'invite' | 'recovery' | undefined) ?? null)
    : null

// Only build a real client in real mode with credentials; never throw at import time.
export const supabase =
  !USE_MOCK && supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null
