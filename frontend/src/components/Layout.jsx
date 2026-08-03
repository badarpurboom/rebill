import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { navFor, ROLE_LABEL } from '@/utils/roles'
import { IconChefHat } from '@/components/ui/Icons'

const ROLE_TONE = {
  OWNER: 'bg-rose-100 text-rose-800 border-rose-200',
  CASHIER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  WAITER: 'bg-amber-100 text-amber-800 border-amber-200',
}

// Short caps label for Lumière vertical icon rail
const SHORT_LABEL = {
  '/': 'DASH',
  '/pos': 'POS',
  '/tables': 'MAP',
  '/kot': 'KOT',
  '/menu': 'MENU',
  '/customers': 'CUST',
  '/orders': 'ORDERS',
  '/whatsapp': 'CHAT',
  '/coupons': 'OFFERS',
  '/reports': 'STATS',
  '/settings': 'SETTING',
}

export default function Layout() {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const links = navFor(role)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-full bg-[#f9f9f8] text-slate-800 selection:bg-rose-100 selection:text-rose-900">
      {/* Mobile Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Exact Lumière POS Vertical Icon Rail Navigation Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-20 md:w-24 flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xl lg:shadow-none
          transition-transform duration-300 ease-out lg:static lg:translate-x-0 py-4 justify-between
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Top Brand Chef Icon */}
        <div className="flex flex-col items-center justify-center pb-3 border-b border-slate-100/80">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-rose-700 text-white shadow-md shadow-rose-600/30 ring-4 ring-rose-50">
            <IconChefHat className="size-6 text-white" />
          </div>
          <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest mt-1">ReBill</span>
        </div>

        {/* Lumière Vertical Icon Navigation Rail Buttons */}
        <nav className="scroll-thin flex-1 space-y-2.5 overflow-y-auto px-2 py-4 flex flex-col items-center">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              onClick={() => setOpen(false)}
              title={link.label}
              className={({ isActive }) =>
                `w-full flex flex-col items-center justify-center rounded-2xl py-3 px-1 transition-all duration-150 active:scale-90 ${
                  isActive
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25 ring-2 ring-rose-500/20 font-black'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 font-bold'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`size-6 transition-transform duration-150 ${isActive ? 'scale-110 text-white' : 'text-slate-500'}`}>
                    {link.icon}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest mt-1">
                    {SHORT_LABEL[link.to] || link.label.slice(0, 5)}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom User Avatar & Logout */}
        <div className="px-2 pt-2 border-t border-slate-100 flex flex-col items-center gap-2">
          <div
            title={`${user?.full_name || user?.username} (${ROLE_LABEL[role]})`}
            className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-800 border border-slate-200"
          >
            {(user?.full_name || user?.username || '?').charAt(0).toUpperCase()}
          </div>
          <button
            onClick={handleLogout}
            title="Logout / Clock Out"
            className="w-full flex items-center justify-center rounded-xl p-2.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 active:scale-90 transition-all border border-slate-200/70 group"
          >
            <svg className="size-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M18.36 6.64A9 9 0 1 1 5.64 6.64" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f9f9f8]">
        {/* Mobile Header Bar */}
        <header className="no-print flex h-16 items-center justify-between border-b border-slate-200/80 bg-white px-4 lg:hidden shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="rounded-xl border border-slate-200 p-2.5 text-slate-700 hover:bg-slate-50 active:scale-95 transition"
            >
              ☰
            </button>
            <div className="flex items-center gap-2">
              <IconChefHat className="size-6 text-rose-600" />
              <span className="font-black text-slate-900 tracking-tight">ReBill POS</span>
            </div>
          </div>

          <span
            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${ROLE_TONE[role] ?? ''}`}
          >
            {ROLE_LABEL[role]}
          </span>
        </header>

        {/* Viewport */}
        <main
          className={`scroll-thin flex flex-1 flex-col min-h-0 overflow-y-auto bg-[#f9f9f8] animate-fade-in ${
            location.pathname === '/pos' ? 'p-0' : 'p-4 sm:p-6 lg:p-8'
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
