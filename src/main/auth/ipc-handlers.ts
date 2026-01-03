import { ipcMain, shell, BrowserWindow } from 'electron'
import { authService, getAuthState } from './auth-service'
import { AUTH_CHANNELS, type AuthIpcResult, type AuthChangePayload } from './types'

export function setupAuthIpcHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle(AUTH_CHANNELS.SIGN_IN, async (): Promise<AuthIpcResult> => {
    try {
      const url = await authService.getSignInUrl()
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      console.error('Sign in failed:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(AUTH_CHANNELS.SIGN_OUT, async (): Promise<AuthIpcResult> => {
    try {
      const auth = await getAuthState()

      if (auth.user) {
        const { logoutUrl } = await authService.signOut(auth.sessionId)
        await shell.openExternal(logoutUrl)
      } else {
        await authService.clearSession({})
      }

      notifyAuthChange(mainWindow, null)
      return { success: true }
    } catch (error) {
      console.error('Sign out failed:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(AUTH_CHANNELS.GET_USER, async () => {
    try {
      const { user } = await getAuthState()
      return user ?? null
    } catch (error) {
      console.error('Get user failed:', error)
      return null
    }
  })
}

export function notifyAuthChange(mainWindow: BrowserWindow, user: AuthChangePayload['user']): void {
  mainWindow.webContents.send(AUTH_CHANNELS.ON_AUTH_CHANGE, { user })
}
