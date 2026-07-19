import { createClient } from '@supabase/supabase-js'
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
