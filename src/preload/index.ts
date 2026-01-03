import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const CH = {
  SIGN_IN: 'auth:sign-in',
  SIGN_OUT: 'auth:sign-out',
  GET_USER: 'auth:get-user',
  ON_AUTH_CHANGE: 'auth:on-auth-change'
} as const

const authApi = {
  signIn: () => ipcRenderer.invoke(CH.SIGN_IN),
  signOut: () => ipcRenderer.invoke(CH.SIGN_OUT),
  getUser: () => ipcRenderer.invoke(CH.GET_USER),
  onAuthChange: (callback: (data: { user: unknown }) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: { user: unknown }): void => callback(data)
    ipcRenderer.on(CH.ON_AUTH_CHANGE, listener)
    return () => ipcRenderer.removeListener(CH.ON_AUTH_CHANGE, listener)
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
