import { randomBytes } from 'node:crypto'

// In-memory session store. Sessions are lost on server restart.
// For production, replace with Redis or a database.
const sessions = new Map()

export function createSession(token, user) {
  const sessionId = randomBytes(32).toString('hex')
  sessions.set(sessionId, { token, user, createdAt: Date.now() })
  return sessionId
}

export function getSession(sessionId) {
  return sessions.get(sessionId) || null
}

export function deleteSession(sessionId) {
  sessions.delete(sessionId)
}
