export type MetricType = 'NUMBER' | 'SCALE' | 'BOOLEAN' | 'DURATION' | 'CATEGORICAL' | 'TEXT'

export interface Metric {
  id: string
  name: string
  type: MetricType
  unit: string | null
  color: string | null
  order: number
  allowMultiplePerDay: boolean
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

const BASE = '/api/v1'

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...authHeaders(), ...init?.headers } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  auth: {
    register: (email: string, password: string, name?: string) =>
      request<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),
    login: (email: string, password: string) =>
      request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
  },
  metrics: {
    list: () => request<Metric[]>('/metrics'),
    create: (data: Partial<Metric>) =>
      request<Metric>('/metrics', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Metric>) =>
      request<Metric>(`/metrics/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    archive: (id: string) => request<void>(`/metrics/${id}`, { method: 'DELETE' }),
  },
  entries: {
    list: (params?: { metricDefId?: string; from?: string; to?: string }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString()
      return request<Entry[]>(`/entries${qs ? `?${qs}` : ''}`)
    },
    create: (data: { metricDefId: string; numericValue?: number; textValue?: string; loggedAt: string }) =>
      request<Entry>('/entries', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/entries/${id}`, { method: 'DELETE' }),
  },
}
