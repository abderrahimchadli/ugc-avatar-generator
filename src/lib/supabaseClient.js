import { createClient } from '@supabase/supabase-js'

const env = import.meta.env || {}
const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY

export const hasSupabaseConfig = Boolean(url && anonKey)

export const supabase = hasSupabaseConfig
  ? createClient(url, anonKey)
  : null
