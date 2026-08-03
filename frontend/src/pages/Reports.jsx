import { useEffect, useState } from 'react'
import { reportsService } from '@/services/reports'
import { useToast } from '@/context/ToastContext'

export default function Reports() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('daily')

  // Date States
  const todayStr = new Date().toISOString().split('T')[0]
  const [dailyDate, setDailyDate] = useState(todayStr)
  const [weeklyStartDate, setWeeklyStartDate] = useState(
    new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
  )
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear())
  const [monthlyMonth, setMonthlyMonth] = useState(new Date().getMonth() + 1)
  const [gstFrom, setGstFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  )
  const [gstTo, setGstTo] = useState(todayStr)

  // Report Data States
  const [dailyData, setDailyData] = useState(null)
  const [weeklyData, setWeeklyData] = useState(null)
  const [monthlyData, setMonthlyData] = useState(null)
  const [gstData, setGstData] = useState(null)
  const [ltvData, setLtvData] = useState(null)

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchReport()
  }, [activeTab, dailyDate, weeklyStartDate, monthlyYear, monthlyMonth, gstFrom, gstTo])

  const fetchReport = () => {
    setLoading(true)
    if (activeTab === 'daily') {
      reportsService
        .getDailyReport(dailyDate)
        .then(setDailyData)
        .catch(() => toast.error('Failed to load daily report.'))
        .finally(() => setLoading(false))
    } else if (activeTab === 'weekly') {
      reportsService
        .getWeeklyReport(weeklyStartDate)
        .then(setWeeklyData)
        .catch(() => toast.error('Failed to load weekly report.'))
        .finally(() => setLoading(false))
    } else if (activeTab === 'monthly') {
      reportsService
        .getMonthlyReport(monthlyYear, monthlyMonth)
        .then(setMonthlyData)
        .catch(() => toast.error('Failed to load monthly report.'))
        .finally(() => setLoading(false))
    } else if (activeTab === 'gst') {
      reportsService
        .getGSTReport(gstFrom, gstTo)
        .then(setGstData)
        .catch(() => toast.error('Failed to load GST report.'))
        .finally(() => setLoading(false))
    } else if (activeTab === 'ltv') {
      reportsService
        .getLTVReport()
        .then(setLtvData)
        .catch(() => toast.error('Failed to load LTV report.'))
        .finally(() => setLoading(false))
    }
  }

  const handleDownloadPDF = () => {
    let params = {}
    if (activeTab === 'daily') params.date = dailyDate
    else if (activeTab === 'weekly') params.start_date = weeklyStartDate
    else if (activeTab === 'monthly') {
      params.year = monthlyYear
      params.month = monthlyMonth
    } else if (activeTab === 'gst') {
      params.from_date = gstFrom
      params.to_date = gstTo
    }

    const url = reportsService.getPDFDownloadUrl(activeTab, params)
    window.open(url, '_blank')
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header Bar */}
      <div className="no-print flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-3xl shadow-xs border border-slate-200/80 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">📈 Reports &amp; Analytics</h1>
          <p className="text-slate-400 text-xs font-semibold mt-1">
            Daily sales summary, GST 5% tax registers, weekly trends &amp; PDF download exports
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-rose-600/20 transition flex items-center gap-1.5"
          >
            <span>📄 Export PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs border border-slate-200 transition flex items-center gap-1.5"
          >
            <span>🖨️ Print Report</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="no-print flex bg-slate-100 p-1.5 rounded-2xl gap-1 overflow-x-auto">
        <ReportTab active={activeTab === 'daily'} onClick={() => setActiveTab('daily')}>
          📊 Daily Sales
        </ReportTab>
        <ReportTab active={activeTab === 'weekly'} onClick={() => setActiveTab('weekly')}>
          📅 Weekly Breakdown
        </ReportTab>
        <ReportTab active={activeTab === 'monthly'} onClick={() => setActiveTab('monthly')}>
          📆 Monthly Trend
        </ReportTab>
        <ReportTab active={activeTab === 'gst'} onClick={() => setActiveTab('gst')}>
          🧾 GST Register (5%)
        </ReportTab>
        <ReportTab active={activeTab === 'ltv'} onClick={() => setActiveTab('ltv')}>
          👑 Customer LTV
        </ReportTab>
      </div>

      {/* TAB 1: DAILY SALES */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          <div className="no-print bg-white p-4 rounded-2xl border border-slate-200/80 flex items-center gap-3 w-fit shadow-xs">
            <span className="text-xs font-bold text-slate-700">Select Date:</span>
            <input
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
              className="rounded-xl border border-slate-200 p-2 text-xs font-bold outline-none focus:border-rose-500"
            />
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">Loading daily report...</div>
          ) : dailyData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricBox label="Net Sales Revenue" value={`₹${dailyData.net_sales}`} tone="text-emerald-700" />
                <MetricBox label="Total Paid Bills" value={dailyData.total_bills} />
                <MetricBox label="Total GST (5%)" value={`₹${dailyData.gst_total}`} sub={`CGST ₹${dailyData.cgst_total} + SGST ₹${dailyData.sgst_total}`} />
                <MetricBox label="Discounts Given" value={`₹${dailyData.discount_total}`} tone="text-amber-700" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="font-extrabold text-slate-900 text-base">Payment Mode Breakdown</h3>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                      <span className="font-bold text-slate-700">💵 Cash Payments</span>
                      <span className="font-black text-slate-900">₹{dailyData.payment_modes.cash}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                      <span className="font-bold text-slate-700">💳 Card Payments</span>
                      <span className="font-black text-slate-900">₹{dailyData.payment_modes.card}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                      <span className="font-bold text-slate-700">📱 UPI Payments</span>
                      <span className="font-black text-slate-900">₹{dailyData.payment_modes.upi}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="font-extrabold text-slate-900 text-base">Top Selling Dishes</h3>
                  {dailyData.top_items.length === 0 ? (
                    <p className="text-slate-400 text-xs py-4">No dishes sold on this date.</p>
                  ) : (
                    <div className="space-y-2">
                      {dailyData.top_items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl text-xs">
                          <span className="font-bold text-slate-800">
                            {item.item_name} ({item.portion})
                          </span>
                          <span className="font-extrabold text-rose-600">
                            x{item.total_qty} (₹{item.total_revenue})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WEEKLY BREAKDOWN */}
      {activeTab === 'weekly' && (
        <div className="space-y-6">
          <div className="no-print bg-white p-4 rounded-2xl border border-slate-200/80 flex items-center gap-3 w-fit shadow-xs">
            <span className="text-xs font-bold text-slate-700">Start Date:</span>
            <input
              type="date"
              value={weeklyStartDate}
              onChange={(e) => setWeeklyStartDate(e.target.value)}
              className="rounded-xl border border-slate-200 p-2 text-xs font-bold outline-none focus:border-rose-500"
            />
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">Loading weekly report...</div>
          ) : weeklyData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MetricBox label="Total Weekly Sales" value={`₹${weeklyData.total_sales}`} tone="text-emerald-700" />
                <MetricBox label="Total Paid Bills" value={weeklyData.total_bills} />
                <MetricBox label="Average Bill Size" value={`₹${weeklyData.average_bill_value}`} />
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                      <th className="p-3.5">Day</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Paid Bills</th>
                      <th className="p-3.5">GST (5%)</th>
                      <th className="p-3.5 text-right">Net Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {weeklyData.days.map((day) => (
                      <tr key={day.date} className="hover:bg-slate-50/80">
                        <td className="p-3.5 font-bold text-slate-900">{day.day_name}</td>
                        <td className="p-3.5 text-slate-400 font-semibold">{day.date}</td>
                        <td className="p-3.5 font-bold">{day.bills}</td>
                        <td className="p-3.5 text-slate-700">₹{day.gst}</td>
                        <td className="p-3.5 font-extrabold text-emerald-700 text-right">₹{day.sales}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MONTHLY TREND */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          <div className="no-print bg-white p-4 rounded-2xl border border-slate-200/80 flex items-center gap-3 w-fit shadow-xs">
            <span className="text-xs font-bold text-slate-700">Year &amp; Month:</span>
            <select
              value={monthlyMonth}
              onChange={(e) => setMonthlyMonth(parseInt(e.target.value))}
              className="rounded-xl border border-slate-200 p-2 text-xs font-bold outline-none focus:border-rose-500"
            >
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                <option key={m} value={m}>Month {m}</option>
              ))}
            </select>
            <input
              type="number"
              value={monthlyYear}
              onChange={(e) => setMonthlyYear(parseInt(e.target.value))}
              className="w-20 rounded-xl border border-slate-200 p-2 text-xs font-bold outline-none focus:border-rose-500"
            />
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">Loading monthly report...</div>
          ) : monthlyData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MetricBox label={`Monthly Revenue (${monthlyData.month_name})`} value={`₹${monthlyData.total_sales}`} tone="text-emerald-700" />
                <MetricBox label="Total GST Collected" value={`₹${monthlyData.total_gst}`} />
                <MetricBox label="New Customers Registered" value={monthlyData.new_customers_count} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: GST TAX REGISTER */}
      {activeTab === 'gst' && (
        <div className="space-y-6">
          <div className="no-print bg-white p-4 rounded-2xl border border-slate-200/80 flex flex-wrap items-center gap-3 w-fit shadow-xs">
            <span className="text-xs font-bold text-slate-700">GST Period:</span>
            <input
              type="date"
              value={gstFrom}
              onChange={(e) => setGstFrom(e.target.value)}
              className="rounded-xl border border-slate-200 p-2 text-xs font-bold outline-none focus:border-rose-500"
            />
            <span className="text-xs text-slate-400 font-bold">to</span>
            <input
              type="date"
              value={gstTo}
              onChange={(e) => setGstTo(e.target.value)}
              className="rounded-xl border border-slate-200 p-2 text-xs font-bold outline-none focus:border-rose-500"
            />
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">Loading GST register...</div>
          ) : gstData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <MetricBox label="Taxable Turnover" value={`₹${gstData.taxable_turnover}`} />
                <MetricBox label="CGST (2.5%)" value={`₹${gstData.cgst_total}`} />
                <MetricBox label="SGST (2.5%)" value={`₹${gstData.sgst_total}`} />
                <MetricBox label="Total GST (5%)" value={`₹${gstData.total_gst}`} tone="text-emerald-700" />
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs overflow-x-auto">
                <h3 className="font-extrabold text-slate-900 text-sm mb-4">Bill-wise GST Register (5% Rate)</h3>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                      <th className="p-3.5">Bill No</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Taxable Value</th>
                      <th className="p-3.5">CGST 2.5%</th>
                      <th className="p-3.5">SGST 2.5%</th>
                      <th className="p-3.5 text-right">Total GST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {gstData.bills.map((b) => (
                      <tr key={b.bill_number} className="hover:bg-slate-50/80">
                        <td className="p-3.5 font-mono font-bold text-slate-900">{b.bill_number}</td>
                        <td className="p-3.5 text-slate-400 font-semibold">{b.date}</td>
                        <td className="p-3.5 font-bold text-slate-800">{b.customer_name}</td>
                        <td className="p-3.5">₹{b.taxable_amount}</td>
                        <td className="p-3.5">₹{b.cgst_amount}</td>
                        <td className="p-3.5">₹{b.sgst_amount}</td>
                        <td className="p-3.5 font-extrabold text-emerald-700 text-right">₹{b.total_gst}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CUSTOMER LTV */}
      {activeTab === 'ltv' && (
        <div className="space-y-6">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">Loading LTV leaderboard...</div>
          ) : ltvData && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-extrabold text-slate-900 text-base">Top Customer Spenders (LTV Leaderboard)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                      <th className="p-3.5">Rank</th>
                      <th className="p-3.5">Customer Name</th>
                      <th className="p-3.5">Phone</th>
                      <th className="p-3.5">Visits</th>
                      <th className="p-3.5">Lifetime Spend</th>
                      <th className="p-3.5">Avg Bill</th>
                      <th className="p-3.5 text-right">Loyalty Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {ltvData.leaderboard.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-slate-50/80">
                        <td className="p-3.5 font-black text-slate-400">#{idx + 1}</td>
                        <td className="p-3.5 font-bold text-slate-900">{c.name}</td>
                        <td className="p-3.5 text-slate-400 font-semibold">{c.phone}</td>
                        <td className="p-3.5 font-bold">{c.visit_count}</td>
                        <td className="p-3.5 font-extrabold text-emerald-700">₹{c.total_spend}</td>
                        <td className="p-3.5 text-slate-600">₹{c.average_spend}</td>
                        <td className="p-3.5 font-black text-rose-600 text-right">⭐ {c.points_balance} pts</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ReportTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-all duration-150 ${
        active
          ? 'bg-white text-rose-700 shadow-xs'
          : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  )
}

function MetricBox({ label, value, sub, tone = 'text-slate-900' }) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-1">
      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{label}</p>
      <p className={`tabular text-2xl font-black ${tone}`}>{value}</p>
      {sub && <p className="text-[10px] font-semibold text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}
