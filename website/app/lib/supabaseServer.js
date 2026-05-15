/* Server-side Supabase client for SSR (no auth needed for public reads) */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Server client — used in server components for SSR data fetching
export function createServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export const SITE_URL = 'https://ring-in.vercel.app'
export const SITE_NAME = 'RingIn'
export const SITE_TAGLINE = 'Talk to Experts Instantly'
export const SITE_DESCRIPTION = 'Connect with verified domain experts — doctors, lawyers, coaches, engineers, and more. Pay per minute via secure call. Earn coins by helping others.'
