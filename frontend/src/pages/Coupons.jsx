import { useEffect, useState } from 'react'
import { couponsService } from '@/services/coupons'
import { feedbackService } from '@/services/feedback'
import { useToast } from '@/context/ToastContext'

export default function Coupons() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('coupons')

  // Coupons State
  const [coupons, setCoupons] = useState([])
  const [loadingCoupons, setLoadingCoupons] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [savingCoupon, setSavingCoupon] = useState(false)

  // Usage History State
  const [usages, setUsages] = useState([])
  const [loadingUsages, setLoadingUsages] = useState(false)

  // Feedback Alerts State
  const [feedbackSummary, setFeedbackSummary] = useState(null)
  const [loadingFeedback, setLoadingFeedback] = useState(false)

  // Form State
  const [form, setForm] = useState({
    code: '',
    discount_type: 'PERCENT',
    discount_value: '10',
    min_order_amount: '0',
    max_discount_amount: '',
    valid_until: '',
    usage_limit: '',
    segment: 'ALL',
    is_active: true,
  })

  useEffect(() => {
    fetchCoupons()
    fetchFeedbackSummary()
  }, [])

  useEffect(() => {
    if (activeTab === 'usage') {
      fetchUsageHistory()
    }
  }, [activeTab])

  const fetchCoupons = () => {
    setLoadingCoupons(true)
    couponsService
      .getCoupons()
      .then((data) => setCoupons(data.results || data))
      .catch(() => toast.error('Failed to load coupons.'))
      .finally(() => setLoadingCoupons(false))
  }

  const fetchUsageHistory = () => {
    setLoadingUsages(true)
    couponsService
      .getUsageHistory()
      .then((data) => setUsages(data.results || data))
      .catch(() => toast.error('Failed to load usage history.'))
      .finally(() => setLoadingUsages(false))
  }

  const fetchFeedbackSummary = () => {
    setLoadingFeedback(true)
    feedbackService
      .getSummary()
      .then((data) => setFeedbackSummary(data))
      .catch(() => {})
      .finally(() => setLoadingFeedback(false))
  }

  const handleGenerateCode = () => {
    couponsService.generateCode().then((res) => {
      setForm((prev) => ({ ...prev, code: res.code }))
    })
  }

  const handleCreateSubmit = (e) => {
    e.preventDefault()
    if (!form.code.trim() || !form.discount_value) {
      toast.error('Coupon code and discount value are required.')
      return
    }

    setSavingCoupon(true)
    const payload = {
      ...form,
      discount_value: parseFloat(form.discount_value),
      min_order_amount: parseFloat(form.min_order_amount || '0'),
      max_discount_amount: form.max_discount_amount ? parseFloat(form.max_discount_amount) : null,
      usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null,
      valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
    }

    couponsService
      .createCoupon(payload)
      .then(() => {
        toast.success('Coupon created successfully! 🎉')
        setShowModal(false)
        setForm({
          code: '',
          discount_type: 'PERCENT',
          discount_value: '10',
          min_order_amount: '0',
          max_discount_amount: '',
          valid_until: '',
          usage_limit: '',
          segment: 'ALL',
          is_active: true,
        })
        fetchCoupons()
      })
      .catch((err) => toast.error(err.response?.data?.detail || 'Failed to create coupon.'))
      .finally(() => setSavingCoupon(false))
  }

  const handleToggleActive = (coupon) => {
    couponsService
      .updateCoupon(coupon.id, { is_active: !coupon.is_active })
      .then(() => {
        toast.success(`Coupon ${!coupon.is_active ? 'Activated' : 'Deactivated'}!`)
        fetchCoupons()
      })
      .catch(() => toast.error('Failed to update coupon.'))
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">🎟️ Coupons & Campaigns</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1 rounded-full border border-emerald-300">
              {coupons.filter((c) => c.is_valid_now).length} Active Coupons
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Manage discount codes, segment targeting, POS validation & negative feedback alerts.
          </p>
        </div>

        <button
          onClick={() => {
            handleGenerateCode()
            setShowModal(true)
          }}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl text-sm shadow-md shadow-emerald-600/20 transition flex items-center gap-2"
        >
          <span>✨ Create New Coupon</span>
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-slate-500 text-xs font-semibold">Total Coupons</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{coupons.length}</p>
          </div>
          <span className="text-3xl">🎫</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-slate-500 text-xs font-semibold">Customer Rating Avg</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              {feedbackSummary?.average_rating || '0.0'} ⭐
            </p>
          </div>
          <span className="text-3xl">🌟</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-slate-500 text-xs font-semibold">Negative Feedback Alerts (1-2★)</p>
            <p className="text-2xl font-black text-rose-600 mt-1">
              {feedbackSummary?.negative_alerts_count || 0}
            </p>
          </div>
          <span className="text-3xl">🚨</span>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('coupons')}
          className={`pb-3 px-4 font-semibold text-sm transition border-b-2 whitespace-nowrap ${
            activeTab === 'coupons'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          🎟️ Coupons List
        </button>
        <button
          onClick={() => setActiveTab('usage')}
          className={`pb-3 px-4 font-semibold text-sm transition border-b-2 whitespace-nowrap ${
            activeTab === 'usage'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          📜 Usage Log
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`pb-3 px-4 font-semibold text-sm transition border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'alerts'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>🚨 Negative Feedback Alerts</span>
          {feedbackSummary?.negative_alerts_count > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {feedbackSummary.negative_alerts_count}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: COUPONS LIST */}
      {activeTab === 'coupons' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {loadingCoupons ? (
            <div className="p-8 text-center text-slate-500">Loading coupons...</div>
          ) : coupons.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <span className="text-4xl block mb-2">🎟️</span>
              <p className="font-semibold text-slate-600">No coupons found.</p>
              <p className="text-xs text-slate-400 mt-1">Click the button above to create a new coupon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {coupons.map((c) => (
                <div
                  key={c.id}
                  className={`p-5 rounded-2xl border transition relative space-y-3 ${
                    c.is_valid_now
                      ? 'bg-white border-emerald-200 shadow-sm hover:border-emerald-400'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-lg font-black text-slate-800 tracking-wider bg-slate-100 px-3 py-1 rounded-xl border border-slate-200 inline-block">
                        {c.code}
                      </span>
                      <span
                        className={`ml-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          c.is_valid_now
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {c.is_valid_now ? 'Active' : 'Expired/Disabled'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleToggleActive(c)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition ${
                        c.is_active
                          ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                    >
                      {c.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>

                  <div className="text-2xl font-extrabold text-emerald-600">
                    {c.discount_type === 'PERCENT' ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`}
                  </div>

                  <div className="space-y-1 text-xs text-slate-500 pt-2 border-t border-slate-100">
                    {c.min_order_amount > 0 && (
                      <p>Min Order: <b className="text-slate-700">₹{c.min_order_amount}</b></p>
                    )}
                    {c.max_discount_amount && (
                      <p>Max Discount: <b className="text-slate-700">₹{c.max_discount_amount}</b></p>
                    )}
                    <p>Segment: <b className="text-slate-700">{c.segment_display}</b></p>
                    <p>
                      Used: <b className="text-slate-700">{c.used_count}</b>
                      {c.usage_limit ? ` / ${c.usage_limit}` : ''}
                    </p>
                    {c.valid_until && (
                      <p>
                        Expires:{' '}
                        <b className="text-slate-700">
                          {new Date(c.valid_until).toLocaleDateString()}
                        </b>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USAGE HISTORY */}
      {activeTab === 'usage' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-800">Coupon Usage Log</h2>
          </div>
          {loadingUsages ? (
            <div className="p-8 text-center text-slate-500">Loading usage history...</div>
          ) : usages.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No coupon usage recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-200">
                    <th className="p-3.5 pl-6">Coupon Code</th>
                    <th className="p-3.5">Customer</th>
                    <th className="p-3.5">Bill Number</th>
                    <th className="p-3.5">Discount Applied</th>
                    <th className="p-3.5 pr-6">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {usages.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="p-3.5 pl-6 font-mono font-bold text-emerald-700">{u.coupon_code}</td>
                      <td className="p-3.5 font-medium">{u.customer_name || '—'}</td>
                      <td className="p-3.5 font-semibold text-slate-800">{u.bill_number || '—'}</td>
                      <td className="p-3.5 font-bold text-slate-900">₹{u.discount_applied}</td>
                      <td className="p-3.5 pr-6 text-xs text-slate-400">
                        {new Date(u.used_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: NEGATIVE FEEDBACK ALERTS */}
      {activeTab === 'alerts' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="text-3xl">🚨</span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Negative Feedback Screen Alerts</h2>
              <p className="text-xs text-slate-500">
                Instant owner screen notifications for 1-Star and 2-Star reviews.
              </p>
            </div>
          </div>

          {!feedbackSummary?.negative_alerts?.length ? (
            <div className="py-12 text-center text-slate-400">
              <span className="text-4xl block mb-2">🎉</span>
              <p className="font-semibold text-slate-700">No negative feedback!</p>
              <p className="text-xs text-slate-400 mt-1">All customers are satisfied.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {feedbackSummary.negative_alerts.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-rose-800 text-sm">
                        {item.customer_name} ({item.customer_phone})
                      </span>
                      <span className="bg-rose-600 text-white font-bold text-xs px-2 py-0.5 rounded-full">
                        {item.rating} ★
                      </span>
                    </div>
                    {item.bill_number && (
                      <p className="text-xs text-rose-600 mt-0.5">Bill: {item.bill_number}</p>
                    )}
                    {item.comment && (
                      <p className="text-xs text-slate-700 mt-1 italic bg-white p-2 rounded-xl border border-rose-100">
                        "{item.comment}"
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-rose-400 self-end sm:self-center">
                    {new Date(item.submitted_at || item.requested_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE COUPON MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg">Create New Coupon</h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-sm font-bold hover:bg-white/30"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Coupon Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. WELCOME10"
                    className="flex-1 rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold outline-none focus:border-emerald-500 uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition"
                  >
                    🎲 Auto
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Type</label>
                  <select
                    value={form.discount_type}
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-emerald-500"
                  >
                    <option value="PERCENT">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Value</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                    placeholder="10"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min Order (₹)</label>
                  <input
                    type="number"
                    value={form.min_order_amount}
                    onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Max Cap (₹)</label>
                  <input
                    type="number"
                    value={form.max_discount_amount}
                    onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })}
                    placeholder="Optional"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Customer Segment</label>
                <select
                  value={form.segment}
                  onChange={(e) => setForm({ ...form, segment: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Customers</option>
                  <option value="NEW">New Customers (1st visit)</option>
                  <option value="REGULAR">Regular Customers</option>
                  <option value="INACTIVE">Inactive Customers (Win-back)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Usage Limit</label>
                  <input
                    type="number"
                    value={form.usage_limit}
                    onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                    placeholder="Optional limit"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={form.valid_until}
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="coupon_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
                <label htmlFor="coupon_active" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Is Coupon Active Immediately?
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCoupon}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md shadow-emerald-600/20"
                >
                  {savingCoupon ? 'Saving...' : 'Save Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
