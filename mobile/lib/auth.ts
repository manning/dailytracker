import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'token'
const USER_KEY  = 'user'

export async function saveAuth(token: string, user: { id: string; email: string; name: string | null }) {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
}

export async function clearAuth() {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
  await SecureStore.deleteItemAsync(USER_KEY)
}

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

export async function getUser() {
  const raw = await SecureStore.getItemAsync(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as { id: string; email: string; name: string | null } }
  catch { return null }
}

export async function isLoggedIn() {
  return !!(await SecureStore.getItemAsync(TOKEN_KEY))
}
