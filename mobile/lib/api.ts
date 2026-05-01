import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'

// Set EXPO_PUBLIC_API_URL in .env (e.g. http://100.x.x.x:3001)
const BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001') + '/api/v1'

export type MetricType = 'NUMBER' | 'SCALE' | 'BOOLEAN' | 'DURATION' | 'CATEGORICAL' | 'TEXT'

export interface Metric {
  id: string
  name: string
  type: MetricType
  unit: string | null
  color: string | null
  order: number
  allowMultiplePerDay: boolean
  scaleMin: number | null
  scaleMax: number | null
  defaultNumericValue: number | null
  defaultTextValue: string | null
  archivedAt: string | null
}

export interface Entry {
  id: string
  metricDefId: string
  numericValue: number | null
  textValue: string | null
  loggedAt: string
  metricDef: Metric
}

export interface User {
  id: string
  email: string
  name: string | null
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await SecureStore.getItemAsync('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...headers, ...init?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string, name?: string) =>
      request<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),
  },
  metrics: {
    list: () => request<Metric[]>('/metrics'),
    create: (data: Partial<Omit<Metric, 'id' | 'archivedAt'>>) =>
      request<Metric>('/metrics', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Omit<Metric, 'id' | 'archivedAt'>>) =>
      request<Metric>(`/metrics/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    archive: (id: string) => request<void>(`/metrics/${id}`, { method: 'DELETE' }),
  },
  entries: {
    list: (params?: { metricDefId?: string; from?: string; to?: string }) => {
      const qs = Object.entries(params ?? {})
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
        .join('&')
      return request<Entry[]>(`/entries${qs ? `?${qs}` : ''}`)
    },
    create: (data: { metricDefId: string; numericValue?: number; textValue?: string; loggedAt: string }) =>
      request<Entry>('/entries', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/entries/${id}`, { method: 'DELETE' }),
  },
}
