import api from './api'

export const orders = {
  /** Idempotent — tapping the same table twice lands on the same bill. */
  open: (tableId) => api.post('/billing/orders/open/', { table: tableId }).then((r) => r.data),
  createTakeaway: () => api.post('/billing/orders/takeaway/').then((r) => r.data),
  get: (id) => api.get(`/billing/orders/${id}/`).then((r) => r.data),
  listOpen: () => api.get('/billing/orders/', { params: { open: 'true' } }).then((r) => r.data),

  addItem: (orderId, payload) =>
    api.post(`/billing/orders/${orderId}/items/`, payload).then((r) => r.data),
  updateItem: (orderId, itemId, payload) =>
    api.patch(`/billing/orders/${orderId}/items/${itemId}/`, payload).then((r) => r.data),
  removeItem: (orderId, itemId) =>
    api.delete(`/billing/orders/${orderId}/items/${itemId}/remove/`),

  sendKot: (orderId) => api.post(`/billing/orders/${orderId}/kot/`).then((r) => r.data),

  /** Attach a diner mid-meal, or pass null to unlink. */
  setCustomer: (orderId, customerId) =>
    api.post(`/billing/orders/${orderId}/customer/`, { customer: customerId }).then((r) => r.data),

  preview: (orderId, { discountPercent = '0', redeemPoints = 0 } = {}) =>
    api
      .post(`/billing/orders/${orderId}/preview/`, {
        discount_percent: discountPercent,
        redeem_points: redeemPoints,
      })
      .then((r) => r.data),

  generateBill: (orderId, payload) =>
    api.post(`/billing/orders/${orderId}/generate-bill/`, payload).then((r) => r.data),
  void: (orderId) =>
    api.post(`/billing/orders/${orderId}/void/`).then((r) => r.data),
}

export const bills = {
  list: (params) => api.get('/billing/bills/', { params }).then((r) => r.data),
  get: (id) => api.get(`/billing/bills/${id}/`).then((r) => r.data),
  pay: (id, paymentMode) =>
    api.post(`/billing/bills/${id}/pay/`, { payment_mode: paymentMode }).then((r) => r.data),
  cancel: (id, payload) =>
    api.post(`/billing/bills/${id}/cancel/`, payload).then((r) => r.data),

  exportFile: async (params) => {
    const response = await api.get('/billing/bills/export_csv/', { params, responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `rebill-bills-export-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  },

  importFile: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post('/billing/bills/import_csv/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
}

export const BILL_STATUS_TONE = {
  UNPAID: 'amber',
  PAID: 'green',
  CANCELLED: 'red',
}

export const kots = {
  list: () => api.get('/billing/kots/').then((r) => r.data),
}

export const restaurantSettings = {
  get: () => api.get('/settings/').then((r) => r.data),
  update: (payload) => api.patch('/settings/', payload).then((r) => r.data),
}

export const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash', icon: '💵' },
  { value: 'CARD', label: 'Card', icon: '💳' },
  { value: 'UPI', label: 'UPI', icon: '📱' },
]
