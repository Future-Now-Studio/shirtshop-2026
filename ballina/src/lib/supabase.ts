import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Mock mode lets the whole UI run without a live Supabase project.
// Flip to real data by removing VITE_USE_MOCK (or setting it to false) once
// a working Supabase project URL + anon key are in .env.
export const USE_MOCK =
  import.meta.env.VITE_USE_MOCK === 'true' || !supabaseUrl || !supabaseAnonKey

// Only build a real client when we have credentials; never throw at import time.
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null
