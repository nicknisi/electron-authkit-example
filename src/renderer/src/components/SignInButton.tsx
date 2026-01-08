import { Button, Text } from '@radix-ui/themes'
import { useAuth } from '../hooks/useAuth'

interface SignInButtonProps {
  large?: boolean
}

export function SignInButton({ large }: SignInButtonProps): React.JSX.Element {
  const { user, loading, signIn, signOut } = useAuth()

  if (loading) {
    return <Text>Loading...</Text>
  }

  if (user) {
    return (
      <Button size={large ? '3' : '2'} onClick={signOut}>
        Sign Out
      </Button>
    )
  }

  return (
    <Button size={large ? '3' : '2'} onClick={signIn}>
      Sign In{large && ' with AuthKit'}
    </Button>
  )
}
