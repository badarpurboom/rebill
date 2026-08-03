import api from './api'

export const reportsService = {
  getDashboardSummary(period = 'today') {
    return api.get('/reports/dashboard-summary/', { params: { period } }).then((res) => res.data)
  },

  getDailyReport(date = null) {

    return api.get('/reports/daily/', { params: date ? { date } : {} }).then((res) => res.data)
  },

  getWeeklyReport(startDate = null) {
    return api
      .get('/reports/weekly/', { params: startDate ? { start_date: startDate } : {} })
      .then((res) => res.data)
  },

  getMonthlyReport(year = null, month = null) {
    return api
      .get('/reports/monthly/', { params: { year, month } })
      .then((res) => res.data)
  },

  getGSTReport(fromDate = null, toDate = null) {
    return api
      .get('/reports/gst/', { params: { from: fromDate, to: toDate } })
      .then((res) => res.data)
  },

  getLTVReport() {
    return api.get('/reports/ltv/').then((res) => res.data)
  },

  getPDFDownloadUrl(type, params = {}) {
    const query = new URLSearchParams({ type, ...params }).toString()
    return `/api/reports/export-pdf/?${query}`
  },
}
