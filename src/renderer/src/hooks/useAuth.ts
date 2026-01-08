import { useState, useEffect, useCallback } from 'react'

interface User {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  profilePictureUrl: string | null
}

interface UseAuthReturn {
  user: User | null
  loading: boolean
  signIn: () => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<{ success: boolean; error?: string }>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
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
