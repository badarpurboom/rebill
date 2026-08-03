import { useEffect, useState } from 'react'
import { whatsappService } from '@/services/whatsapp'
import { useToast } from '@/context/ToastContext'

export default function WhatsApp() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('simulator')

  // Config State
  const [config, setConfig] = useState(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)

  // Simulator & Messages State
  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [simPhone, setSimPhone] = useState('9876543210')
  const [simText, setSimText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  // Triggers State
  const [triggers, setTriggers] = useState([])
  const [templates, setTemplates] = useState([])
  const [loadingTriggers, setLoadingTriggers] = useState(false)

  // Campaigns State
  const [segmentCounts, setSegmentCounts] = useState({})
  const [campaigns, setCampaigns] = useState([])
  const [newCampaign, setNewCampaign] = useState({ name: '', segment: 'ALL', body: '' })
  const [creatingCampaign, setCreatingCampaign] = useState(false)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = () => {
    setLoadingConfig(true)
    whatsappService
      .getConfig()
      .then((data) => setConfig(data))
      .catch((err) => toast.error(err.response?.data?.detail || 'Failed to load WhatsApp configuration.'))
      .finally(() => setLoadingConfig(false))
  }

  const handleConfigSave = (e) => {
    e.preventDefault()
    setSavingConfig(true)
    whatsappService
      .updateConfig(config)
      .then((updated) => {
        setConfig(updated)
        toast.success('WhatsApp Meta settings updated successfully!')
      })
      .catch((err) => toast.error(err.response?.data?.detail || 'Failed to save settings.'))
      .finally(() => setSavingConfig(false))
  }

  const handleSyncTemplates = () => {
    toast.info('Syncing templates from Meta Cloud API...')
    whatsappService
      .syncTemplates()
      .then((res) => {
        toast.success(`Sync complete! ${res.created} added, ${res.updated} updated.`)
        fetchTemplates()
      })
      .catch((err) => toast.error(err.response?.data?.detail || 'Failed to sync templates.'))
  }

  const fetchMessages = () => {
    setLoadingMessages(true)
    whatsappService
      .getMessages({ phone: simPhone })
      .then((data) => setMessages(data.results || data))
      .catch(() => toast.error('Failed to load messages.'))
      .finally(() => setLoadingMessages(false))
  }

  useEffect(() => {
    if (activeTab === 'simulator') {
      fetchMessages()
    } else if (activeTab === 'triggers') {
      fetchTriggersAndTemplates()
    } else if (activeTab === 'campaigns') {
      fetchCampaignData()
    }
  }, [activeTab, simPhone])

  const fetchTriggersAndTemplates = () => {
    setLoadingTriggers(true)
    Promise.all([whatsappService.getTriggers(), whatsappService.getTemplates()])
      .then(([trigData, tmplData]) => {
        setTriggers(trigData)
        setTemplates(tmplData.results || tmplData)
      })
      .catch(() => toast.error('Triggers fetch error'))
      .finally(() => setLoadingTriggers(false))
  }

  const handleBindTrigger = (trigger, templateId) => {
    whatsappService
      .bindTrigger(trigger, templateId ? parseInt(templateId) : null)
      .then(() => {
        toast.success('Template binding updated successfully!')
        fetchTriggersAndTemplates()
      })
      .catch(() => toast.error('Failed to update binding.'))
  }

  const handleSimulateReplySubmit = (e) => {
    e.preventDefault()
    if (!simText.trim()) return
    setSendingReply(true)
    whatsappService
      .simulateReply(simPhone, simText)
      .then(() => {
        setSimText('')
        fetchMessages()
        toast.success('Customer reply simulated successfully!')
      })
      .catch(() => toast.error('Failed to send reply.'))
      .finally(() => setSendingReply(false))
  }

  const fetchCampaignData = () => {
    whatsappService.getSegmentCounts().then((counts) => setSegmentCounts(counts))
    whatsappService.getCampaigns().then((data) => setCampaigns(data.results || data))
  }

  const handleCreateCampaign = (e) => {
    e.preventDefault()
    if (!newCampaign.name || !newCampaign.body) {
      toast.error('Campaign name and message body are required.')
      return
    }
    setCreatingCampaign(true)
    whatsappService
      .createCampaign(newCampaign)
      .then(() => {
        toast.success('Campaign draft created successfully!')
        setNewCampaign({ name: '', segment: 'ALL', body: '' })
        fetchCampaignData()
      })
      .catch((err) => toast.error(err.response?.data?.detail || 'Campaign creation error'))
      .finally(() => setCreatingCampaign(false))
  }

  const handleSendCampaign = (id) => {
    if (!window.confirm('Are you sure you want to broadcast this message to the selected segment?')) return
    whatsappService
      .sendCampaign(id)
      .then(() => {
        toast.success('Campaign broadcast sent successfully!')
        fetchCampaignData()
      })
      .catch((err) => toast.error(err.response?.data?.detail || 'Campaign send error'))
  }

  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#14141a] p-6 rounded-3xl shadow-md border border-[#272732] gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight">💬 WhatsApp Engagement</h1>
            <span
              className={`px-3 py-1 text-xs font-black rounded-full border ${
                config?.is_live
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}
            >
              {config?.is_live ? '🟢 Live Meta Cloud API' : '🧪 On-Screen Phone Mockup Mode'}
            </span>
          </div>
          <p className="text-slate-400 text-xs font-semibold mt-1">
            Automated Hindi receipts, 6 event triggers, broadcast campaigns &amp; interactive phone simulator
          </p>
        </div>

        <button
          onClick={handleSyncTemplates}
          className="px-4 py-2.5 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 font-black rounded-2xl text-xs border border-amber-500/30 shadow-sm transition"
        >
          🔄 Sync Meta Templates
        </button>
      </div>

      {/* Tabs Pill Navigation */}
      <div className="flex bg-[#14141a] p-1.5 rounded-2xl gap-1 overflow-x-auto border border-[#272732]">
        <TabButton active={activeTab === 'simulator'} onClick={() => setActiveTab('simulator')}>
          📱 Phone Simulator &amp; Live Chat
        </TabButton>
        <TabButton active={activeTab === 'triggers'} onClick={() => setActiveTab('triggers')}>
          ⚡ Automated Triggers (6)
        </TabButton>
        <TabButton active={activeTab === 'campaigns'} onClick={() => setActiveTab('campaigns')}>
          📢 Broadcast Campaigns
        </TabButton>
        <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
          ⚙️ Meta API Config
        </TabButton>
      </div>

      {/* TAB 1: PHONE SIMULATOR & CHAT */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Simulator Settings */}
          <div className="bg-white p-6 rounded-3xl shadow-xs border border-slate-200/80 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Simulator Controls</h2>
              <p className="text-xs text-slate-400">Preview live messages sent to customer phone</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Customer Phone Number
              </label>
              <input
                type="text"
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full rounded-2xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Simulate Customer Reply</h3>
              <form onSubmit={handleSimulateReplySubmit} className="space-y-3">
                <textarea
                  rows="3"
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  placeholder="Type reply... e.g. Khanna bohot accha tha! Khana kab tak aayega?"
                  className="w-full rounded-2xl border border-slate-200 p-3 text-xs outline-none focus:border-emerald-500"
                ></textarea>
                <button
                  type="submit"
                  disabled={sendingReply || !simText.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl text-xs transition shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {sendingReply ? 'Sending...' : '📩 Send Customer Reply'}
                </button>
              </form>
            </div>
          </div>

          {/* Phone Frame Mockup */}
          <div className="lg:col-span-2 flex justify-center">
            <div className="w-full max-w-sm bg-slate-900 rounded-[48px] p-4 shadow-2xl ring-1 ring-slate-700">
              {/* Notch */}
              <div className="w-28 h-4 bg-slate-800 mx-auto rounded-full mb-3 flex items-center justify-center">
                <div className="size-2 bg-slate-900 rounded-full mr-2" />
                <div className="w-8 h-1 bg-slate-700 rounded-full" />
              </div>

              {/* Screen */}
              <div className="bg-[#efeae2] h-[520px] rounded-[32px] overflow-hidden flex flex-col font-sans border border-slate-700">
                {/* Header */}
                <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3 shadow-md">
                  <div className="size-10 bg-emerald-800 rounded-full flex items-center justify-center font-extrabold text-sm border border-emerald-600">
                    {config?.restaurant_name?.[0] || 'R'}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm leading-tight">{config?.restaurant_name || 'ReBill Restaurant'}</h4>
                    <p className="text-[10px] font-semibold text-emerald-200">Official WhatsApp Business</p>
                  </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
                  {loadingMessages ? (
                    <p className="text-center text-xs text-slate-500 py-6">Loading messages...</p>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-xs text-slate-400 py-16">
                      No message history found for <span className="font-bold text-slate-700">{simPhone}</span>.
                    </div>
                  ) : (
                    [...messages].reverse().map((msg) => {
                      const isOut = msg.direction === 'OUT'
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl p-3 text-xs shadow-xs ${
                              isOut ? 'bg-[#dcf8c6] text-slate-800 rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none'
                            }`}
                          >
                            {msg.trigger && (
                              <span className="block text-[9px] font-extrabold text-emerald-800 uppercase tracking-wider mb-1">
                                [{msg.trigger_display || msg.trigger}]
                              </span>
                            )}
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                            <div className="flex justify-between items-center text-[9px] text-slate-400 mt-1.5 gap-2">
                              <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {isOut && (
                                <span className="font-bold text-emerald-700">{msg.is_mock ? '🧪 Mock' : '✓✓ Sent'}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Footer Bar */}
                <div className="bg-[#f0f0f0] p-2.5 flex items-center gap-2 border-t border-slate-200">
                  <div className="flex-1 bg-white rounded-full px-4 py-2 text-xs text-slate-400 font-medium shadow-xs">
                    Type Hindi reply...
                  </div>
                  <div className="size-9 bg-[#075e54] text-white rounded-full flex items-center justify-center text-xs font-bold shadow-xs">
                    ➤
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUTOMATED TRIGGERS */}
      {activeTab === 'triggers' && (
        <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">6 Automated WhatsApp Triggers</h2>
            <p className="text-slate-400 text-xs mt-1">
              Automatic Hindi notifications for Welcome, Receipt, Feedback, Win-back, Birthday &amp; Anniversary
            </p>
          </div>

          {loadingTriggers ? (
            <div className="p-8 text-center text-slate-400 text-xs">Loading triggers...</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {triggers.map((trig) => (
                <div key={trig.trigger} className="p-6 space-y-3 hover:bg-slate-50/50 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="size-3 rounded-full bg-emerald-500 animate-pulse" />
                      <h3 className="font-bold text-slate-900 text-base">{trig.display}</h3>
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-bold ${
                          trig.enabled
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {trig.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">Meta Template:</span>
                      <select
                        value={trig.template || ''}
                        onChange={(e) => handleBindTrigger(trig.trigger, e.target.value)}
                        className="rounded-xl border border-slate-200 text-xs p-2 bg-white font-semibold outline-none focus:border-emerald-500"
                      >
                        <option value="">Default Hindi Text (Mock Mode)</option>
                        {templates.map((tmpl) => (
                          <option key={tmpl.id} value={tmpl.id}>
                            {tmpl.name} ({tmpl.language}) [{tmpl.status}]
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl text-xs text-slate-700 border border-slate-200/80 font-mono whitespace-pre-wrap">
                    {trig.default_body}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BROADCAST CAMPAIGNS */}
      {activeTab === 'campaigns' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-xs border border-slate-200/80 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-3">Customer Segments</h2>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="block text-slate-400 font-bold">All</span>
                  <span className="text-xl font-black text-slate-900">{segmentCounts.ALL || 0}</span>
                </div>
                <div className="bg-blue-50 p-3 rounded-2xl border border-blue-200">
                  <span className="block text-blue-600 font-bold">New</span>
                  <span className="text-xl font-black text-blue-900">{segmentCounts.NEW || 0}</span>
                </div>
                <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
                  <span className="block text-emerald-600 font-bold">Regular</span>
                  <span className="text-xl font-black text-emerald-900">{segmentCounts.REGULAR || 0}</span>
                </div>
                <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200">
                  <span className="block text-amber-600 font-bold">Inactive</span>
                  <span className="text-xl font-black text-amber-900">{segmentCounts.INACTIVE || 0}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Create New Campaign</h3>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  placeholder="e.g. Weekend Special Thali Offer"
                  className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs font-semibold outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Segment</label>
                <select
                  value={newCampaign.segment}
                  onChange={(e) => setNewCampaign({ ...newCampaign, segment: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs font-semibold outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Customers ({segmentCounts.ALL || 0})</option>
                  <option value="NEW">New Customers ({segmentCounts.NEW || 0})</option>
                  <option value="REGULAR">Regular Customers ({segmentCounts.REGULAR || 0})</option>
                  <option value="INACTIVE">Inactive Customers ({segmentCounts.INACTIVE || 0})</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Message Body (Hindi)</label>
                <textarea
                  rows="4"
                  value={newCampaign.body}
                  onChange={(e) => setNewCampaign({ ...newCampaign, body: e.target.value })}
                  placeholder="Namaste {name} 🙏 Aaj hi restaurant aayein aur 15% discount paayein..."
                  className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs outline-none focus:border-emerald-500"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={creatingCampaign}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl text-xs transition shadow-md shadow-emerald-600/20"
              >
                {creatingCampaign ? 'Creating...' : 'Save Campaign Draft'}
              </button>
            </form>
          </div>

          {/* Campaign List */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-xs border border-slate-200/80">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Broadcast History &amp; Drafts</h2>
            {campaigns.length === 0 ? (
              <p className="text-slate-400 text-xs py-12 text-center">No campaign broadcasts yet.</p>
            ) : (
              <div className="space-y-4">
                {campaigns.map((camp) => (
                  <div key={camp.id} className="p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-slate-900 text-base">{camp.name}</h4>
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-bold ${
                          camp.status === 'SENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {camp.status_display}
                      </span>
                    </div>

                    <p className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-800 font-mono whitespace-pre-wrap">
                      {camp.body}
                    </p>

                    {camp.status !== 'SENT' && (
                      <button
                        onClick={() => handleSendCampaign(camp.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                      >
                        🚀 Run Broadcast Now
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="bg-white p-6 rounded-3xl shadow-xs border border-slate-200/80 max-w-2xl space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Meta WhatsApp Cloud API Credentials</h2>
            <p className="text-slate-400 text-xs mt-1">
              Configure Meta App ID, Permanent Access Token &amp; Phone Number ID for live messaging.
            </p>
          </div>

          <form onSubmit={handleConfigSave} className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <span className="font-bold text-slate-900 text-sm block">Live Meta API Mode</span>
                <span className="text-xs text-slate-400">
                  Off: Sends to local simulator. On: Sends real Meta WhatsApp messages.
                </span>
              </div>
              <input
                type="checkbox"
                checked={config?.is_live || false}
                onChange={(e) => setConfig({ ...config, is_live: e.target.checked })}
                className="size-5 accent-emerald-600 rounded cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number ID</label>
              <input
                type="text"
                value={config?.phone_number_id || ''}
                onChange={(e) => setConfig({ ...config, phone_number_id: e.target.value })}
                placeholder="Meta Dashboard -> Phone Number ID"
                className="w-full rounded-2xl border border-slate-200 p-3 text-xs outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">WABA ID (WhatsApp Business Account ID)</label>
              <input
                type="text"
                value={config?.waba_id || ''}
                onChange={(e) => setConfig({ ...config, waba_id: e.target.value })}
                placeholder="Meta Dashboard -> WABA ID"
                className="w-full rounded-2xl border border-slate-200 p-3 text-xs outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Permanent Access Token</label>
              <input
                type="password"
                value={config?.access_token || ''}
                onChange={(e) => setConfig({ ...config, access_token: e.target.value })}
                placeholder={config?.has_access_token ? `Stored (${config.access_token_hint}) — leave blank to keep` : 'Bearer Token'}
                className="w-full rounded-2xl border border-slate-200 p-3 text-xs outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs transition shadow-md shadow-emerald-600/20"
            >
              {savingConfig ? 'Saving...' : 'Save Meta API Configuration'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-xs font-black whitespace-nowrap transition-all duration-150 ${
        active
          ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 ring-1 ring-amber-300'
          : 'text-slate-400 hover:text-white hover:bg-[#1f1f28]'
      }`}
    >
      {children}
    </button>
  )
}
