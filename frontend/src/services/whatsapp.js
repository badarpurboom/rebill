import api from './api'

export const whatsappService = {
  getConfig() {
    return api.get('/whatsapp/config/').then((res) => res.data)
  },

  updateConfig(data) {
    return api.patch('/whatsapp/config/', data).then((res) => res.data)
  },

  getTemplates() {
    return api.get('/whatsapp/templates/').then((res) => res.data)
  },

  syncTemplates() {
    return api.post('/whatsapp/templates/sync/').then((res) => res.data)
  },

  getTriggers() {
    return api.get('/whatsapp/triggers/').then((res) => res.data)
  },

  bindTrigger(trigger, templateId) {
    return api
      .post('/whatsapp/triggers/bind/', { trigger, template: templateId })
      .then((res) => res.data)
  },

  getMessages(params = {}) {
    return api.get('/whatsapp/messages/', { params }).then((res) => res.data)
  },

  simulateReply(phone, body) {
    return api.post('/whatsapp/simulate-reply/', { phone, body }).then((res) => res.data)
  },

  getSegmentCounts() {
    return api.get('/whatsapp/segments/counts/').then((res) => res.data)
  },

  getCampaigns() {
    return api.get('/whatsapp/campaigns/').then((res) => res.data)
  },

  createCampaign(data) {
    return api.post('/whatsapp/campaigns/', data).then((res) => res.data)
  },

  sendCampaign(id) {
    return api.post(`/whatsapp/campaigns/${id}/send/`).then((res) => res.data)
  },

  getPublicFeedback(token) {
    return api.get(`/whatsapp/feedback/${token}/`).then((res) => res.data)
  },

  submitPublicFeedback(token, data) {
    return api.post(`/whatsapp/feedback/${token}/submit/`, data).then((res) => res.data)
  },
}
