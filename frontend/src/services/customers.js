import api from './api'

export const customers = {
  list: (params) => api.get('/customers/', { params }).then((r) => r.data),
  get: (id) => api.get(`/customers/${id}/`).then((r) => r.data),
  create: (payload) => api.post('/customers/', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/customers/${id}/`, payload).then((r) => r.data),
  deactivate: (id) => api.delete(`/customers/${id}/`),

  /** Phone-first lookup for the POS — returns { exact, matches }. */
  lookup: (phone) => api.get('/customers/lookup/', { params: { phone } }).then((r) => r.data),

  history: (id) => api.get(`/customers/${id}/history/`).then((r) => r.data),

  adjustPoints: (id, points, note) =>
    api.post(`/customers/${id}/adjust-points/`, { points, note }).then((r) => r.data),
}

export const LOYALTY_REASON_TONE = {
  EARN: 'green',
  REDEEM: 'amber',
  REVERSAL: 'slate',
  ADJUST: 'brand',
}
