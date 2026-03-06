import { randomBytes } from 'node:crypto'
import { supabase } from './supabase.js'

const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function createSession(token, user) {
  const sessionId = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()

  const { error } = await supabase.from('sessions').insert({
    session_id: sessionId,
    github_token: token,
    user_data: user,
    expires_at: expiresAt,
  })

  if (error) throw new Error(`Failed to create session: ${error.message}`)
  return sessionId
}

export async function getSession(sessionId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('github_token, user_data, expires_at')
    .eq('session_id', sessionId)
    .single()

  if (error || !data) return null

  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('sessions').delete().eq('session_id', sessionId)
    return null
  }

  return { token: data.github_token, user: data.user_data }
}

export async function deleteSession(sessionId) {
  await supabase.from('sessions').delete().eq('session_id', sessionId)
}

async function cleanExpiredSessions() {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())

  if (error) console.error('[sessions] cleanup error:', error.message)
}

// Clean up expired sessions every 10 minutes
setInterval(cleanExpiredSessions, 10 * 60 * 1000)
