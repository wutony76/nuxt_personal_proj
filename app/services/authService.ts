import { api, type AuthUser } from '~/services/api'

export class AuthService {
  /** @param opts.headers SSR 轉發用（useRequestHeaders(['cookie'])），見 add-ssr-admin-reports-cookie-forward */
  fetchMe(opts?: { headers?: HeadersInit }) {
    return api.auth.me(opts) as Promise<{ user: AuthUser }>
  }

  submitLogin(payload: { email: string; password: string }) {
    return api.auth.login(payload) as Promise<{ user: AuthUser }>
  }

  submitLogout() {
    return api.auth.logout() as Promise<void>
  }
}
