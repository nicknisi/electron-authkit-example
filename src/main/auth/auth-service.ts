import { createAuthService, configure, type AuthResult } from '@workos/authkit-session'
import { ElectronSessionStorage } from './ElectronSessionStorage'
import type { ElectronRequest, ElectronResponse } from './types'

configure({
  clientId: import.meta.env.MAIN_VITE_WORKOS_CLIENT_ID,
  apiKey: import.meta.env.MAIN_VITE_WORKOS_API_KEY,
  cookiePassword: import.meta.env.MAIN_VITE_WORKOS_COOKIE_PASSWORD,
  redirectUri: 'workos-auth://callback'
})

export const authService = createAuthService<ElectronRequest, ElectronResponse>({
  sessionStorageFactory: (config) => new ElectronSessionStorage(config)
})

export async function getAuthState(): Promise<AuthResult> {
  const { auth, refreshedSessionData } = await authService.withAuth({})

  if (refreshedSessionData) {
    await authService.saveSession({}, refreshedSessionData)
  }

  return auth
}
