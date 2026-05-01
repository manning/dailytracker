import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { useRouter, useSegments } from 'expo-router'
import { isLoggedIn } from '../lib/auth'

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    isLoggedIn().then(loggedIn => {
      const inAuth = segments[0] === '(auth)'
      if (!loggedIn && !inAuth) router.replace('/(auth)/login')
      if (loggedIn && inAuth)  router.replace('/')
      setChecked(true)
    })
  }, [segments])

  if (!checked) return null

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  )
}
