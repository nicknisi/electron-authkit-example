import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Channel names must match AUTH_CHANNELS in src/main/auth/types.ts
const AUTH_CHANNELS = {
  SIGN_IN: 'auth:sign-in',
  SIGN_OUT: 'auth:sign-out',
  GET_USER: 'auth:get-user',
  ON_AUTH_CHANGE: 'auth:on-auth-change'
} as const

const authApi = {
  signIn: () => ipcRenderer.invoke(AUTH_CHANNELS.SIGN_IN),
  signOut: () => ipcRenderer.invoke(AUTH_CHANNELS.SIGN_OUT),
  getUser: () => ipcRenderer.invoke(AUTH_CHANNELS.GET_USER),
  onAuthChange: (callback: (data: { user: unknown }) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: { user: unknown }): void => callback(data)
    ipcRenderer.on(AUTH_CHANNELS.ON_AUTH_CHANGE, listener)
    return () => ipcRenderer.removeListener(AUTH_CHANNELS.ON_AUTH_CHANGE, listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('auth', authApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.auth = authApi
}
