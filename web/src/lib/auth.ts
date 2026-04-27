import type { User } from './api'

export function saveAuth(token: string, user: User) {
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
}

export function clearAuth() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export function getUser(): User | null {
  const raw = localStorage.getItem('user')
  return raw ? JSON.parse(raw) : null
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem('token')
}
