import Store from 'electron-store'
import type { SessionStorage, AuthKitConfig } from '@workos/authkit-session'
import type { ElectronRequest, ElectronResponse } from './types'

interface StoreSchema {
  session: string | null
}

export class ElectronSessionStorage implements SessionStorage<ElectronRequest, ElectronResponse> {
  private store: Store<StoreSchema>

  constructor(config: AuthKitConfig) {
    this.store = new Store<StoreSchema>({
      name: 'authkit-session',
      encryptionKey: config.cookiePassword,
      defaults: { session: null }
    })
  }

  async getSession(): Promise<string | null> {
    return this.store.get('session', null)
  }

  async saveSession(_: ElectronResponse | undefined, sessionData: string): Promise<object> {
    this.store.set('session', sessionData)
    return {}
  }

  async clearSession(): Promise<object> {
    this.store.delete('session')
    return {}
  }
}
