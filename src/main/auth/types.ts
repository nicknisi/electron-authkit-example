import type { User } from '@workos/authkit-session'

// Marker types for authkit-session generic interface (Electron doesn't use HTTP req/res)
export type ElectronRequest = Record<string, never>
export type ElectronResponse = Record<string, never>

export const AUTH_CHANNELS = {
  SIGN_IN: 'auth:sign-in',
  SIGN_OUT: 'auth:sign-out',
  GET_USER: 'auth:get-user',
  ON_AUTH_CHANGE: 'auth:on-auth-change'
} as const

export interface AuthIpcResult {
  success: boolean
  error?: string
}

export interface AuthChangePayload {
  user: User | null
}
