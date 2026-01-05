# Adding WorkOS AuthKit to an Electron App

This guide walks through integrating WorkOS AuthKit into an Electron application using `@workos/authkit-session`.

## Why authkit-session?

If you've used `@workos-inc/authkit-nextjs`, you know it handles a lot: session cookies, token refresh, encryption. But it's built for Next.js. Electron doesn't have HTTP cookies or server-side sessions—your main process is the "server" and the renderer is the "client."

`@workos/authkit-session` is the framework-agnostic core that powers the Next.js SDK. It handles JWT verification, token refresh, and encryption. You just provide a storage adapter.

## Overview

```
┌─────────────────────────────────────────────┐
│            Renderer Process                 │
│  ┌────────────────────────────────────────┐ │
│  │  React UI (Home, Account views)        │ │
│  │  └─ useAuth() hook                     │ │
│  └───────────────┬────────────────────────┘ │
└──────────────────┼──────────────────────────┘
                   │ IPC
┌──────────────────┼──────────────────────────┐
│            Main Process                     │
│  ┌───────────────▼────────────────────────┐ │
│  │  IPC Handlers                          │ │
│  │  └─ auth:sign-in, auth:get-user, etc.  │ │
│  └───────────────┬────────────────────────┘ │
│                  │                          │
│  ┌───────────────▼────────────────────────┐ │
│  │  AuthService (from authkit-session)    │ │
│  │  └─ withAuth(), signOut(), etc.        │ │
│  └───────────────┬────────────────────────┘ │
│                  │                          │
│  ┌───────────────▼────────────────────────┐ │
│  │  ElectronSessionStorage (our adapter)  │ │
│  │  └─ getSession(), saveSession()        │ │
│  │  └─ Uses electron-store internally     │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

The pieces:
- **Renderer**: React UI, calls `window.auth.*` methods
- **Main**: Handles auth logic, stores sessions
- **IPC**: Bridge between them

## Step 1: Create the Session Storage Adapter

`@workos/authkit-session` expects a `SessionStorage` implementation. Create one using `electron-store`:

```typescript
// src/main/auth/ElectronSessionStorage.ts
import Store from 'electron-store'
import type { SessionStorage, AuthKitConfig } from '@workos/authkit-session'

export class ElectronSessionStorage implements SessionStorage<ElectronRequest, ElectronResponse> {
  private store: Store<{ session: string | null }>

  constructor(config: AuthKitConfig) {
    this.store = new Store({
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
```

The session data is encrypted using the same `cookiePassword` you'd use in Next.js. `electron-store` handles persistence.

## Step 2: Configure the Auth Service

Wire up `authkit-session` with your adapter:

```typescript
// src/main/auth/auth-service.ts
import { createAuthService, configure } from '@workos/authkit-session'
import { ElectronSessionStorage } from './ElectronSessionStorage'

configure({
  clientId: import.meta.env.MAIN_VITE_WORKOS_CLIENT_ID,
  apiKey: import.meta.env.MAIN_VITE_WORKOS_API_KEY,
  cookiePassword: import.meta.env.MAIN_VITE_WORKOS_COOKIE_PASSWORD,
  redirectUri: 'workos-auth://callback'
})

export const authService = createAuthService({
  sessionStorageFactory: (config) => new ElectronSessionStorage(config)
})

export async function getAuthState() {
  const { auth, refreshedSessionData } = await authService.withAuth({})
  if (refreshedSessionData) {
    await authService.saveSession({}, refreshedSessionData)
  }
  return auth
}
```

Note the `redirectUri`—that's a custom protocol, not an HTTP URL.

## Step 3: Handle Deep Links

OAuth redirects need somewhere to land. Register a custom protocol so the OS routes `workos-auth://callback` back to your app:

```typescript
// src/main/auth/deep-link-handler.ts
const PROTOCOL = 'workos-auth'

export function registerProtocol(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL)
  }
}
```

When WorkOS redirects back after auth, your app catches the URL:

```typescript
app.on('open-url', (event, url) => {
  event.preventDefault()
  if (url.startsWith(`${PROTOCOL}://`)) {
    handleUrl(url) // Extract code, call authService.handleCallback()
  }
})
```

When WorkOS redirects after auth, your app extracts the code and calls `handleCallback()` to complete the token exchange.

## Step 4: Set Up IPC Handlers

The renderer can't access Node.js APIs directly. Create IPC handlers in the main process:

```typescript
// Main process - src/main/auth/ipc-handlers.ts
ipcMain.handle('auth:sign-in', async () => {
  const url = await authService.getSignInUrl()
  await shell.openExternal(url)  // Opens in system browser
  return { success: true }
})

ipcMain.handle('auth:get-user', async () => {
  const { user } = await getAuthState()
  return user ?? null
})
```

```typescript
// Preload - src/preload/index.ts
const authApi = {
  signIn: () => ipcRenderer.invoke('auth:sign-in'),
  signOut: () => ipcRenderer.invoke('auth:sign-out'),
  getUser: () => ipcRenderer.invoke('auth:get-user'),
  onAuthChange: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('auth:on-auth-change', listener)
    return () => ipcRenderer.removeListener('auth:on-auth-change', listener)
  }
}

contextBridge.exposeInMainWorld('auth', authApi)
```

The `onAuthChange` listener lets the main process push auth state updates to the renderer after the OAuth callback completes.

## Step 5: Create the React Hook

With the IPC bridge in place, create a hook for your components:

```typescript
// src/renderer/src/hooks/useAuth.ts
export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.auth.getUser().then((u) => {
      setUser(u)
      setLoading(false)
    })

    return window.auth.onAuthChange(({ user: u }) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const signIn = useCallback(() => window.auth.signIn(), [])
  const signOut = useCallback(() => window.auth.signOut(), [])

  return { user, loading, signIn, signOut }
}
```

Use it in your components:

```tsx
function Home() {
  const { user, signIn } = useAuth()

  return user
    ? <p>Welcome, {user.firstName}</p>
    : <button onClick={signIn}>Sign In</button>
}
```

## Configuration

### Prerequisites

- Node.js 20+
- pnpm
- WorkOS account with AuthKit enabled

### Environment Variables

Create a `.env` file:

```bash
MAIN_VITE_WORKOS_CLIENT_ID=client_xxx
MAIN_VITE_WORKOS_API_KEY=sk_test_xxx
MAIN_VITE_WORKOS_COOKIE_PASSWORD=<32+ character secret>
```

The `MAIN_VITE_` prefix makes these available in the main process via `import.meta.env`.

### WorkOS Configuration

In your WorkOS dashboard, add the redirect URI:

```
workos-auth://callback
```

### Install and Run

```bash
pnpm install
pnpm dev
```

### Build

```bash
# macOS
pnpm build:mac

# Windows
pnpm build:win

# Linux
pnpm build:linux
```

## How It Works

When the user clicks "Sign In":

1. `authService.getSignInUrl()` generates the authorization URL
2. System browser opens to WorkOS hosted auth page
3. User authenticates (password, SSO, social login—whatever you've configured)
4. WorkOS redirects to `workos-auth://callback?code=xxx`
5. OS routes the URL to your Electron app
6. `open-url` event fires, you extract the code
7. `authService.handleCallback()` exchanges the code for tokens
8. Session saved to encrypted store
9. Main process sends `auth:on-auth-change` to renderer
10. UI updates

Token refresh is automatic—`getAuthState()` handles it via the session package.

## Key Points

- **Main process = server**: All auth logic runs here
- **Renderer = client**: Only talks to main via IPC
- **Storage adapter pattern**: Swap `electron-store` for keychain, SQLite, or whatever fits your needs
- **Same core as Next.js**: `@workos/authkit-session` handles the hard parts

---

Built with [electron-vite](https://electron-vite.org), [React](https://react.dev), and [@workos/authkit-session](https://www.npmjs.com/package/@workos/authkit-session).
