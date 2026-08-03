import api from './api'

export const tables = {
  list: () => api.get('/tables/').then((r) => r.data),
  summary: () => api.get('/tables/summary/').then((r) => r.data),
  create: (payload) => api.post('/tables/', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/tables/${id}/`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/tables/${id}/`),

  /** Owner drags several tables, then saves the whole layout in one call. */
  saveLayout: (positions) =>
    api.post('/tables/save_layout/', { tables: positions }).then((r) => r.data),

  bulkCreate: (payload) => api.post('/tables/bulk_create/', payload).then((r) => r.data),
}

export const TABLE_STATUS = {
  AVAILABLE: {
    label: 'Available',
    dot: 'bg-emerald-500',
    tile: 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-500 shadow-2xs',
    chip: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  },
  OCCUPIED: {
    label: 'Occupied',
    dot: 'bg-rose-500',
    tile: 'border-rose-300 bg-rose-50 text-rose-900 hover:border-rose-500 shadow-2xs',
    chip: 'bg-rose-100 text-rose-800 border border-rose-200',
  },
  BILLED: {
    label: 'Billed',
    dot: 'bg-amber-500',
    tile: 'border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-500 shadow-2xs',
    chip: 'bg-amber-100 text-amber-800 border border-amber-200',
  },
}
