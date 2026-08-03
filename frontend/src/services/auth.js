import api, { tokens } from './api'

export async function login(username, password) {
  const { data } = await api.post('/auth/login/', { username, password })
  tokens.save(data.access, data.refresh)
  return data.user
}

export async function fetchMe() {
  const { data } = await api.get('/auth/me/')
  return data
}

export function logout() {
  tokens.clear()
}

/**
 * One-shot Owner approval — used when a cashier's discount crosses the
 * owner-configured maximum. Does not change who is logged in.
 */
export async function verifyOwner(username, password) {
  const { data } = await api.post('/auth/verify-owner/', { username, password })
  return data
}

export const users = {
  list: () => api.get('/auth/users/').then((r) => r.data),
  create: (payload) => api.post('/auth/users/', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/auth/users/${id}/`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/auth/users/${id}/`),
}
