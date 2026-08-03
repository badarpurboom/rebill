import api from './api'

export const categories = {
  list: () => api.get('/menu/categories/').then((r) => r.data),
  create: (payload) => api.post('/menu/categories/', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/menu/categories/${id}/`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/menu/categories/${id}/`),
}

export const items = {
  list: (params) => api.get('/menu/items/', { params }).then((r) => r.data),
  create: (payload) => api.post('/menu/items/', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/menu/items/${id}/`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/menu/items/${id}/`),
  toggleStock: (id) => api.post(`/menu/items/${id}/toggle_stock/`).then((r) => r.data),
  clearAll: () => api.post('/menu/items/clear_all/').then((r) => r.data),


  importFile: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post('/menu/items/import_csv/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },

  exportFile: async () => {
    const response = await api.get('/menu/items/export_csv/', { responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `rebill-menu-export-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  },

  downloadTemplate: async () => {
    const response = await api.get('/menu/items/sample_csv/', { responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = 'rebill-menu-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  },
}
