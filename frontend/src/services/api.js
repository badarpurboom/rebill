import axios from 'axios'

export const TOKEN_KEY = 'rebill_access'
export const REFRESH_KEY = 'rebill_refresh'

export const tokens = {
  get access() {
    return localStorage.getItem(TOKEN_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  save(access, refresh) {
    if (access) localStorage.setItem(TOKEN_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = tokens.access
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// A 401 means the 8-hour access token aged out mid-shift. Refresh once,
// silently, and replay the request — the cashier should never see a logout
// screen with a half-entered bill on the table.
let refreshing = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const isAuthCall = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh')

    if (error.response?.status !== 401 || original?._retried || isAuthCall) {
      return Promise.reject(error)
    }

    const refreshToken = tokens.refresh
    if (!refreshToken) {
      forceLogout()
      return Promise.reject(error)
    }

    original._retried = true
    try {
      refreshing ??= axios
        .post('/api/auth/refresh/', { refresh: refreshToken })
        .finally(() => {
          refreshing = null
        })
      const { data } = await refreshing
      tokens.save(data.access, data.refresh)
      original.headers.Authorization = `Bearer ${data.access}`
      return api(original)
    } catch (refreshError) {
      forceLogout()
      return Promise.reject(refreshError)
    }
  },
)

function forceLogout() {
  tokens.clear()
  if (!window.location.pathname.startsWith('/login')) {
    window.location.replace('/login?expired=1')
  }
}

/** Turns a DRF error body into one readable line for a toast. */
export function errorMessage(error, fallback = 'Kuch galat ho gaya. Dobara try karo.') {
  const data = error?.response?.data
  if (!data) return error?.message || fallback
  if (typeof data === 'string') return data
  if (data.detail) return data.detail
  const first = Object.entries(data)[0]
  if (!first) return fallback
  const [field, value] = first
  const text = Array.isArray(value) ? value[0] : value
  return field === 'non_field_errors' ? String(text) : `${field}: ${text}`
}

export default api
