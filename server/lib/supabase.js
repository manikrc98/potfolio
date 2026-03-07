import { createClient } from '@supabase/supabase-js'

let _supabase = null

export function getSupabase() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY
    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables')
    }
    _supabase = createClient(url, key)
  }
  return _supabase
}

// Backwards-compatible named export (getter)
export const supabase = new Proxy({}, {
  get(_, prop) {
    return getSupabase()[prop]
  },
})
