import { Stack } from 'expo-router'

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="metrics/[id]" options={{ headerShown: true, headerTitle: '' }} />
      <Stack.Screen name="manage" options={{ headerShown: true, headerTitle: 'Manage Metrics' }} />
    </Stack>
  )
}
