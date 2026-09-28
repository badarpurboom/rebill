import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useSync } from '@/context/SyncContext'
import { navFor } from '@/utils/roles'
import { IconChefHat } from '@/components/ui/Icons'

const ROLE_TONE = {
  OWNER: 'bg-rose-100 text-rose-800 border-rose-200',
  CASHIER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  WAITER: 'bg-amber-100 text-amber-800 border-amber-200',
}

const NAV_META = {
  '/': { label: 'Dashboard', shortcut: '⌘1', tag: null },
  '/pos': { label: 'Billing POS', shortcut: '⌘2', tag: 'Fast', isLive: true },
  '/tables': { label: 'Floor Map', shortcut: '⌘3', tag: 'Live' },
  '/kot': { label: 'Kitchen KOT', shortcut: '⌘K', tag: 'Live', isLive: true },
  '/menu': { label: 'Menu Catalog', shortcut: '⌘M', tag: null },
  '/customers': { label: 'Customers', shortcut: null, tag: 'CRM' },
  '/orders': { label: 'Order History', shortcut: null, tag: 'Archive' },
  '/whatsapp': { label: 'WhatsApp Console', shortcut: null, tag: 'Chat' },
  '/coupons': { label: 'Coupons & Promos', shortcut: null, tag: 'Offers' },
  '/reports': { label: 'Analytics & Reports', shortcut: null, tag: 'Live', isLive: true },
  '/explore': { label: 'Explore Hub', shortcut: '⌘E', tag: 'Hub' },
  '/settings': { label: 'Settings & Staff', shortcut: '⌘,', tag: 'Admin', isSpin: true },
}

export default function Layout() {
  const { user, role, logout } = useAuth()
  const { isOnline, isSyncing, pendingCount, triggerSync } = useSync()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const links = navFor(user)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleMouseMove = (e) => {
    const nav = e.currentTarget
    const rect = nav.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    nav.style.setProperty('--mouse-x', `${x}px`)
    nav.style.setProperty('--mouse-y', `${y}px`)
  }

  const userInitials = (user?.full_name || user?.username || 'ReBill')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const topLinks = links.filter((l) => l.to !== '/explore' && l.to !== '/settings')
  const bottomNavLinks = links.filter((l) => l.to === '/explore' || l.to === '/settings')

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f9f9f8] text-slate-800 selection:bg-rose-100 selection:text-rose-900">
      {/* Mobile Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Desktop Curved Vertical Navigation Strip Container (Seamless with page background) */}
      <aside className="no-print hidden lg:flex relative flex-col items-center justify-center pl-3 pr-1.5 py-2 select-none bg-[#f9f9f8] z-30 shrink-0">
        {/* Main Liquid Glass Pill Navigation Strip */}
        <nav
          onMouseMove={handleMouseMove}
          className="relative w-[64px] h-[calc(100vh-24px)] rounded-[32px] flex flex-col items-center justify-between py-3 px-1 glass-pill-container backdrop-blur-2xl z-20 overflow-visible shadow-xl"
          data-purpose="vertical-navigation-strip"
        >
          {/* Top Master Logo / Brand Badge + Operational Links */}
          <div className="flex flex-col items-center w-full shrink-0 space-y-1.5">
            <NavLink
              to="/"
              aria-label="ReBill POS Home"
              className="group relative flex items-center justify-center focus:outline-none"
            >
              <div className="w-10 h-10 rounded-[14px] bg-gradient-to-b from-[#FF5436] to-[#E8143A] flex items-center justify-center text-white glow-red hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer">
                <IconChefHat className="w-5 h-5 stroke-[1.8] transition-transform duration-300 group-hover:rotate-12" />
              </div>
              {/* Logo Tooltip */}
              <div className="nav-tooltip absolute left-[74px] top-1/2 flex items-center gap-2 px-3 py-1.5 rounded-xl whitespace-nowrap">
                <span className="text-white text-xs font-semibold tracking-wide">ReBill POS</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-rose-300 font-bold">
                  PRO
                </span>
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#0e101a] rotate-45 border-l border-b border-white/10" />
              </div>
            </NavLink>

            {/* Micro divider under logo */}
            <div className="w-6 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent my-1" />

            {/* Core Operational Links (Dashboard, POS, Tables, KOT) */}
            {topLinks.map((link) => {
              const meta = NAV_META[link.to] || { label: link.label, shortcut: null, tag: null }
              const isSpin = meta.isSpin
              const isLive = meta.isLive

              return (
                <div
                  key={link.to}
                  className={`relative w-full flex justify-center nav-item group ${isSpin ? 'spin-on-hover' : ''}`}
                  data-nav={link.to}
                >
                  <NavLink
                    to={link.to}
                    end={link.to === '/'}
                    aria-label={meta.label}
                    className={({ isActive }) =>
                      `nav-btn relative flex items-center justify-center focus:outline-none cursor-pointer transition-all duration-300 ${
                        isActive
                          ? 'is-active w-9.5 h-9.5 rounded-[13px] bg-gradient-to-b from-[#FF5436] to-[#E8143A] text-white glow-red'
                          : 'w-9 h-9 rounded-[12px] text-slate-400 hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <div className="active-notch" />}
                        <span className="w-4.5 h-4.5 flex items-center justify-center [&>svg]:size-[18px]">
                          {link.icon}
                        </span>
                        {isLive && !isActive && (
                          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06B6D4]" />
                        )}
                      </>
                    )}
                  </NavLink>

                  <div className="nav-tooltip absolute left-[74px] top-1/2 flex items-center gap-2 px-3 py-1.5 rounded-xl whitespace-nowrap">
                    <span className="text-white text-xs font-medium">{meta.label}</span>
                    {meta.shortcut && (
                      <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                        {meta.shortcut}
                      </kbd>
                    )}
                    {meta.tag && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                        {meta.tag}
                      </span>
                    )}
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#0e101a] rotate-45 border-l border-b border-white/10" />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Empty Spacer Area in Menubar (Reserves vertical space of removed modules) */}
          <div className="flex-1 w-full min-h-16 pointer-events-none" aria-hidden="true" />

          {/* Bottom Group (Explore, Settings, Logout) */}
          <div className="flex flex-col items-center space-y-1.5 w-full shrink-0 pb-0.5">
            {bottomNavLinks.map((link) => {
              const meta = NAV_META[link.to] || { label: link.label, shortcut: null, tag: null }
              const isSpin = meta.isSpin
              const isLive = meta.isLive

              return (
                <div
                  key={link.to}
                  className={`relative w-full flex justify-center nav-item group ${isSpin ? 'spin-on-hover' : ''}`}
                  data-nav={link.to}
                >
                  <NavLink
                    to={link.to}
                    end={link.to === '/'}
                    aria-label={meta.label}
                    className={({ isActive }) =>
                      `nav-btn relative flex items-center justify-center focus:outline-none cursor-pointer transition-all duration-300 ${
                        isActive
                          ? 'is-active w-9.5 h-9.5 rounded-[13px] bg-gradient-to-b from-[#FF5436] to-[#E8143A] text-white glow-red'
                          : 'w-9 h-9 rounded-[12px] text-slate-400 hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <div className="active-notch" />}
                        <span className="w-4.5 h-4.5 flex items-center justify-center [&>svg]:size-[18px]">
                          {link.icon}
                        </span>
                        {isLive && !isActive && (
                          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06B6D4]" />
                        )}
                      </>
                    )}
                  </NavLink>

                  <div className="nav-tooltip absolute left-[74px] top-1/2 flex items-center gap-2 px-3 py-1.5 rounded-xl whitespace-nowrap">
                    <span className="text-white text-xs font-medium">{meta.label}</span>
                    {meta.shortcut && (
                      <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                        {meta.shortcut}
                      </kbd>
                    )}
                    {meta.tag && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                        {meta.tag}
                      </span>
                    )}
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#0e101a] rotate-45 border-l border-b border-white/10" />
                  </div>
                </div>
              )
            })}

            {/* Minimalist Fading Separator */}
            <div className="w-6 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent my-1" />

            {/* Logout / Clock Out Action */}
            <div className="relative w-full flex justify-center nav-item group" data-nav="logout">
              <button
                onClick={handleLogout}
                aria-label="Logout / Clock Out"
                title="Logout / Clock Out"
                className="nav-btn w-9 h-9 rounded-[12px] flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-300 focus:outline-none cursor-pointer group"
                type="button"
              >
                <svg
                  className="w-4.5 h-4.5 group-hover:scale-110 transition-transform duration-300"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.36 6.64A9 9 0 1 1 5.64 6.64" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v10" />
                </svg>
              </button>
              <div className="nav-tooltip absolute left-[74px] top-1/2 flex items-center gap-2 px-3 py-1.5 rounded-xl whitespace-nowrap">
                <span className="text-rose-300 text-xs font-medium">Logout / Clock Out</span>
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#0e101a] rotate-45 border-l border-b border-white/10" />
              </div>
            </div>
          </div>
        </nav>
      </aside>

      {/* Mobile Slide-over Menu with Liquid Glass */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex flex-col items-center justify-center px-4 py-6 bg-slate-900/40 backdrop-blur-md border-r border-slate-200/20
          transition-transform duration-300 ease-out lg:hidden
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <nav
          onMouseMove={handleMouseMove}
          className="relative w-[78px] h-full max-h-[780px] rounded-[40px] flex flex-col items-center justify-between py-4.5 glass-pill-container backdrop-blur-2xl z-20"
        >
          {/* Top Logo + Operational Links */}
          <div className="flex flex-col items-center w-full shrink-0 space-y-2">
            <div className="w-12 h-12 rounded-[18px] bg-gradient-to-b from-[#FF5436] to-[#E8143A] flex items-center justify-center text-white glow-red">
              <IconChefHat className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div className="w-7 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent my-1" />

            {topLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `nav-btn relative flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? 'is-active w-11 h-11 rounded-[16px] bg-gradient-to-b from-[#FF5436] to-[#E8143A] text-white glow-red'
                      : 'w-10 h-10 rounded-[14px] text-slate-400 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <div className="active-notch" />}
                    <span className="size-5 flex items-center justify-center">{link.icon}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Empty Space in Mobile Menu */}
          <div className="flex-1 w-full" aria-hidden="true" />

          {/* Bottom Explore + Settings + Logout */}
          <div className="flex flex-col items-center space-y-2 w-full shrink-0">
            {bottomNavLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `nav-btn relative flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? 'is-active w-11 h-11 rounded-[16px] bg-gradient-to-b from-[#FF5436] to-[#E8143A] text-white glow-red'
                      : 'w-10 h-10 rounded-[14px] text-slate-400 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <div className="active-notch" />}
                    <span className="size-5 flex items-center justify-center">{link.icon}</span>
                  </>
                )}
              </NavLink>
            ))}

            <div className="w-7 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent my-1" />

            <button
              onClick={() => {
                setOpen(false)
                handleLogout()
              }}
              className="w-10 h-10 rounded-[14px] flex items-center justify-center text-slate-400 hover:text-rose-400"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.36 6.64A9 9 0 1 1 5.64 6.64" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v10" />
              </svg>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f9f9f8]">
        {/* Mobile Header Bar */}
        <header className="no-print flex h-14 items-center justify-between border-b border-slate-200/80 bg-white px-4 lg:hidden shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 active:scale-95 transition"
            >
              <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-gradient-to-b from-[#FF5436] to-[#E8143A] flex items-center justify-center text-white glow-red-sm">
                <IconChefHat className="size-4 text-white" />
              </div>
              <span className="font-black text-slate-900 tracking-tight">ReBill POS</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => triggerSync(true)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${
                !isOnline
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : isSyncing
                  ? 'bg-blue-50 border-blue-300 text-blue-800 animate-pulse'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800'
              }`}
            >
              <span
                className={`size-2 rounded-full ${
                  !isOnline ? 'bg-amber-500' : isSyncing ? 'bg-blue-500' : 'bg-emerald-500'
                }`}
              />
              <span>{!isOnline ? `OFFLINE (${pendingCount})` : isSyncing ? 'SYNC' : 'ONLINE'}</span>
            </button>

            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${ROLE_TONE[role] ?? ''}`}
            >
              {user?.custom_role?.name || user?.role_display || user?.role}
            </span>
          </div>
        </header>

        {/* Viewport */}
        <main
          className={`scroll-thin flex flex-1 flex-col min-h-0 bg-[#f9f9f8] animate-fade-in ${
            location.pathname === '/pos' ? 'p-0 overflow-hidden' : 'p-3 sm:p-4 lg:p-5 overflow-y-auto'
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}

