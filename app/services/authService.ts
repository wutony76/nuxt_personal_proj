import { api, type AuthUser } from '~/services/api'

export class AuthService {
  fetchMe() {
    return api.auth.me() as Promise<{ user: AuthUser }>
  }

  submitLogin(payload: { email: string; password: string }) {
    return api.auth.login(payload) as Promise<{ user: AuthUser }>
  }

  submitLogout() {
    return api.auth.logout() as Promise<void>
  }
}
