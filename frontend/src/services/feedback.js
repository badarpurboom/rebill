import api from './api'

export const feedbackService = {
  getSummary() {
    return api.get('/feedback/summary/').then((res) => res.data)
  },

  getFeedbacks(params = {}) {
    return api.get('/feedback/', { params }).then((res) => res.data)
  },
}
