export type AuthUser = {
  id: string
  name: string
  email: string
}

export type AuthRecord = AuthUser & {
  passwordHash: string
}

export type SessionRecord = {
  user: AuthUser
  expiresAt: number
}

