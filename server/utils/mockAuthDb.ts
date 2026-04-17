import { Storage, verifyPasswordHash } from '../services/storage'
import type { AuthUser } from '../types/storage'

export type { AuthUser } from '../types/storage'

export const verifyUserCredentials = (email: string, password: string): AuthUser | null => {
  const normalizedEmail = email.trim().toLowerCase()
  const row = Object.values(Storage.getAuth()).find((item) => item.email === normalizedEmail)
  if (!row) {
    return null
  }

  const isValid = verifyPasswordHash(password, row.passwordHash)
  if (!isValid) {
    return null
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email
  }
}
