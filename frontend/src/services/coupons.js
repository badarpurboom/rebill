import api from './api'

export const couponsService = {
  getCoupons(params = {}) {
    return api.get('/coupons/', { params }).then((res) => res.data)
  },

  createCoupon(data) {
    return api.post('/coupons/', data).then((res) => res.data)
  },

  updateCoupon(id, data) {
    return api.patch(`/coupons/${id}/`, data).then((res) => res.data)
  },

  deleteCoupon(id) {
    return api.delete(`/coupons/${id}/`).then((res) => res.data)
  },

  generateCode() {
    return api.get('/coupons/generate-code/').then((res) => res.data)
  },

  validateCoupon(code, subtotal, customerId = null) {
    return api
      .post('/coupons/validate/', {
        code,
        subtotal,
        customer_id: customerId,
      })
      .then((res) => res.data)
  },

  getUsageHistory() {
    return api.get('/coupons/usage/').then((res) => res.data)
  },
}
