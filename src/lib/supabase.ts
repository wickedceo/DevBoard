import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

function isValidSupabaseUrl(value: string | undefined): value is string {
  if (!value) return false

  try {
    const url = new URL(value)
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

const validSupabaseUrl = isValidSupabaseUrl(supabaseUrl)

export const supabaseConfigured = Boolean(validSupabaseUrl && supabaseAnonKey)

export const supabaseConfigError =
  !validSupabaseUrl
    ? 'VITE_SUPABASE_URL must be a valid HTTP(S) URL. Check .env.local and restart the development server.'
    : 'VITE_SUPABASE_ANON_KEY is missing. Add the public anon key to .env.local and restart the development server.'

export const supabase = createClient(
  validSupabaseUrl ? supabaseUrl : 'https://example.supabase.co',
  supabaseAnonKey || 'supabase-configuration-required',
)
